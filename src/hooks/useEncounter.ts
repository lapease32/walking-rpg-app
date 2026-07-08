import { useState, useRef, useEffect, MutableRefObject } from 'react';
import { Alert, AppStateStatus } from 'react-native';
import { Player } from '../models/Player';
import { Encounter, Location } from '../models/Encounter';
import { Creature, Rarity, isEliteCreature } from '../models/Creature';
import LocationService, { LocationData, DistanceData } from '../services/LocationService';
import EncounterService from '../services/EncounterService';
import NotificationService from '../services/NotificationService';
import AnalyticsService from '../services/AnalyticsService';
import { dropActiveCombatItem, generateItem } from '../services/LootService';
import { Item } from '../models/Item';
import { resolveAutoCombat } from '../models/AutoCombat';
import { activeCombatXp } from '../models/combatRewards';
import { RewardReveal } from '../components/RewardRevealModal';
import {
  loadPendingEncounter,
  clearPendingEncounter,
  savePendingEncounter,
  appendWalkSummaryEntry,
  drainWalkSummary,
  WalkSummaryEntry,
  EncounterData,
} from '../utils/storage';
import { ENCOUNTER_CONFIG } from '../constants/config';
import {
  Ability,
  BuffDebuffAbility,
  CombatantState,
  StatusEffect,
  initCombatState,
  regenResource,
  resolveAbility,
  tickStatusEffects,
  computeEffectiveStats,
} from '../models/Ability';
import { applyResistance } from '../models/DamageType';
import { mitigateDamage } from '../models/combat';
import { classifyResist, formatStatModLabel, type CombatHitEvent } from '../models/CombatHitEvent';
import { resolveEncounterRoute } from '../models/encounterRouting';

interface UseEncounterParams {
  playerRef: MutableRefObject<Player | null>;
  setPlayerAndSave: (player: Player) => void;
  appStateRef: MutableRefObject<AppStateStatus>;
  currentLocationRef: MutableRefObject<LocationData | null>;
  // Idle-mode toggle (useAutoResolveSetting): a ref so the async GPS gate reads the live value, not
  // a stale closure. When true, below-rare foreground encounters auto-resolve instead of presenting.
  autoResolveBelowRareRef: MutableRefObject<boolean>;
}

// Delay between closing the combat/encounter modal and presenting the reward reveal. Two RN
// Modals can't animate simultaneously (iOS presents only one at a time), and the particle
// rarity "tell" must burst on a clear stage to be readable — so we wait for the combat modal's
// dismiss animation before revealing. Tuned to the Modal fade/slide (~300ms) with headroom.
const REWARD_REVEAL_DELAY_MS = 380;
// Kill-beat (Phase 2b): hold the combat modal open this long after the finishing blow so its FX
// (floating number + creature recoil + shake) plays before the victory teardown closes it.
const KILL_BEAT_MS = 500;
// Turn-based beat: after the player acts, wait this long before the creature counter-attacks (and
// its damage + red hit-flash land). An instant counter reads as simultaneous — and buries the
// player's own FX, so a buff/heal cast flashes red as if it self-damaged. Tunable.
const COUNTER_BEAT_MS = 550;

// Rarities notable enough to warrant a passive-victory notification while backgrounded. Common /
// uncommon drops are frequent, so notifying on them would be spam — they still appear in the
// on-return walk summary.
const NOTABLE_DROP_RARITIES = new Set<Rarity>(['rare', 'epic', 'legendary']);

