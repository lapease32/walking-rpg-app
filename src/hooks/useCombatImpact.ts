import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { MOTION_EASING, MOTION_SHAKE } from '../constants/motion';
import { combatTextStyle } from '../utils/combatText';
import type { CombatFloater } from '../components/FloatingCombatText';

/**
 * Derives combat "impact" feedback (Phase 2a) purely from HP changes, so the combat hook
 * (useEncounter) stays untouched: each render we compare the current HP to the previous and, on a
 * drop/gain, spawn a floating number + flash the struck panel + shake the modal. Baselines reset on
 * a new encounter so a fresh full-HP foe doesn't register a phantom hit against the last one.
 *
 * LIMITATION by design: HP deltas only carry a NET amount per turn — no damage TYPE and no split of
 * a DoT tick from the direct hit. Phase 2b adds a real hit-event from the combat hook for that
 * fidelity (typed Skia bursts + resistance tells).
 */

const FLASH_MAX_OPACITY = 0.35;
const FLASH_UP_MS = 60;
const FLASH_DOWN_MS = 200;
/** A hit worth this fraction of max HP produces a full-strength shake. */
const SHAKE_FULL_AT_FRACTION = 0.25;
const FLOATER_DX_SPREAD = 18; // ± horizontal jitter (px)

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

export interface UseCombatImpactParams {
  /** Encounter identity — a change resets the HP baselines (new fight). */
  encounterId: number | null;
  creatureHp: number | null;
  creatureMaxHp: number | null;
  playerHp: number | null;
  playerMaxHp: number | null;
}

export function useCombatImpact({
  encounterId,
  creatureHp,
  creatureMaxHp,
  playerHp,
  playerMaxHp,
}: UseCombatImpactParams) {
  const [floaters, setFloaters] = useState<CombatFloater[]>([]);
  const nextIdRef = useRef(0);
  const prevCreatureHpRef = useRef<number | null>(null);
  const prevPlayerHpRef = useRef<number | null>(null);
  const fxEncounterRef = useRef<number | null>(null);

  const creatureFlash = useSharedValue(0);
  const playerFlash = useSharedValue(0);
  const shake = useSharedValue(0);

  const creatureFlashStyle = useAnimatedStyle(() => ({
    opacity: creatureFlash.value * FLASH_MAX_OPACITY,
  }));
  const playerFlashStyle = useAnimatedStyle(() => ({
    opacity: playerFlash.value * FLASH_MAX_OPACITY,
  }));
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const removeFloater = useCallback((id: number) => {
    setFloaters(list => list.filter(f => f.id !== id));
  }, []);

  useEffect(() => {
    // New encounter (or first mount): baseline the refs, emit nothing.
    if (fxEncounterRef.current !== encounterId) {
      fxEncounterRef.current = encounterId;
      prevCreatureHpRef.current = creatureHp;
      prevPlayerHpRef.current = playerHp;
      return;
    }

    const spawned: CombatFloater[] = [];

    const applyHit = (
      target: CombatFloater['target'],
      cur: number | null,
      prevRef: MutableRefObject<number | null>,
      maxHp: number | null,
      flash: SharedValue<number>,
    ): void => {
      if (cur == null) return;
      const prev = prevRef.current;
      prevRef.current = cur;
      if (prev == null || cur === prev) return;

      const delta = prev - cur; // + = damage taken, - = healed
      const kind = delta > 0 ? 'damage' : 'heal';
      const style = combatTextStyle(Math.abs(delta), maxHp ?? 0, kind);
      spawned.push({
        id: nextIdRef.current++,
        target,
        label: style.label,
        color: style.color,
        fontSize: style.fontSize,
        dx: (Math.random() * 2 - 1) * FLOATER_DX_SPREAD,
      });
      if (delta > 0) {
        triggerFlash(flash);
        triggerShake(shake, delta, maxHp ?? 1);
      }
    };

    applyHit('creature', creatureHp, prevCreatureHpRef, creatureMaxHp, creatureFlash);
    applyHit('player', playerHp, prevPlayerHpRef, playerMaxHp, playerFlash);

    if (spawned.length > 0) {
      setFloaters(list => [...list, ...spawned]);
    }
  }, [
    encounterId,
    creatureHp,
    playerHp,
    creatureMaxHp,
    playerMaxHp,
    creatureFlash,
    playerFlash,
    shake,
  ]);

  return { floaters, removeFloater, creatureFlashStyle, playerFlashStyle, shakeStyle };
}
