import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { MOTION_EASING, MOTION_SHAKE } from '../constants/motion';
import { hitFloaterStyle } from '../utils/combatText';
import type { CombatFloater } from '../components/combat/FloatingCombatText';
import type { CombatBurst } from '../components/combat/CombatFxCanvas';
import type { CombatHitEvent } from '../models/CombatHitEvent';

/**
 * Turns the combat hit-event feed (graphics roadmap Phase 2b) into impact FX: a typed floating
 * number per hit (color = damage type, tell = RESIST/WEAK, size = magnitude), a hit-flash on the
 * struck panel, a modal shake, and a hurt-punch on the creature panel. Events are processed exactly
 * once, by ascending id — the feed is append-only and reset per encounter upstream (useEncounter),
 * so on an encounter change we also drop any floaters still animating from the previous fight.
 *
 * This supersedes 2a's derive-from-HP-deltas approach: the event carries damage TYPE + resist that
 * HP deltas couldn't, and it emits at the moment of the hit (so, unlike 2a, the killing blow lands
 * an event — the kill-beat in useEncounter keeps the modal open long enough to show it).
 */

const FLASH_MAX_OPACITY = 0.35;
const FLASH_UP_MS = 60;
const FLASH_DOWN_MS = 200;
/** A hit worth this fraction of max HP produces a full-strength shake. */
const SHAKE_FULL_AT_FRACTION = 0.25;
const FLOATER_DX_SPREAD = 18; // ± horizontal jitter (px)
const RECOIL_SCALE = 0.94; // creature panel compresses when struck
const RECOIL_DOWN_MS = 70;
const RECOIL_UP_MS = 160;

function triggerFlash(flash: SharedValue<number>): void {
  flash.value = withSequence(
    withTiming(1, { duration: FLASH_UP_MS }),
    withTiming(0, { duration: FLASH_DOWN_MS, easing: MOTION_EASING.standard }),
  );
}

function triggerShake(shake: SharedValue<number>, amount: number, maxHp: number): void {
  const intensity = maxHp > 0 ? Math.min(1, amount / (maxHp * SHAKE_FULL_AT_FRACTION)) : 0.5;
  const mag =
    MOTION_SHAKE.baseMagnitude +
    (MOTION_SHAKE.maxMagnitude - MOTION_SHAKE.baseMagnitude) * intensity;
  const leg = { duration: MOTION_SHAKE.legMs };
  shake.value = withSequence(
    withTiming(-mag, leg),
    withTiming(mag, leg),
    withTiming(-mag * 0.5, leg),
    withTiming(0, leg),
  );
}

function triggerRecoil(scale: SharedValue<number>): void {
  scale.value = withSequence(
    withTiming(RECOIL_SCALE, { duration: RECOIL_DOWN_MS }),
    withTiming(1, { duration: RECOIL_UP_MS, easing: MOTION_EASING.standard }),
  );
}

const EMPOWER_SCALE = 1.08; // a status cast POPS the panel UP (vs the hurt recoil punching it down)
function triggerEmpower(scale: SharedValue<number>): void {
  scale.value = withSequence(
    withTiming(EMPOWER_SCALE, { duration: 110 }),
    withTiming(1, { duration: 230, easing: MOTION_EASING.standard }),
  );
}

export interface UseCombatImpactParams {
  /** Encounter identity — a change drops floaters left animating from the previous fight. */
  encounterId: number | null;
  /** Append-only combat hit feed from useEncounter; processed once, by ascending id. */
  hits: CombatHitEvent[];
}

export function useCombatImpact({ encounterId, hits }: UseCombatImpactParams) {
  const [floaters, setFloaters] = useState<CombatFloater[]>([]);
  const [bursts, setBursts] = useState<CombatBurst[]>([]);
  const nextFloaterIdRef = useRef(0);
  const nextBurstIdRef = useRef(0);
  const lastSeenHitIdRef = useRef(-1);
  const fxEncounterRef = useRef<number | null>(null);

  const creatureFlash = useSharedValue(0);
  const playerFlash = useSharedValue(0);
  const shake = useSharedValue(0);
  const creatureScale = useSharedValue(1);
  const playerScale = useSharedValue(1);

  const creatureFlashStyle = useAnimatedStyle(() => ({
    opacity: creatureFlash.value * FLASH_MAX_OPACITY,
  }));
  const playerFlashStyle = useAnimatedStyle(() => ({
    opacity: playerFlash.value * FLASH_MAX_OPACITY,
  }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const creatureRecoilStyle = useAnimatedStyle(() => ({
    transform: [{ scale: creatureScale.value }],
  }));
  const playerRecoilStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playerScale.value }],
  }));

  const removeFloater = useCallback((id: number) => {
    setFloaters(list => list.filter(f => f.id !== id));
  }, []);
  const removeBurst = useCallback((id: number) => {
    setBursts(list => list.filter(b => b.id !== id));
  }, []);

  useEffect(() => {
    // Clear leftover FX when the fight changes (CombatModal stays mounted across encounters).
    if (fxEncounterRef.current !== encounterId) {
      fxEncounterRef.current = encounterId;
      setFloaters([]);
      setBursts([]);
    }

    const fresh = hits.filter(h => h.id > lastSeenHitIdRef.current);
    if (fresh.length === 0) return;
    lastSeenHitIdRef.current = fresh[fresh.length - 1].id; // ids are monotonic → last is the max

    const spawned: CombatFloater[] = fresh.map(h => {
      const style = hitFloaterStyle(h);
      return {
        id: nextFloaterIdRef.current++,
        target: h.target,
        label: style.label,
        color: style.color,
        fontSize: style.fontSize,
        dx: (Math.random() * 2 - 1) * FLOATER_DX_SPREAD,
      };
    });
    setFloaters(list => [...list, ...spawned]);

    const spawnedBursts: CombatBurst[] = [];
    for (const h of fresh) {
      if (h.kind === 'heal') continue; // heal shows its green floater above; no burst/flash

      if (h.kind === 'buff' || h.kind === 'debuff') {
        // Empower/weaken cue — deliberately NOT a hit: no shake, no red flash, no impact burst, so
        // a status cast never reads as damage. The panel pops and a gold/violet burst plays.
        triggerEmpower(h.target === 'creature' ? creatureScale : playerScale);
        spawnedBursts.push({
          id: nextBurstIdRef.current++,
          target: h.target,
          damageType: null,
          resist: h.resist,
          kind: h.kind,
        });
        continue;
      }

      // A full dodge deals no damage — show only the "DODGE"/"MISS" floater (spawned above), with no
      // flash/shake/burst so a miss never reads as a landed hit.
      if (h.evade === 'dodged') continue;

      // Damage (hit / dot): impact feedback.
      triggerShake(shake, h.amount, h.targetMaxHp);
      if (h.target === 'creature') {
        triggerFlash(creatureFlash);
        triggerRecoil(creatureScale); // the foe flinches when it takes a hit
      } else {
        triggerFlash(playerFlash);
      }
      spawnedBursts.push({
        id: nextBurstIdRef.current++,
        target: h.target,
        damageType: h.damageType,
        resist: h.resist,
        kind: 'damage',
      });
    }
    if (spawnedBursts.length > 0) {
      setBursts(list => [...list, ...spawnedBursts]);
    }
  }, [encounterId, hits, creatureFlash, playerFlash, shake, creatureScale, playerScale]);

  return {
    floaters,
    removeFloater,
    bursts,
    removeBurst,
    creatureFlashStyle,
    playerFlashStyle,
    shakeStyle,
    creatureRecoilStyle,
    playerRecoilStyle,
  };
}
