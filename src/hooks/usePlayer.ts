import { useState, useRef, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { Player } from '../models/Player';
import { Archetype } from '../models/Archetype';
import AnalyticsService from '../services/AnalyticsService';
import {
  savePlayerData,
  readLocalPlayerSnapshot,
  reconcileCloudPlayerData,
  writeLocalPlayerSnapshot,
  ReconcileResult,
} from '../utils/storage';

// Archetype selection only reaches the create-character path when the cloud read was
// INCONCLUSIVE (timed out / unreachable). Retry it a couple times first — a cold-start Firestore
// stall usually clears once the gRPC channel warms — so we ADOPT an existing cloud character
// instead of creating a fresh one over it. Only if the retries still fail do we fall back to a
// provisional (local-only, savedAt:0) character that can never overwrite an unread cloud save.
const ARCHETYPE_CLOUD_RETRIES = 2;
const ARCHETYPE_CLOUD_RETRY_DELAY_MS = 1000;

// On Android New Architecture (Fabric), state commits that happen while the
// activity is paused — e.g. while a runtime permission dialog has focus —
// can be lost. The UI then stays on the previous tree (the "Loading…" branch
// in HomeScreen) even after the activity resumes. Cold-start init can finish
// inside that paused window when the work is fast (Java auth prewarm makes
// signInAnonymously a no-op), so the initial setPlayer call is the one that
// gets dropped. Defer the setter until AppState is 'active' to make the
// initial paint deterministic.
function commitWhenActive(commit: () => void): () => void {
  let fired = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  // Arm the listener first — no synchronous AppState read before this, so
  // there is no TOCTOU window where an 'active' event could slip past.
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active' && !fired) {
      fired = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      sub.remove();
      commit();
    }
  });

  // Yield the event loop via setTimeout(0) before reading AppState.currentState.
  // commitWhenActive is called from Promise continuations (microtasks); any
  // pending native AppState change notifications are macrotasks queued BEFORE
  // our setTimeout, so they run first and update AppState.currentState to the
  // true value. Without this yield the synchronous read can return 'active'
  // while the activity is already paused (the 'background' macrotask is still
  // pending), causing setPlayer to fire inside the Fabric drop window and the
  // home-screen render to be silently discarded.
  timeoutId = setTimeout(() => {
    timeoutId = null;
    if (!fired && AppState.currentState === 'active') {
      fired = true;
      sub.remove();
      commit();
    }
  }, 0);

  return () => {
    if (!fired) {
      fired = true;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      sub.remove();
    }
  };
}