export function useEncounter({
  playerRef,
  setPlayerAndSave,
  appStateRef,
  currentLocationRef,
  autoResolveBelowRareRef,
}: UseEncounterParams) {
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  const [showEncounterModal, setShowEncounterModal] = useState<boolean>(false);
  const [showCombatModal, setShowCombatModal] = useState<boolean>(false);
  const [isEncounterModalMinimized, setIsEncounterModalMinimized] = useState<boolean>(false);
  const [encounterChance, setEncounterChance] = useState<number>(0);
  const [lastEncounterChance, setLastEncounterChance] = useState<number | null>(null);
  const [isTimeBlocking, setIsTimeBlocking] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [bypassTimeConstraint, setBypassTimeConstraint] = useState<boolean>(false);
  const [forceItemDrop, setForceItemDrop] = useState<boolean>(false);
  // Debug-only: when set, forces the rarity of any drop (works alongside forceItemDrop to
  // guarantee a drop of that rarity). null = roll normally. See DebugPanel "Drop Rarity".
  const [forcedRarity, setForcedRarity] = useState<Rarity | null>(null);
  const [playerCombatState, setPlayerCombatState] = useState<CombatantState | null>(null);
  // Transient combat "hit" feed for the presentation layer (Phase 2b) — appended during a turn,
  // reset per encounter (startCombat) to bound growth. Ids are monotonic so CombatModal can process
  // by ascending id; this only PUBLISHES values the combat math already computed (no logic change).
  const [combatHits, setCombatHits] = useState<CombatHitEvent[]>([]);
  const hitIdRef = useRef(0);
  const [rewardReveal, setRewardReveal] = useState<RewardReveal | null>(null);
  // Non-null → the "while you walked" summary modal is shown for these passively-resolved
  // encounters. Populated by checkWalkSummary on app-foreground; cleared on dismiss.
  const [walkSummary, setWalkSummary] = useState<WalkSummaryEntry[] | null>(null);
  // Non-null → a held ELITE "worthy foe" is waiting; drives the inline WorthyFoeCard (NOT a modal,
  // so it never conflicts with the summary/reveal modals). Reflected from the pending-encounter
  // store by refreshHeldFoe; engageHeldFoe presents the turn-based fight on tap.
  const [heldFoe, setHeldFoe] = useState<Encounter | null>(null);
  // Authoritative refs — always current, used for synchronous reads inside handlers.
  // playerCombatStateRef replaces the old playerResourceRef pattern and extends it to
  // the full state so every handler sees post-last-ability values, not stale closures.
  const playerCombatStateRef = useRef<CombatantState | null>(null);
  const creatureCombatStateRef = useRef<CombatantState | null>(null);

  const victoryProcessedRef = useRef<boolean>(false);
  const fleeProcessedRef = useRef<boolean>(false);
  const isCheckingPendingEncounterRef = useRef<boolean>(false);
  const isCheckingWalkSummaryRef = useRef<boolean>(false);
  const encounterRef = useRef<Encounter | null>(null);
  const isMinimizedRef = useRef<boolean>(false);
  const showCombatModalRef = useRef<boolean>(false);
  // Holds the pending deferred reward reveal (see REWARD_REVEAL_DELAY_MS / handleVictory).
  const rewardRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Kill-beat timer + guard (see scheduleVictory / KILL_BEAT_MS). killBeatPendingRef freezes the
  // fight during the beat so a stray tap can't double-resolve before handleVictory runs.
  const killBeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const killBeatPendingRef = useRef<boolean>(false);
  // Counter-attack beat timer + guard (see scheduleCounterAttack / COUNTER_BEAT_MS). counterPendingRef
  // freezes input during the beat so a rapid tap can't take a second turn before the creature strikes.
  const counterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counterPendingRef = useRef<boolean>(false);

  useEffect(() => {
    encounterRef.current = currentEncounter;
  }, [currentEncounter]);

  useEffect(() => {
    isMinimizedRef.current = isEncounterModalMinimized;
  }, [isEncounterModalMinimized]);

  // Clear pending deferred timers (reward reveal + kill-beat) on unmount so neither can setState
  // after teardown.
  useEffect(() => {
    return () => {
      if (rewardRevealTimerRef.current) {
        clearTimeout(rewardRevealTimerRef.current);
      }
      if (killBeatTimerRef.current) {
        clearTimeout(killBeatTimerRef.current);
      }
      if (counterTimerRef.current) {
        clearTimeout(counterTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    showCombatModalRef.current = showCombatModal;
  }, [showCombatModal]);

  useEffect(() => {
    setEncounterChance(EncounterService.getDistanceBasedProbability());
    const blocking = EncounterService.isTimeConstraintBlocking();
    setIsTimeBlocking(blocking);
    setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
    setBypassTimeConstraint(EncounterService.isTimeConstraintBypassed());
  }, []);

  useEffect(() => {
    EncounterService.setBypassTimeConstraint(bypassTimeConstraint);
    const blocking = EncounterService.isTimeConstraintBlocking();
    setIsTimeBlocking(blocking);
    setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
  }, [bypassTimeConstraint]);

  useEffect(() => {
    if (!isTimeBlocking) {
      return;
    }

    const updateTimeRemaining = () => {
      const blocking = EncounterService.isTimeConstraintBlocking();
      const remaining = EncounterService.getTimeRemainingUntilEncounter();
      setIsTimeBlocking(blocking);
      setTimeRemaining(remaining);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [isTimeBlocking]);

  // Cancel any in-flight counter-attack beat: clear its timer and unfreeze input. Called on every
  // fight transition (flee, victory, teardown, and a fresh presentation) so a pending strike from the
  // previous fight can never land on — or lock input in — a new one.
  const cancelCounterBeat = (): void => {
    if (counterTimerRef.current) {
      clearTimeout(counterTimerRef.current);
      counterTimerRef.current = null;
    }
    counterPendingRef.current = false;
  };

  const clearEncounter = (): void => {
    encounterRef.current = null;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;
    playerCombatStateRef.current = null;
    creatureCombatStateRef.current = null;
    setCurrentEncounter(null);
    setShowEncounterModal(false);
    setShowCombatModal(false);
    setIsEncounterModalMinimized(false);
    setPlayerCombatState(null);
    setCombatHits([]);
    // Cancel any in-flight kill-beat so a torn-down fight (e.g. account switch) can't resolve its
    // victory into the new session (mirrors the reward-reveal cancel below).
    if (killBeatTimerRef.current) {
      clearTimeout(killBeatTimerRef.current);
      killBeatTimerRef.current = null;
    }
    killBeatPendingRef.current = false;
    // Cancel any in-flight counter-attack beat so a torn-down fight can't strike into the new session.
    cancelCounterBeat();
    // Clear any in-flight victory reveal — both an already-shown one AND a still-pending
    // deferred timer — so a previous account's reward can't fire/linger over the new session
    // after an account switch (clearEncounter runs then), even within REWARD_REVEAL_DELAY_MS.
    if (rewardRevealTimerRef.current) {
      clearTimeout(rewardRevealTimerRef.current);
      rewardRevealTimerRef.current = null;
    }
    setRewardReveal(null);
    // Drop any in-memory walk summary + held foe so a previous account's passive haul / worthy foe
    // can't linger over the new session (the persisted stores are per-account and wiped by
    // clearLocalPlayerData on account switch).
    setWalkSummary(null);
    setHeldFoe(null);
  };

  // Reflect the persisted "worthy foe" store into heldFoe state (drives the inline WorthyFoeCard).
  // Peek only — no modal, no clear — so it can run freely on foreground/mount alongside the walk
  // summary without any modal-stacking coordination (a card isn't a modal). engageHeldFoe presents
  // the fight on tap. Skips while an encounter is active (the store is cleared then, and we don't
  // want the card flashing over a fight).
  const refreshHeldFoe = async (): Promise<void> => {
    if (isCheckingPendingEncounterRef.current || encounterRef.current) {
      return;
    }
    isCheckingPendingEncounterRef.current = true;
    try {
      const pendingEncounterData = await loadPendingEncounter();
      if (pendingEncounterData) {
        const creature = new Creature(pendingEncounterData.creature);
        setHeldFoe(
          new Encounter({
            creature,
            location: pendingEncounterData.location,
            timestamp: pendingEncounterData.timestamp,
            playerLevel: pendingEncounterData.playerLevel,
            status: pendingEncounterData.status,
          }),
        );
      } else {
        setHeldFoe(null);
      }
    } catch (error) {
      console.error('Error refreshing held foe:', error);
    } finally {
      isCheckingPendingEncounterRef.current = false;
    }
  };

  // Engage the held "worthy foe" (WorthyFoeCard "Fight" tap): present it as the active turn-based
  // encounter. Deliberate user action, so no modal-stacking concern (the card sits behind any
  // modal; the player dismisses those to reach it). Clears the persisted hold FIRST so it can't be
  // re-surfaced as a card during/after the fight; only presents if the clear succeeded.
  const engageHeldFoe = async (): Promise<void> => {
    const encounter = heldFoe;
    if (!encounter || encounterRef.current) {
      return;
    }
    const cleared = await clearPendingEncounter();
    if (!cleared) {
      console.error('Failed to clear held foe; not engaging to avoid a duplicate');
      return;
    }
    encounterRef.current = encounter;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;
    victoryProcessedRef.current = false;
    fleeProcessedRef.current = false;
    setHeldFoe(null);
    setCurrentEncounter(encounter);
    setShowEncounterModal(true);
    setIsEncounterModalMinimized(false);
  };

  const handleVictory = (playerToUse?: Player): void => {
    const basePlayer = playerToUse || playerRef.current;
    const currentEncounterState = encounterRef.current;

    if (!currentEncounterState || !basePlayer) {
      return;
    }

    if (victoryProcessedRef.current) {
      return;
    }

    victoryProcessedRef.current = true;
    // Victory is now resolving — end the kill-beat here, whatever path reached handleVictory (the
    // beat timer, or a direct resolution). Clearing the guard/timer at the single resolution point
    // guarantees the pending flag can't outlive the fight and freeze the next encounter's inputs.
    if (killBeatTimerRef.current) {
      clearTimeout(killBeatTimerRef.current);
      killBeatTimerRef.current = null;
    }
    killBeatPendingRef.current = false;
    // Same for the counter beat — a resolved victory must not leave a strike pending for a later fight.
    cancelCounterBeat();

    const updatedPlayer = new Player(basePlayer.toJSON());
    updatedPlayer.defeatCreature();
    updatedPlayer.incrementEncounters();

    // Turn-based wins are elite fights (see the encounter gate) — apply the active-combat reward
    // differential: boosted XP + a higher drop chance + multiplier-scaled stat rolls. Passive
    // (walking) wins stay idle-tier, so stopping to fight a worthy foe is genuinely worth it.
    const expGain = activeCombatXp(currentEncounterState.creature.getExperienceReward());
    const levelsGained = updatedPlayer.addExperience(expGain);

    const droppedItem = dropActiveCombatItem(forceItemDrop, updatedPlayer.level, forcedRarity);
    let inventoryFull = false;
    let isUpgrade = false;
    if (droppedItem) {
      const inventoryIndex = updatedPlayer.addItemToInventory(droppedItem);
      inventoryFull = inventoryIndex === -1;
      // Upgrade hint for the reveal badge — single source of truth on the model, so it
      // always matches where equipItem would place the drop (see Player.wouldUpgrade).
      isUpgrade = updatedPlayer.wouldUpgrade(droppedItem);
      AnalyticsService.itemDropped(
        droppedItem.rarity,
        droppedItem.type,
        droppedItem.level,
        updatedPlayer.level,
      );
    }

    updatedPlayer.fullHeal();

    setPlayerAndSave(updatedPlayer);
    encounterRef.current = null;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;
    fleeProcessedRef.current = false;
    playerCombatStateRef.current = null;
    creatureCombatStateRef.current = null;
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setCurrentEncounter(null);
    setPlayerCombatState(null);

    AnalyticsService.combatVictory(
      currentEncounterState.creature.name,
      basePlayer.level,
      expGain,
      !!droppedItem,
      levelsGained > 0,
    );
    if (levelsGained > 0) {
      AnalyticsService.levelUp(updatedPlayer.level);
    }
    // Defer the reveal until the combat/encounter modal has finished dismissing (see
    // REWARD_REVEAL_DELAY_MS): presenting the reward Modal while the combat Modal is still
    // animating closed conflicts on iOS (two Modals at once) and buries the particle "tell"
    // under the closing modal. Capture the reward now; show it on a clear stage shortly after.
    const reveal: RewardReveal = {
      creatureName: currentEncounterState.creature.name,
      xpGained: expGain,
      leveledUp: levelsGained > 0,
      newLevel: updatedPlayer.level,
      item: droppedItem ?? null,
      isUpgrade,
      inventoryFull,
    };
    if (rewardRevealTimerRef.current) {
      clearTimeout(rewardRevealTimerRef.current);
    }
    rewardRevealTimerRef.current = setTimeout(() => {
      rewardRevealTimerRef.current = null;
      setRewardReveal(reveal);
    }, REWARD_REVEAL_DELAY_MS);
  };

  // Kill-beat (Phase 2b): keep the combat modal open through KILL_BEAT_MS so the finishing blow's
  // FX plays, then resolve the victory (handleVictory closes the modal + defers the reward reveal).
  // Freezes the fight immediately via killBeatPendingRef so a stray tap can't double-resolve during
  // the beat. Reward math stays in handleVictory; only its timing shifts by the beat. Torn-down mid-
  // beat (account switch) → clearEncounter cancels the timer; an early user close still resolves it
  // (handleCloseCombatModal only hides the modal, leaving encounterRef valid for handleVictory).
  const scheduleVictory = (playerToUse: Player): void => {
    if (victoryProcessedRef.current || killBeatPendingRef.current) return;
    killBeatPendingRef.current = true;
    if (killBeatTimerRef.current) clearTimeout(killBeatTimerRef.current);
    killBeatTimerRef.current = setTimeout(() => {
      killBeatTimerRef.current = null; // timer fired; handleVictory clears the pending guard
      showCombatModalRef.current = false;
      handleVictory(playerToUse);
    }, KILL_BEAT_MS);
  };

  // Hold an ELITE encounter as the "worthy foe": persist it. ALL elites (foreground and background)
  // route through here — the caller then presents it via checkPendingEncounter (one guarded
  // presentation path, so an elite modal never stacks over a reveal/summary and the "one foe at a
  // time" overflow rule applies uniformly). A notification is fired only when BACKGROUNDED (a
  // foreground elite is presented immediately, so it needs no notification).
  //
  // Returns whether the foe was HELD. Returns false when it couldn't be — a foe is already held
  // (overflow) or the save failed — so the caller resolves the encounter passively instead of
  // losing it (the roll was already consumed upstream). Notification failure does NOT unset the
  // hold (the foe is persisted regardless).
  const holdEliteEncounter = async (
    encounter: Encounter,
    isBackground: boolean,
  ): Promise<boolean> => {
    try {
      const existing = await loadPendingEncounter();
      if (existing) {
        return false;
      }
      const encounterData: EncounterData = {
        creature: {
          id: encounter.creature.id,
          name: encounter.creature.name,
          type: encounter.creature.type,
          level: encounter.creature.level,
          hp: encounter.creature.hp,
          maxHp: encounter.creature.maxHp,
          attack: encounter.creature.attack,
          defense: encounter.creature.defense,
          speed: encounter.creature.speed,
          rarity: encounter.creature.rarity,
          description: encounter.creature.description,
          encounterRate: encounter.creature.encounterRate,
        },
        location: encounter.location,
        timestamp: encounter.timestamp,
        playerLevel: encounter.playerLevel,
        status: encounter.status,
      };
      const saveSuccess = await savePendingEncounter(encounterData);
      if (!saveSuccess) {
        console.error('Failed to hold elite encounter');
        return false;
      }
      // Surface the inline "worthy foe" card immediately (in memory) — non-modal, so no
      // coordination needed. On a cold start from a backgrounded hold, refreshHeldFoe re-loads it.
      setHeldFoe(encounter);
      // Notify only when backgrounded (the player isn't looking); a foreground hold shows the card
      // right away. Best-effort — the foe is held whether or not this succeeds.
      if (isBackground) {
        try {
          await NotificationService.showEncounterNotification(encounter);
        } catch (error) {
          console.error('Elite held but notification failed:', error);
        }
      }
      return true;
    } catch (error) {
      console.error('Error holding elite encounter:', error);
      return false;
    }
  };

  // Resolve an encounter WITHOUT opening the turn-based screen — the walk is never interrupted.
  // Rewards are applied immediately (so they're never lost) and a display record is appended to the
  // walk summary shown on return. Two tiers:
  //  - 'idle' (default: walking / background) — a non-punishing auto-combat roll; a loss only pays a
  //    smaller XP share, never HP.
  //  - 'active' (foreground idle-mode toggle → resolveEncounterRoute 'autoResolve') — the SAME
  //    reward as fighting: auto-win + active XP + an active-tier drop (mirrors handleVictory), so
  //    skipping trivial content via the toggle costs the player nothing versus fighting it.
  const resolvePassiveEncounter = async (
    encounter: Encounter,
    isBackground: boolean,
    rewardTier: 'idle' | 'active' = 'idle',
  ): Promise<void> => {
    // Base rewards off the freshest player. setPlayerAndSave updates playerRef synchronously, so
    // playerRef.current already includes the distance just added this tick (handleDistanceUpdate
    // adds distance + saves BEFORE calling the encounter gate) — cloning the stale arg would
    // clobber that distance increment when we save the reward-updated player.
    const basePlayer = playerRef.current;
    if (!basePlayer) {
      return;
    }
    const creature = encounter.creature;

    let won: boolean;
    let xpGained: number;
    let item: Item | null;
    if (rewardTier === 'active') {
      // Same as a manual win (handleVictory), minus the turn-based fight. The active-tier drop is
      // rolled AFTER addExperience (below, off updatedPlayer.level) so a toggle auto-resolve that
      // levels you up scales its loot exactly like fighting the creature would.
      won = true;
      xpGained = activeCombatXp(creature.getExperienceReward());
      item = null;
    } else {
      const outcome = resolveAutoCombat(basePlayer.level, creature);
      won = outcome.won;
      xpGained = outcome.xpGained;
      item = outcome.item;
    }

    const updatedPlayer = new Player(basePlayer.toJSON());
    updatedPlayer.incrementEncounters();
    if (won) {
      updatedPlayer.defeatCreature();
    }
    const levelsGained = updatedPlayer.addExperience(xpGained);

    // Active-tier loot rolls at the post-XP level (mirrors handleVictory); idle-tier loot already
    // came from resolveAutoCombat above. No debug drop-forcing — that's a combat-only affordance.
    if (rewardTier === 'active') {
      item = dropActiveCombatItem(false, updatedPlayer.level, null);
    }

    if (item) {
      const inventoryIndex = updatedPlayer.addItemToInventory(item);
      if (inventoryIndex === -1) {
        // Inventory full — the drop is discarded. Record no item so the summary never promises
        // loot the player didn't actually receive.
        item = null;
      } else {
        AnalyticsService.itemDropped(item.rarity, item.type, item.level, updatedPlayer.level);
      }
    }
    // Passive combat never threatens HP, but keep the player topped up so a later stopped
    // turn-based fight always starts from full (matches handleVictory / handleFlee).
    updatedPlayer.fullHeal();
    setPlayerAndSave(updatedPlayer);

    if (levelsGained > 0) {
      AnalyticsService.levelUp(updatedPlayer.level);
    }

    const entry: WalkSummaryEntry = {
      creatureName: creature.name,
      rarity: creature.rarity,
      won,
      xpGained,
      item,
      timestamp: Date.now(),
    };
    await appendWalkSummaryEntry(entry);

    // Rare-or-better drop while the app is backgrounded → a light "nice surprise" notification.
    // Rare-only keeps it from becoming spam; the full haul is shown by the summary on foreground.
    if (isBackground && item && NOTABLE_DROP_RARITIES.has(item.rarity)) {
      try {
        await NotificationService.showPassiveVictoryNotification(creature.name, item.name);
      } catch {
        // Non-fatal — the reward is already applied and recorded in the summary.
      }
    }
  };

  // Drain the persisted walk-summary log and present it as the "while you walked" modal. Called on
  // app-foreground (HomeScreen), alongside checkPendingEncounter. Clears storage BEFORE showing so
  // a crash mid-present can't double-show; rewards were already applied when each entry was written,
  // so a lost summary is cosmetic only.
  const checkWalkSummary = async (): Promise<void> => {
    if (isCheckingWalkSummaryRef.current) {
      return;
    }
    // Blockers the summary must never cover (two RN Modals conflict on iOS — see
    // REWARD_REVEAL_DELAY_MS): an active encounter; a victory reward reveal, showing OR still
    // pending on its deferred timer; or an already-open summary (replacing it would hide fights the
    // player hasn't seen). Checked HERE (not just at call sites) so every caller is protected.
    const blocked = () =>
      !!encounterRef.current || !!rewardReveal || !!rewardRevealTimerRef.current || !!walkSummary;
    if (blocked()) {
      return;
    }
    isCheckingWalkSummaryRef.current = true;
    try {
      // Atomic read+clear, serialized against passive appends (see drainWalkSummary) so a
      // concurrent fight can't be wiped between the read and the clear.
      const entries = await drainWalkSummary();
      if (entries.length === 0) {
        return;
      }
      // A blocker (encounter / reward reveal / already-open summary) can appear during the async
      // drain. Storage is already cleared, so re-append the entries rather than lose them — they
      // surface on the next drain once the blocker clears, instead of stacking a modal now.
      if (blocked()) {
        for (const entry of entries) {
          await appendWalkSummaryEntry(entry);
        }
        return;
      }
      setWalkSummary(entries);
    } catch (error) {
      console.error('Error checking walk summary:', error);
    } finally {
      isCheckingWalkSummaryRef.current = false;
    }
  };

  const dismissWalkSummary = (): void => setWalkSummary(null);

  // Re-attempt a skipped summary drain when a blocker clears. checkWalkSummary self-guards against
  // an active encounter, a reward reveal, and an already-open summary, so this only needs to
  // re-invoke it when the encounter or reveal presence changes (e.g. a reveal was just dismissed).
  useEffect(() => {
    checkWalkSummary();
    // Re-attempt the drain when a blocker clears: an encounter or reward reveal resolving, OR the
    // summary being DISMISSED (walkSummary → null) — passive fights can append while the modal is
    // open (walking-and-looking, or backgrounded), so on dismiss we drain what accumulated instead
    // of leaving it until the next foreground. checkWalkSummary is intentionally omitted from deps:
    // it's recreated each render, so including it would run the drain (an AsyncStorage read) every
    // render; checkWalkSummary self-guards and reads fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEncounter, rewardReveal, walkSummary]);

  const handleFlee = (): void => {
    if (fleeProcessedRef.current) {
      return;
    }

    fleeProcessedRef.current = true;
    // Fleeing ends the fight — cancel any pending counter so it can't strike into the next encounter.
    cancelCounterBeat();

    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;

    encounterRef.current = null;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;

    if (currentEncounterState && currentPlayer) {
      AnalyticsService.combatFled(currentEncounterState.creature.name, currentPlayer.level);
      const updatedPlayer = new Player(currentPlayer.toJSON());
      updatedPlayer.incrementEncounters();
      updatedPlayer.fullHeal();
      setPlayerAndSave(updatedPlayer);
    }
    playerCombatStateRef.current = null;
    creatureCombatStateRef.current = null;
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setCurrentEncounter(null);
    setPlayerCombatState(null);
    // Reset the hit feed on flee too (like clearEncounter / the next handleFight) so no events
    // linger past this fight — keeps every combat-teardown path consistent.
    setCombatHits([]);
  };

  const handleFight = (): void => {
    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;

    if (!currentEncounterState || !currentPlayer) {
      return;
    }

    if (currentPlayer.isDefeated()) {
      return;
    }

    const creature = currentEncounterState.creature;

    if (creature.isDefeated()) {
      handleVictory();
      return;
    }

    showCombatModalRef.current = true;
    setShowCombatModal(true);
    // Only initialize once per encounter — preserves accumulated resource/status
    // if the player closes and reopens the combat modal within the same encounter.
    // Ref update is synchronous so handleAbility guards are correct before first render.
    if (playerCombatStateRef.current === null) {
      const initialState = initCombatState(currentPlayer.archetype);
      playerCombatStateRef.current = initialState;
      setPlayerCombatState(initialState);
      // Fresh hit feed for this fight (only on the first open — reopening mid-encounter keeps state).
      setCombatHits([]);
    }
    if (creatureCombatStateRef.current === null) {
      creatureCombatStateRef.current = { statusEffects: [], resource: 0 };
    }
    AnalyticsService.combatStarted(creature.name, currentPlayer.level);
  };

  // Publish a transient combat hit for the presentation layer (Phase 2b). Monotonic id; React
  // batches the per-turn calls into one update. Never mutates combat state.
  const pushHit = (event: Omit<CombatHitEvent, 'id'>): void => {
    setCombatHits(prev => [...prev, { ...event, id: hitIdRef.current++ }]);
  };

  // The player was defeated (by a counter-attack): restore to full, tear the fight down, notify.
  const handlePlayerDefeat = (defeatedPlayer: Player, creature: Creature): void => {
    const healedPlayer = new Player(defeatedPlayer.toJSON());
    healedPlayer.fullHeal();
    healedPlayer.incrementEncounters();

    setPlayerAndSave(healedPlayer);
    encounterRef.current = null;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;
    playerCombatStateRef.current = null;
    creatureCombatStateRef.current = null;
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setCurrentEncounter(null);
    setPlayerCombatState(null);
    AnalyticsService.combatDefeated(creature.name, defeatedPlayer.level);

    Alert.alert(
      'Defeated!',
      'You have been defeated! Your HP has been restored to full.',
      [{ text: 'OK' }],
      { cancelable: false },
    );
  };

  // Turn-based beat: the creature counter-attacks COUNTER_BEAT_MS AFTER the player acts, not in the
  // same frame — so the exchange reads as "player acts → beat → creature strikes" and the player's
  // own FX (a buff/heal cast) is never overlapped by the red hit-flash. Input is frozen during the
  // beat (counterPendingRef) so a rapid tap can't take a second turn before the creature responds.
  // Only called when the creature SURVIVED the player's action (a defeated one can't strike back).
  const scheduleCounterAttack = (
    playerAfterAction: Player,
    creatureAttack: number,
    playerDefense: number,
    creature: Creature,
  ): void => {
    if (counterPendingRef.current) {
      return;
    }
    counterPendingRef.current = true;
    if (counterTimerRef.current) {
      clearTimeout(counterTimerRef.current);
    }
    // Pin the exact fight this counter belongs to. If it's cleared or replaced during the beat
    // (flee, teardown, or a new encounter presented), the strike must NOT land on a different fight
    // — a non-null encounterRef isn't enough, since it could be a *new* one.
    const scheduledEncounter = encounterRef.current;
    counterTimerRef.current = setTimeout(() => {
      counterTimerRef.current = null;
      counterPendingRef.current = false;
      if (encounterRef.current !== scheduledEncounter) {
        return;
      }

      const creatureDamage = mitigateDamage(creatureAttack, playerDefense);
      if (creatureDamage > 0) {
        playerAfterAction.takeDamage(creatureDamage);
        // Basic counter is physical; the player has no resistances yet, so it's always neutral.
        pushHit({
          target: 'player',
          amount: creatureDamage,
          damageType: 'physical',
          resist: 'neutral',
          kind: 'hit',
          targetMaxHp: playerAfterAction.maxHp,
        });
        setPlayerAndSave(playerAfterAction);
      }

      if (playerAfterAction.isDefeated()) {
        handlePlayerDefeat(playerAfterAction, creature);
      }
    }, COUNTER_BEAT_MS);
  };

  const handleAbility = (ability: Ability): boolean => {
    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;
    // Read from ref — always the post-last-ability state, never a stale closure snapshot.
    const currentPlayerState = playerCombatStateRef.current;

    if (!currentEncounterState || !currentPlayer || !currentPlayerState) return false;
    if (victoryProcessedRef.current || killBeatPendingRef.current || counterPendingRef.current)
      return false;

    const creature = currentEncounterState.creature;

    if (creature.isDefeated()) {
      handleVictory();
      showCombatModalRef.current = false;
      setShowCombatModal(false);
      return false;
    }

    // Synchronous resource check: ref value is updated immediately on each ability use.
    if (ability.resourceCost > currentPlayerState.resource) return false;

    const updatedPlayer = new Player(currentPlayer.toJSON());

    // Effective stats from PRE-tick state — buffs expiring this turn still apply.
    const playerEffective = computeEffectiveStats(
      updatedPlayer.attack,
      updatedPlayer.defense,
      currentPlayerState.statusEffects,
    );

    // Snapshot PRE-tick creature state so debuffs expiring this turn still apply to
    // effective stat computation (symmetric with player buff pre-tick above).
    const preTickCreatureState = creatureCombatStateRef.current;

    // Tick creature DoT effects with per-type resistance applied.
    let newCreatureState = preTickCreatureState;
    if (newCreatureState && newCreatureState.statusEffects.length > 0) {
      const { dotEffects, updatedState } = tickStatusEffects(newCreatureState);
      let resistedDot = 0;
      for (const { damage, damageType } of dotEffects) {
        const resistVal = damageType ? (creature.resistances[damageType] ?? 0) : 0;
        const dealt = applyResistance(damage, resistVal);
        resistedDot += dealt;
        if (dealt > 0) {
          pushHit({
            target: 'creature',
            amount: dealt,
            damageType: damageType ?? null,
            resist: classifyResist(resistVal),
            kind: 'dot',
            targetMaxHp: creature.maxHp,
          });
        }
      }
      if (resistedDot > 0) creature.takeDamage(resistedDot);
      newCreatureState = updatedState;
    }

    // DoT killed creature — persist player tick even though the ability never ran.
    if (creature.isDefeated()) {
      const tickedPlayer =
        currentPlayerState.statusEffects.length > 0
          ? tickStatusEffects(currentPlayerState).updatedState
          : currentPlayerState;
      playerCombatStateRef.current = tickedPlayer;
      setPlayerCombatState(tickedPlayer);
      creatureCombatStateRef.current = newCreatureState;
      // Kill-beat: the DoT tick delivered the finishing blow — let its number land before teardown.
      scheduleVictory(updatedPlayer);
      return false;
    }

    // Use PRE-tick creature state so debuffs give their full labeled duration.
    const creatureEffectiveDefense = computeEffectiveStats(
      0,
      creature.defense,
      preTickCreatureState?.statusEffects ?? [],
    ).defense;
    const creatureEffectiveAttack = computeEffectiveStats(
      creature.attack,
      0,
      preTickCreatureState?.statusEffects ?? [],
    ).attack;

    const abilityResult = resolveAbility(
      ability,
      playerEffective.attack,
      creatureEffectiveDefense,
      creature.resistances,
      updatedPlayer.maxHp,
    );

    creature.takeDamage(abilityResult.damage);
    if (abilityResult.damage > 0) {
      // Only 'direct' abilities deal immediate typed damage (dot/buff/defensive have 0 here).
      const dmgType = ability.primitive === 'direct' ? ability.damageType : null;
      const resistVal = dmgType ? (creature.resistances[dmgType] ?? 0) : 0;
      pushHit({
        target: 'creature',
        amount: abilityResult.damage,
        damageType: dmgType,
        resist: classifyResist(resistVal),
        kind: 'hit',
        targetMaxHp: creature.maxHp,
      });
    }
    if (abilityResult.heal > 0) {
      updatedPlayer.restoreHp(abilityResult.heal);
      pushHit({
        target: 'player',
        amount: abilityResult.heal,
        damageType: null,
        resist: 'neutral',
        kind: 'heal',
        targetMaxHp: updatedPlayer.maxHp,
      });
    }

    // Route applied effects to the right combatant.
    const selfEffects: StatusEffect[] = [];
    const enemyEffects: StatusEffect[] = [];
    for (const effect of abilityResult.appliedEffects) {
      if (ability.primitive === 'buff_debuff' && (ability as BuffDebuffAbility).targetSelf) {
        selfEffects.push(effect);
      } else {
        enemyEffects.push(effect);
      }
    }

    // Publish a buff/debuff cue (Phase-2 follow-up): a status cast deals no damage, so without its
    // own event the only visible FX would be the enemy's counter — misreading as "the buff hurt me".
    // A self-buff empowers the player; a debuff weakens the creature. `label` carries the stat change.
    if (ability.primitive === 'buff_debuff') {
      const buffAbility = ability as BuffDebuffAbility;
      const toSelf = buffAbility.targetSelf;
      pushHit({
        target: toSelf ? 'player' : 'creature',
        amount: 0,
        damageType: null,
        resist: 'neutral',
        kind: toSelf ? 'buff' : 'debuff',
        targetMaxHp: toSelf ? updatedPlayer.maxHp : creature.maxHp,
        label: formatStatModLabel(buffAbility.statModifiers),
      });
    }

    // Compute new player state synchronously from the ref and write back immediately.
    // Rapid-tap sequences read the already-updated ref on the next tap rather than a
    // stale closure snapshot, so resource deductions and buff durations are always correct.
    const archetype = updatedPlayer.archetype;
    const { updatedState: tickedPlayer } =
      currentPlayerState.statusEffects.length > 0
        ? tickStatusEffects(currentPlayerState)
        : { updatedState: currentPlayerState };
    const afterCost = {
      ...tickedPlayer,
      resource: Math.max(0, tickedPlayer.resource - ability.resourceCost),
    };
    const regenedState = regenResource(afterCost, archetype);
    const newPlayerState: CombatantState =
      selfEffects.length > 0
        ? { ...regenedState, statusEffects: [...regenedState.statusEffects, ...selfEffects] }
        : regenedState;
    playerCombatStateRef.current = newPlayerState;
    setPlayerCombatState(newPlayerState);

    // Compute new creature state synchronously.
    const creatureBase = newCreatureState ?? { statusEffects: [], resource: 0 };
    const newCreatureStateFinal: CombatantState =
      enemyEffects.length > 0
        ? { ...creatureBase, statusEffects: [...creatureBase.statusEffects, ...enemyEffects] }
        : creatureBase;
    creatureCombatStateRef.current = newCreatureStateFinal;

    // Apply the player's action NOW (creature damage above, heal/buff, resource spend) and show the
    // creature's new HP — but the creature does NOT counter yet. An instant counter reads as
    // simultaneous and overlaps the player's own FX; instead it strikes back after a beat.
    setPlayerAndSave(updatedPlayer);

    const updatedEncounter = new Encounter({
      creature,
      location: currentEncounterState.location,
      timestamp: currentEncounterState.timestamp,
      playerLevel: currentEncounterState.playerLevel,
      status: currentEncounterState.status,
    });

    encounterRef.current = updatedEncounter;
    setCurrentEncounter(updatedEncounter);

    if (creature.isDefeated()) {
      // Kill-beat: the encounter above already shows the creature at 0 HP; keep the modal open so
      // the finishing blow's FX plays, then resolve the victory (which closes it + reveals reward).
      // A defeated creature can't counter, so this stays immediate.
      scheduleVictory(updatedPlayer);
    } else {
      // Creature survives → it counter-attacks after a beat (its damage + red flash land then). The
      // player-defeat check moves there too, since the player's HP isn't reduced until the strike.
      scheduleCounterAttack(
        updatedPlayer,
        creatureEffectiveAttack,
        playerEffective.defense,
        creature,
      );
    }

    return true;
  };

  const handleDebugDefeat = (): void => {
    const currentEncounterState = encounterRef.current;
    const currentPlayer = playerRef.current;

    if (!currentEncounterState || !currentPlayer) {
      return;
    }

    if (victoryProcessedRef.current) {
      return;
    }

    const creature = currentEncounterState.creature;

    if (creature.isDefeated()) {
      return;
    }

    creature.takeDamage(creature.hp);

    const updatedEncounter = new Encounter({
      creature,
      location: currentEncounterState.location,
      timestamp: currentEncounterState.timestamp,
      playerLevel: currentEncounterState.playerLevel,
      status: currentEncounterState.status,
    });

    encounterRef.current = updatedEncounter;
    setCurrentEncounter(updatedEncounter);

    showCombatModalRef.current = false;
    setShowCombatModal(false);
    setShowEncounterModal(false);
    handleVictory(currentPlayer);
  };

  const handleMinimize = (): void => {
    isMinimizedRef.current = true;
    setIsEncounterModalMinimized(true);
    setShowEncounterModal(false);
  };

  const handleCloseCombatModal = (): void => {
    showCombatModalRef.current = false;
    setShowCombatModal(false);
  };

  const handleExpandMinimized = (): void => {
    isMinimizedRef.current = false;
    setIsEncounterModalMinimized(false);
    setShowEncounterModal(true);
  };

  // Present an encounter as an ACTIVE, engageable fight (opens the EncounterModal). Shared by the
  // foreground gate and forceEncounter; resets the combat/flow refs so the fresh encounter is clean.
  const presentEncounter = (encounter: Encounter): void => {
    encounterRef.current = encounter;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;
    victoryProcessedRef.current = false;
    fleeProcessedRef.current = false;
    // A fresh fight starts clean — cancel any counter beat still pending from a previous encounter.
    cancelCounterBeat();
    playerCombatStateRef.current = null;
    creatureCombatStateRef.current = null;
    setPlayerCombatState(null);
    setCurrentEncounter(encounter);
    setShowEncounterModal(true);
    setIsEncounterModalMinimized(false);
  };

  // Auto-Resolve (skip) a below-rare encounter: grant the SAME active-tier reward as fighting via
  // handleVictory, minus the turn-based fight. Elites are never auto-resolvable (the button is hidden
  // for them; guarded here too), so meaningful content still has to be engaged.
  const handleAutoResolve = (): void => {
    const currentPlayer = playerRef.current;
    const enc = encounterRef.current;
    if (!currentPlayer || !enc || isEliteCreature(enc.creature)) {
      return;
    }
    showCombatModalRef.current = false;
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setIsEncounterModalMinimized(false);
    handleVictory(currentPlayer);
  };

  const forceEncounter = (): void => {
    const currentLocationData = currentLocationRef.current;
    const currentPlayer = playerRef.current;

    const location: Location = currentLocationData
      ? {
          latitude: currentLocationData.latitude,
          longitude: currentLocationData.longitude,
        }
      : {
          latitude: 37.7749,
          longitude: -122.4194,
        };

    const encounter = EncounterService.forceEncounter(location, currentPlayer?.level || 1);

    presentEncounter(encounter);
    setEncounterChance(0);
    const blocking = EncounterService.isTimeConstraintBlocking();
    setIsTimeBlocking(blocking);
    setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
  };

  // ─── Debug-only encounter-routing helpers (DebugPanel, gated by enableDebugMode) ───
  // Unlike forceEncounter (which BYPASSES the gate straight to the turn-based modal), these route a
  // rarity-forced encounter through the REAL logic so debug behaves exactly like production: a
  // common → passive auto-resolve (walk summary), an elite → held "worthy foe" card.
  const debugEncounterContext = (): { location: Location; level: number } => {
    const loc = currentLocationRef.current;
    const location: Location = loc
      ? { latitude: loc.latitude, longitude: loc.longitude }
      : { latitude: 37.7749, longitude: -122.4194 };
    return { location, level: playerRef.current?.level ?? 1 };
  };

  const debugForceIdleEncounter = (rarity: Rarity = 'common'): void => {
    const { location, level } = debugEncounterContext();
    const encounter = EncounterService.forceEncounter(location, level, rarity);
    // Real passive path (foreground): applies idle-tier rewards + appends to the walk summary.
    resolvePassiveEncounter(encounter, false).catch(e =>
      console.error('debug passive encounter failed:', e),
    );
  };

  const debugForceEliteEncounter = (rarity: Rarity = 'rare'): void => {
    const { location, level } = debugEncounterContext();
    const encounter = EncounterService.forceEncounter(location, level, rarity);
    // Real hold path (foreground): surfaces the "worthy foe" card. Mirror the production gate — if
    // the elite can't be held (one is already held, or the save failed), fall back to a passive
    // resolution so the forced encounter is never silently dropped.
    holdEliteEncounter(encounter, false)
      .then(held => (held ? undefined : resolvePassiveEncounter(encounter, false)))
      .catch(e => console.error('debug elite encounter failed:', e));
  };

  const debugSimulateWalk = async (count: number = 5): Promise<void> => {
    // Fire N common passive resolutions to build a multi-entry walk summary. AWAIT each one so the
    // runs are strictly sequential: resolvePassiveEncounter reads playerRef and setPlayerAndSave
    // updates it, so awaiting lets rewards compound off the prior result and serializes the storage
    // saves (player + summary append). Firing them in parallel would leave the saves racing to land
    // in order — the sequential form matches how a real walk resolves one encounter at a time.
    for (let i = 0; i < count; i++) {
      // Re-read the context each iteration: an awaited resolution can level the player, and
      // production spawns every encounter at the CURRENT level (the gate reads playerRef.current
      // each tick), so later encounters must scale to the just-updated level, not a stale snapshot.
      const { location, level } = debugEncounterContext();
      const encounter = EncounterService.forceEncounter(location, level, 'common');
      try {
        await resolvePassiveEncounter(encounter, false);
      } catch (e) {
        console.error('debug passive encounter failed:', e);
      }
    }
  };

  const debugShowWalkSummary = (): void => {
    checkWalkSummary().catch(e => console.error('debug show walk summary failed:', e));
  };

  const onDistanceEncounterUpdate = async (
    distanceData: DistanceData,
    currentPlayer: Player | null,
  ): Promise<void> => {
    const { location } = distanceData;

    const currentEncounterState = encounterRef.current;
    const isMinimized = isMinimizedRef.current;
    const isInCombat = showCombatModalRef.current;

    if (currentEncounterState && isMinimized && location && !isInCombat) {
      const encounterLocation = currentEncounterState.location;
      const distanceFromEncounter = LocationService.calculateDistance(
        encounterLocation.latitude,
        encounterLocation.longitude,
        location.latitude,
        location.longitude,
      );

      if (distanceFromEncounter > ENCOUNTER_CONFIG.AUTO_FLEE_DISTANCE) {
        Alert.alert(
          'Encounter Ended',
          `You traveled too far from the encounter location. The ${currentEncounterState.creature.name} has fled.`,
          [{ text: 'OK' }],
        );
        handleFlee();
        return;
      }
    }

    if (currentEncounterState) {
      return;
    }

    if (location) {
      const locationForEncounter: Location = {
        latitude: location.latitude,
        longitude: location.longitude,
      };

      const probabilityThatWillBeUsed = EncounterService.getProbabilityAfterIncremental(
        distanceData.incremental,
      );

      // Only roll for an encounter when a player is loaded to receive it. processDistanceUpdate
      // consumes the roll and resets encounter pacing, so calling it without a player (e.g. tracking
      // resumed during the startup window before the player finishes loading) would generate an
      // encounter that resolvePassiveEncounter then drops for lack of a player — silently losing the
      // roll. Skipping leaves the roll (and pacing) intact until the player is present.
      const encounter = currentPlayer
        ? EncounterService.processDistanceUpdate(
            distanceData,
            locationForEncounter,
            currentPlayer.level,
          )
        : null;

      if (encounter) {
        AnalyticsService.encounterTriggered(
          encounter.creature.name,
          encounter.creature.level,
          encounter.playerLevel,
        );
        const isInBackground = appStateRef.current !== 'active';
        // Hybrid idle/active gate (resolveEncounterRoute). Only reached when NO encounter is already
        // active — the `if (currentEncounterState) return` guard above bails while one is open or
        // minimized, so overlapping rolls are simply skipped (pacing preserved), never double-stacked.
        //  - FOREGROUND → present EVERY encounter as an engageable fight, UNLESS the player has
        //    idle-mode on (the "auto-resolve below-rare" toggle): then below-rare encounters
        //    auto-resolve at active-tier reward into the summary. Elites always require a fight.
        //  - BACKGROUND → hold elites as worthy foes (card + notify), idle-resolve below-rare.
        const route = resolveEncounterRoute({
          isBackground: isInBackground,
          isElite: isEliteCreature(encounter.creature),
          autoResolveBelowRare: autoResolveBelowRareRef.current,
        });
        if (route === 'present') {
          presentEncounter(encounter);
        } else if (route === 'autoResolve') {
          // Idle-mode toggle: auto-resolve a below-rare foreground encounter at ACTIVE reward (same
          // as fighting it) into the walk summary — no modal interrupts the walk.
          await resolvePassiveEncounter(encounter, isInBackground, 'active');
        } else if (route === 'hold') {
          // If it can't be held (a foe is already held, or the save failed), resolve it passively so
          // the encounter isn't lost.
          const held = await holdEliteEncounter(encounter, isInBackground);
          if (!held) {
            await resolvePassiveEncounter(encounter, isInBackground);
          }
        } else {
          // resolvePassiveEncounter reads playerRef and no-ops if no player is loaded yet.
          await resolvePassiveEncounter(encounter, isInBackground);
        }

        setEncounterChance(0);
        setLastEncounterChance(probabilityThatWillBeUsed);
        const blocking = EncounterService.isTimeConstraintBlocking();
        setIsTimeBlocking(blocking);
        setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
      } else {
        setEncounterChance(EncounterService.getDistanceBasedProbability());
        const blocking = EncounterService.isTimeConstraintBlocking();
        setIsTimeBlocking(blocking);
        setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
      }
    } else {
      setEncounterChance(EncounterService.getDistanceBasedProbability());
      const blocking = EncounterService.isTimeConstraintBlocking();
      setIsTimeBlocking(blocking);
      setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
    }
  };

  const dismissReward = (): void => setRewardReveal(null);

  // Debug-only: show the reward reveal for a synthetic drop at a chosen rarity (null = roll),
  // with NO combat and NO inventory/player mutation — purely to iterate the reveal's feel. The
  // upgrade badge is computed against the real player so the preview is representative.
  const debugPreviewReveal = (rarity: Rarity | null): void => {
    // Cancel any deferred victory reveal so it can't fire ~REWARD_REVEAL_DELAY_MS later and
    // clobber this preview (e.g. previewing right after a real win).
    if (rewardRevealTimerRef.current) {
      clearTimeout(rewardRevealTimerRef.current);
      rewardRevealTimerRef.current = null;
    }
    const level = playerRef.current?.level ?? 1;
    const item = generateItem(level, rarity ?? undefined);
    setRewardReveal({
      creatureName: 'Preview',
      xpGained: 0,
      leveledUp: false,
      newLevel: level,
      item,
      isUpgrade: playerRef.current?.wouldUpgrade(item) ?? false,
      inventoryFull: false,
    });
  };

  return {
    currentEncounter,
    showEncounterModal,
    setShowEncounterModal,
    showCombatModal,
    setShowCombatModal,
    isEncounterModalMinimized,
    setIsEncounterModalMinimized,
    encounterChance,
    lastEncounterChance,
    isTimeBlocking,
    timeRemaining,
    bypassTimeConstraint,
    setBypassTimeConstraint,
    forceItemDrop,
    setForceItemDrop,
    forcedRarity,
    setForcedRarity,
    debugPreviewReveal,
    playerCombatState,
    playerCombatStateRef,
    combatHits,
    rewardReveal,
    dismissReward,
    walkSummary,
    checkWalkSummary,
    dismissWalkSummary,
    heldFoe,
    refreshHeldFoe,
    engageHeldFoe,
    handleFight,
    handleAbility,
    handleDebugDefeat,
    handleMinimize,
    handleCloseCombatModal,
    handleExpandMinimized,
    handleFlee,
    handleAutoResolve,
    forceEncounter,
    debugForceIdleEncounter,
    debugForceEliteEncounter,
    debugSimulateWalk,
    debugShowWalkSummary,
    onDistanceEncounterUpdate,
    clearEncounter,
  };
}