export function usePlayer() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [needsArchetypeSelection, setNeedsArchetypeSelection] = useState(false);
  // Incremented by the belt-and-suspenders on every 'active' transition. Two
  // recovery roles after a Fabric commit was dropped during a pause window:
  // 1. Returning player: forces a re-render even when playerRef.current and the
  //    current player state share the same object reference (React would otherwise
  //    bail via Object.is), so Fabric re-commits the home-screen tree.
  // 2. New user: HomeScreen uses this value as the ArchetypeSelectionScreen `key`,
  //    so each bump REMOUNTS that screen — re-issuing the dropped native mount
  //    instructions. A plain re-render of an unchanged subtree would not.
  const [repaintToken, setRepaintToken] = useState(0);
  const playerRef = useRef<Player | null>(null);
  const pendingCommitUnsubRef = useRef<(() => void) | null>(null);
  // Monotonic token identifying the most-recently-started initializePlayer (or
  // clearPlayer) call. initializePlayer captures it before awaiting and bails
  // after the await if a newer call has superseded it. Without this, two
  // concurrent initializePlayer calls — e.g. the initialize() call with a
  // null user racing a belated-sign-in reload with cloud data — resolve in
  // completion order, so a slow null-user load can clobber the signed-in
  // load's result and silently drop cloud progress.
  const initGenerationRef = useRef(0);
  // The in-flight cloud reconcile promise. handleArchetypeSelected awaits it so a
  // freshly-chosen archetype can never overwrite an existing cloud character
  // (fresh install / reinstall). Carries the distinct adopted/noNewerCloud/unavailable outcome.
  const cloudCheckRef = useRef<Promise<ReconcileResult> | null>(null);
  // True when the live player is PROVISIONAL — created during archetype selection while the cloud
  // was unreachable, persisted local-only with a savedAt:0 sentinel and NOT yet written to the
  // cloud. While provisional, saves stay local-only (can't clobber an unread cloud save); the
  // reconcile resolves it (adopt a real cloud save, or promote this char once cloud is confirmed
  // empty). Also re-derived on load from a savedAt:0 local snapshot.
  const provisionalRef = useRef(false);
  // The init generation whose post-paint reconcile has already been started, so
  // the reconcile effect fires exactly once per initializePlayer.
  const reconciledGenerationRef = useRef(-1);
  // Mirrors needsArchetypeSelection for the belt-and-suspenders 'active' handler,
  // whose AppState listener closure can't read live React state. Synced via an
  // effect, so it tracks the committed React state even when Fabric drops the
  // native mount — letting a stranded new-user archetype screen be recovered.
  const needsArchetypeRef = useRef(false);
  useEffect(() => {
    needsArchetypeRef.current = needsArchetypeSelection;
  }, [needsArchetypeSelection]);

  // Cancel any pending deferred commit if the component unmounts so the
  // listener doesn't fire after teardown.
  useEffect(() => {
    return () => {
      pendingCommitUnsubRef.current?.();
      pendingCommitUnsubRef.current = null;
    };
  }, []);

  // Belt-and-suspenders retry on every active transition. Two things happen:
  // 1. setPlayer(playerRef.current) re-asserts the player value.
  // 2. setRepaintToken increments unconditionally, guaranteeing React schedules
  //    a re-render even when playerRef.current and the current state share the
  //    same object reference. Without (2), React bails via Object.is and the
  //    native tree (stuck on the loading screen) is never re-committed by Fabric.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        if (playerRef.current) {
          setPlayer(playerRef.current);
          // If a dropped Fabric commit left needsArchetypeSelection=true
          // but the player was already committed to playerRef, clear the flag.
          setNeedsArchetypeSelection(false);
        } else if (needsArchetypeRef.current) {
          // New user with no committed player: a Fabric commit dropped during a
          // cold-start pause (e.g. a permission dialog stealing focus) can lose the
          // archetype screen's native mount while React still believes it's mounted.
          // Re-assert the state; the setRepaintToken bump below remounts the screen
          // (HomeScreen keys it on repaintToken), re-issuing the dropped native mount.
          setNeedsArchetypeSelection(true);
        }
        setRepaintToken(t => t + 1);
      }
    });
    return () => sub.remove();
  }, []);

  // Cloud reconcile — runs AFTER the first screen paints (this effect fires
  // post-commit, once the player or archetype-selection screen is on screen).
  // The native Firestore read can synchronously block the JS thread on Android
  // New Architecture; keeping it off the pre-paint path means the screen is
  // already committed before any freeze, so the user is never stranded on
  // "Loading…" (the long-standing E2E-Android flake). If the cloud holds a
  // strictly-newer record (cross-device) or a character for a fresh install
  // (local was empty), adopt it.
  useEffect(() => {
    if (!player && !needsArchetypeSelection) return;
    const gen = initGenerationRef.current;
    if (reconciledGenerationRef.current === gen) return; // already reconciled this load
    reconciledGenerationRef.current = gen;

    const promise = reconcileCloudPlayerData();
    cloudCheckRef.current = promise;
    promise
      .then(result => {
        if (gen !== initGenerationRef.current) return; // superseded
        if (result.status === 'adopted') {
          // Cloud held a strictly-newer save (cross-device), or ANY save for a fresh/provisional
          // local (savedAt 0) — adopt it as authoritative.
          const cloudPlayer = Player.fromJSON(result.data);
          playerRef.current = cloudPlayer;
          provisionalRef.current = false;
          setPlayer(cloudPlayer);
          setNeedsArchetypeSelection(false);
          AnalyticsService.playerSessionStart(cloudPlayer.level, cloudPlayer.totalDistance);
        } else if (
          result.status === 'noNewerCloud' &&
          provisionalRef.current &&
          playerRef.current
        ) {
          // Provisional character + cloud slot CONFIRMED empty → promote it to the cloud (a real
          // save), making it canonical and clearing the provisional state.
          provisionalRef.current = false;
          savePlayerData(playerRef.current);
        }
        // 'unavailable', or 'noNewerCloud' for a normal returning player → keep local as-is.
      })
      .catch(error => console.error('usePlayer: cloud reconcile failed:', error));
  }, [player, needsArchetypeSelection]);

  const setPlayerAndSave = useCallback((updated: Player) => {
    playerRef.current = updated;
    setPlayer(updated);
    if (provisionalRef.current) {
      // Provisional character (cloud unconfirmed): keep it local-only with the savedAt:0
      // sentinel so its progress can't be written to the cloud and overwrite a save we haven't
      // reconciled yet. It's promoted to the cloud once the reconcile confirms the slot is empty.
      writeLocalPlayerSnapshot(updated.toJSON(), 0).catch(e =>
        console.error('setPlayerAndSave: provisional local write failed:', e),
      );
    } else {
      savePlayerData(updated);
    }
  }, []);

  const clearPlayer = useCallback(() => {
    // Bump the generation so any in-flight initializePlayer that's still
    // awaiting loadPlayerData bails instead of repopulating the player we're
    // about to clear (account-switch races).
    initGenerationRef.current++;
    // Cancel any deferred initial commit — without this, a setPlayer queued
    // by a still-awaiting initializePlayer could fire after clearPlayer
    // (e.g. account-switch races) and briefly restore the wrong session's
    // player on the UI.
    pendingCommitUnsubRef.current?.();
    pendingCommitUnsubRef.current = null;
    playerRef.current = null;
    // Drop the previous account's in-flight cloud check so the next account's
    // initializePlayer + reconcile effect start a fresh one.
    cloudCheckRef.current = null;
    // Reset provisional state — the next account/session re-derives it from its own load.
    provisionalRef.current = false;
    setPlayer(null);
    setNeedsArchetypeSelection(false);
  }, []);

  const initializePlayer = useCallback(async (): Promise<void> => {
    const myGeneration = ++initGenerationRef.current;
    // Paint archetype selection (deferred for the Fabric pause window). Used by
    // both the no-local-data and error paths.
    const showArchetypeSelection = () => {
      pendingCommitUnsubRef.current?.();
      pendingCommitUnsubRef.current = commitWhenActive(() => {
        pendingCommitUnsubRef.current = null;
        // A newer init/clearPlayer superseded us between arming and firing — a
        // deferred commit from a stale init must not paint over the live one.
        if (myGeneration !== initGenerationRef.current) return;
        setNeedsArchetypeSelection(true);
      });
    };
    try {
      // LOCAL ONLY — never gate first paint on the cloud read; it can synchronously
      // block the JS thread on Android New Arch and strand the user on "Loading…".
      // The post-paint reconcile effect pulls cloud data once the screen is up.
      const { data: localData, savedAt: localSavedAt } = await readLocalPlayerSnapshot();
      // A newer initializePlayer (e.g. belated-sign-in reload) or a clearPlayer
      // superseded us while we awaited. Bail so our stale snapshot can't clobber.
      if (myGeneration !== initGenerationRef.current) {
        return;
      }

      if (!localData) {
        // No local save — genuinely new, or a fresh install whose cloud character
        // the post-paint reconcile will adopt. Show archetype selection now;
        // handleArchetypeSelected waits for the cloud check before creating a new
        // character so an existing cloud save is never clobbered.
        provisionalRef.current = false;
        showArchetypeSelection();
        return;
      }

      // A savedAt:0 snapshot is a PROVISIONAL character (created in a prior session while the
      // cloud was unreachable, never cloud-written). Re-flag it so this session's saves stay
      // local-only and the reconcile can adopt a real cloud save (which outranks savedAt 0) or
      // promote this one once the cloud is confirmed empty.
      provisionalRef.current = localSavedAt === 0;

      // Returning player — paint from the local snapshot immediately; the
      // reconcile effect adopts cloud data afterward if it is strictly newer.
      const playerToSet = Player.fromJSON(localData);
      playerRef.current = playerToSet;
      pendingCommitUnsubRef.current?.();
      pendingCommitUnsubRef.current = commitWhenActive(() => {
        pendingCommitUnsubRef.current = null;
        if (myGeneration !== initGenerationRef.current) return; // superseded
        if (playerRef.current) {
          setPlayer(playerRef.current);
          setNeedsArchetypeSelection(false);
        }
      });

      AnalyticsService.playerSessionStart(playerToSet.level, playerToSet.totalDistance);
    } catch (error) {
      console.error('Error initializing player:', error);
      if (myGeneration !== initGenerationRef.current) {
        return;
      }
      // On error fall back to archetype selection rather than silently defaulting
      // to Martial — the player's choice should always be explicit.
      showArchetypeSelection();
    }
  }, []);

  const handleArchetypeSelected = useCallback(async (archetype: Archetype): Promise<void> => {
    const gen = initGenerationRef.current;

    // Reinstall guard: wait for the cloud check before creating a character, so a
    // fresh-install player who picks an archetype can't overwrite the cloud save
    // the post-paint reconcile is still fetching. The effect normally starts the
    // check; start it here too in case the user tapped before that effect ran
    // (set reconciledGenerationRef so the effect doesn't double-fetch).
    if (!cloudCheckRef.current) {
      reconciledGenerationRef.current = gen;
      cloudCheckRef.current = reconcileCloudPlayerData();
    }
    let result: ReconcileResult;
    try {
      result = (await cloudCheckRef.current) ?? { status: 'unavailable' };
    } catch {
      result = { status: 'unavailable' };
    }
    if (gen !== initGenerationRef.current) {
      return; // account switched while we waited
    }

    // The create-character path is reached only when the cloud read was INCONCLUSIVE
    // (unavailable). Retry a couple times — a cold-start Firestore stall usually clears once the
    // gRPC channel warms — so an existing cloud character is adopted rather than overwritten.
    for (let i = 0; i < ARCHETYPE_CLOUD_RETRIES && result.status === 'unavailable'; i++) {
      await new Promise<void>(resolve =>
        setTimeout(() => resolve(), ARCHETYPE_CLOUD_RETRY_DELAY_MS),
      );
      if (gen !== initGenerationRef.current) return;
      try {
        result = await reconcileCloudPlayerData();
      } catch {
        result = { status: 'unavailable' };
      }
      if (gen !== initGenerationRef.current) return;
    }

    if (result.status === 'adopted' || playerRef.current) {
      // A real cloud character exists (or the reconcile effect already set one) — adopt it,
      // never create over it. Covers the race where the user confirmed before the effect's
      // setState committed.
      if (result.status === 'adopted' && !playerRef.current) {
        const cloudPlayer = Player.fromJSON(result.data);
        playerRef.current = cloudPlayer;
        provisionalRef.current = false;
        setPlayer(cloudPlayer);
        setNeedsArchetypeSelection(false);
        AnalyticsService.playerSessionStart(cloudPlayer.level, cloudPlayer.totalDistance);
      }
      return;
    }

    // Create the chosen archetype. Do NOT clear needsArchetypeSelection here — defer it into the
    // commitWhenActive callback so it batches with setPlayer in one render (clearing it early
    // causes a "Loading..." flash between archetype selection and the home screen).
    const newPlayer = new Player({ archetype });
    playerRef.current = newPlayer;
    if (result.status === 'unavailable') {
      // Cloud STILL unreachable after retries — create PROVISIONALLY: local-only, savedAt:0, no
      // cloud write, so it can never overwrite a save we couldn't read. The reconcile (next
      // launch / belated read) adopts a real cloud save or promotes this one if the cloud's empty.
      provisionalRef.current = true;
      try {
        await writeLocalPlayerSnapshot(newPlayer.toJSON(), 0);
      } catch (error) {
        console.error('Error saving provisional player after archetype selection:', error);
      }
    } else {
      // result.status === 'noNewerCloud' → cloud CONFIRMED empty → create + sync to cloud normally.
      provisionalRef.current = false;
      try {
        await savePlayerData(newPlayer);
      } catch (error) {
        console.error('Error saving new player after archetype selection:', error);
      }
    }

    AnalyticsService.playerSessionStart(newPlayer.level, newPlayer.totalDistance);
    pendingCommitUnsubRef.current?.();
    pendingCommitUnsubRef.current = commitWhenActive(() => {
      pendingCommitUnsubRef.current = null;
      if (playerRef.current) {
        setPlayer(playerRef.current);
        setNeedsArchetypeSelection(false);
      }
    });
  }, []);

  // Debug only: drop the in-memory player and re-show archetype selection to exercise the new-user
  // flow. Non-invasive — it just re-enters the archetype-selection state the app already supports;
  // handleArchetypeSelected's reconcile guard still re-adopts any cloud character (so this can't
  // lose cloud data), and local storage is left intact, so backing out without picking just reloads
  // the character on the next launch.
  const debugTriggerArchetypeSelection = useCallback((): void => {
    pendingCommitUnsubRef.current?.();
    pendingCommitUnsubRef.current = null;
    playerRef.current = null;
    cloudCheckRef.current = null;
    provisionalRef.current = false;
    setPlayer(null);
    setNeedsArchetypeSelection(true);
  }, []);

  return {
    player,
    playerRef,
    setPlayerAndSave,
    clearPlayer,
    initializePlayer,
    needsArchetypeSelection,
    handleArchetypeSelected,
    debugTriggerArchetypeSelection,
    repaintToken,
  };
}
