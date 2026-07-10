import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Vibration,
} from 'react-native';
import { Item } from '../models/Item';
import { Rarity } from '../models/Creature';
import { getRarityColor } from '../constants/rarity';
import ItemSlotIcon from './icons/ItemSlotIcon';
import StatIcon from './icons/StatIcon';
import { TrophyIcon, WarningIcon } from './icons/UiIcon';
import RewardGlowCanvas from './RewardGlowCanvas';

/**
 * Data describing a single victory's rewards. Built by useEncounter and handed to
 * the reveal; `item` is null on the (common) no-drop win, which gets a lighter
 * celebration so frequent encounters on a walk don't fatigue the player.
 */
export interface RewardReveal {
  creatureName: string;
  xpGained: number;
  leveledUp: boolean;
  newLevel: number;
  item: Item | null;
  isUpgrade: boolean;
  inventoryFull: boolean;
}

interface Props {
  reveal: RewardReveal | null;
  onDismiss: () => void;
}

// ─── Tunable feel knobs ──────────────────────────────────────────────────────
// Particle "tell": count/size/spread + screen-shake + haptic escalate with rarity
// so you can read the rarity from the burst colour before the item resolves.
const POOL_SIZE = 30; // max particles we ever render (legendary)
// cardDelay = how long the rarity-colored burst owns the screen BEFORE the item card resolves
// (the "tell"). emitMs = the window over which particles keep SPAWNING — a staggered eruption
// rather than one instantaneous pop. Both scale with rarity so legendaries get a longer, more
// sustained burst that's hard to miss, while frequent commons stay snappy.
const RARITY_FX: Record<
  Rarity,
  {
    particles: number;
    size: number;
    spread: number;
    shake: number;
    haptic: number | number[];
    cardDelay: number;
    emitMs: number;
  }
> = {
  common: { particles: 8, size: 6, spread: 130, shake: 0, haptic: 0, cardDelay: 300, emitMs: 120 },
  uncommon: {
    particles: 14,
    size: 7,
    spread: 160,
    shake: 0,
    haptic: 15,
    cardDelay: 380,
    emitMs: 260,
  },
  rare: { particles: 20, size: 8, spread: 190, shake: 4, haptic: 25, cardDelay: 480, emitMs: 420 },
  epic: {
    particles: 26,
    size: 9,
    spread: 220,
    shake: 8,
    haptic: [0, 30, 40, 30],
    cardDelay: 580,
    emitMs: 600,
  },
  legendary: {
    particles: 30,
    size: 11,
    spread: 250,
    shake: 12,
    haptic: [0, 50, 50, 90],
    cardDelay: 680,
    emitMs: 780,
  },
};
const BURST_MS = 900; // per-particle flight duration (gives the gravity arc room to land)
// ─────────────────────────────────────────────────────────────────────────────

type Particle = {
  tx: Animated.Value;
  ty: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
};

export default function RewardRevealModal({ reveal, onDismiss }: Props) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const promptOpacity = useRef(new Animated.Value(0)).current;
  const particles = useRef<Particle[]>(
    Array.from({ length: POOL_SIZE }, () => ({
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    })),
  ).current;
  // Identity of the reveal whose start-state we've already applied — see reset below.
  const shownRevealRef = useRef<RewardReveal | null>(null);
  // Bumps on each new reveal so the Skia glow (keyed on it) remounts + replays its intro even when
  // one reveal directly replaces another (no null in between).
  const revealSeqRef = useRef(0);
  // The running staggered particle burst, so a re-show (or unmount) can stop its pending
  // launches before starting a fresh one.
  const burstAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const rarity: Rarity | null = reveal?.item?.rarity ?? null;
  const fx = rarity ? RARITY_FX[rarity] : null;
  const color = rarity ? getRarityColor(rarity) : '#FFD54F';

  // Re-show fix: the Animated values persist across reveals (useRef), so a NEW reveal would
  // first PAINT with the PREVIOUS reveal's end-state (card already fully visible) for a frame
  // before the useEffect below resets + replays — making the card flash in, vanish behind the
  // burst, then resolve again. Reset to the hidden start-state synchronously here, during
  // render, so the very first paint of each new reveal is already hidden. (A reset in
  // useEffect runs AFTER paint — too late.) setValue on these refs doesn't trigger a re-render,
  // and the ref guard means an in-flight animation (same reveal re-rendering) is never reset.
  if (reveal && reveal !== shownRevealRef.current) {
    shownRevealRef.current = reveal;
    revealSeqRef.current += 1;
    backdrop.setValue(0);
    cardScale.setValue(0.6);
    cardOpacity.setValue(0);
    shakeX.setValue(0);
    promptOpacity.setValue(0);
    particles.forEach(p => {
      p.tx.setValue(0);
      p.ty.setValue(0);
      p.scale.setValue(0);
      p.opacity.setValue(0);
    });
  }

  useEffect(() => {
    if (!reveal) {
      return;
    }
    // The hidden start-state is applied synchronously during render (the reset block above), so
    // the first paint is already hidden; here we only PLAY the animation.
    Animated.timing(backdrop, { toValue: 1, duration: 150, useNativeDriver: true }).start();

    if (fx) {
      if (fx.haptic) {
        Vibration.vibrate(fx.haptic);
      }
      // Particles erupt from centre over an emission window (fx.emitMs) rather than all at once
      // — a staggered, continuously-spawning burst that lasts longer at higher rarity and is
      // harder to miss. Each pops in at its launch, flies a gravity ARC (horizontal spread +
      // up-then-down), and fades as it falls. Until the stagger launches a particle it waits at
      // the hidden start-state set by the reset block above.
      const flights: Animated.CompositeAnimation[] = [];
      for (let i = 0; i < fx.particles; i++) {
        const p = particles[i];
        const angle = Math.random() * Math.PI * 2;
        const dist = fx.spread * (0.45 + Math.random() * 0.55);
        const dx = Math.cos(angle) * dist;
        const peakY = -(fx.spread * (0.3 + Math.random() * 0.3)); // up, varied per particle
        const fallY = fx.spread * (0.55 + Math.random() * 0.5); // down past origin (gravity)
        flights.push(
          Animated.parallel([
            // Horizontal: fly out fast, decelerate.
            Animated.timing(p.tx, {
              toValue: dx,
              duration: BURST_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            // Vertical: up (decelerating) then down (accelerating) = gravity.
            Animated.sequence([
              Animated.timing(p.ty, {
                toValue: peakY,
                duration: BURST_MS * 0.35,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(p.ty, {
                toValue: fallY,
                duration: BURST_MS * 0.65,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            // Pop in (scale 0→1) at launch, then shrink (1→0) as it flies.
            Animated.sequence([
              Animated.timing(p.scale, {
                toValue: 1,
                duration: 90,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(p.scale, {
                toValue: 0,
                duration: BURST_MS - 90,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            // Fade in fast at launch, hold, then fade out as it falls.
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: 1, duration: 90, useNativeDriver: true }),
              Animated.delay(BURST_MS * 0.4),
              Animated.timing(p.opacity, {
                toValue: 0,
                duration: BURST_MS * 0.6 - 90,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
              }),
            ]),
          ]),
        );
      }
      // Stagger the launches across the emission window so particles keep spawning over time
      // (longer at higher rarity). Held in a ref so a re-show can stop pending launches.
      burstAnimRef.current = Animated.stagger(fx.emitMs / Math.max(1, fx.particles - 1), flights);
      burstAnimRef.current.start();
      if (fx.shake > 0) {
        Animated.sequence([
          Animated.timing(shakeX, { toValue: fx.shake, duration: 45, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -fx.shake, duration: 45, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: fx.shake * 0.6, duration: 45, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 45, useNativeDriver: true }),
        ]).start();
      }
    }

    // Item/victory card resolves out of the burst, then the tap prompt. The delay is the
    // rarity "tell" window (fx.cardDelay); no-drop victories resolve almost immediately.
    Animated.sequence([
      Animated.delay(fx ? fx.cardDelay : 80),
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
      Animated.timing(promptOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // Stop the staggered burst's pending launches if this reveal is replaced or the component
    // unmounts, so a stale particle can't pop in over the next reveal / after teardown.
    return () => {
      burstAnimRef.current?.stop();
    };
    // particles/fx/color derive synchronously from `reveal`; re-running only on reveal is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  if (!reveal) {
    return null;
  }

  const item = reveal.item;

  return (
    <Modal transparent visible={true} animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.fill} onPress={onDismiss} testID="reward-reveal">
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]} />
        <Animated.View style={[styles.center, { transform: [{ translateX: shakeX }] }]}>
          {/* Skia rarity glow behind everything (Phase 3) — reads the rarity before the card resolves */}
          {rarity && <RewardGlowCanvas key={revealSeqRef.current} rarity={rarity} />}
          {/* Particle origin (centre) — particles burst from behind the card */}
          <View style={styles.particleOrigin} pointerEvents="none">
            {fx &&
              particles.slice(0, fx.particles).map((p, i) => (
                <Animated.View
                  key={i}
                  pointerEvents="none"
                  style={[
                    styles.particle,
                    {
                      width: fx.size,
                      height: fx.size,
                      borderRadius: fx.size / 2,
                      backgroundColor: color,
                      opacity: p.opacity,
                      transform: [{ translateX: p.tx }, { translateY: p.ty }, { scale: p.scale }],
                    },
                  ]}
                />
              ))}
          </View>

          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [{ scale: cardScale }],
                borderColor: item ? color : '#FFD54F',
                shadowColor: item ? color : '#FFD54F',
              },
            ]}>
            {item ? (
              <>
                <ItemSlotIcon slot={item.type} size={50} color={color} style={styles.icon} />
                <Text style={[styles.itemName, { color }]}>{item.name}</Text>
                <Text style={[styles.rarityLabel, { color }]}>
                  {item.rarity.toUpperCase()} • {item.type}
                </Text>
                <View style={styles.statsRow}>
                  {item.attack !== undefined && (
                    <View style={styles.stat}>
                      <StatIcon stat="attack" size={14} color={color} />
                      <Text style={styles.statText}> +{item.attack}</Text>
                    </View>
                  )}
                  {item.defense !== undefined && (
                    <View style={styles.stat}>
                      <StatIcon stat="defense" size={14} color={color} />
                      <Text style={styles.statText}> +{item.defense}</Text>
                    </View>
                  )}
                  {item.maxHp !== undefined && (
                    <View style={styles.stat}>
                      <StatIcon stat="maxHp" size={14} color={color} />
                      <Text style={styles.statText}> +{item.maxHp}</Text>
                    </View>
                  )}
                </View>
                {reveal.isUpgrade ? (
                  <Text style={styles.upgradeBadge}>▲ UPGRADE</Text>
                ) : (
                  <Text style={styles.newBadge}>NEW</Text>
                )}
                {reveal.inventoryFull && (
                  <View style={styles.warningRow}>
                    <WarningIcon size={13} color="#FFB74D" />
                    <Text style={styles.warning}>
                      {' '}
                      Inventory full — this drop was lost. Clear space to keep future finds.
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <TrophyIcon size={50} color="#FFD54F" style={styles.icon} />
                <Text style={styles.victoryTitle}>Victory!</Text>
                <Text style={styles.subtle}>Defeated {reveal.creatureName}</Text>
              </>
            )}
            <Text style={styles.xp}>+{reveal.xpGained} XP</Text>
            {reveal.leveledUp && <Text style={styles.levelUp}>LEVEL UP! → {reveal.newLevel}</Text>}
          </Animated.View>

          <Animated.Text style={[styles.prompt, { opacity: promptOpacity }]}>
            Tap to continue
          </Animated.Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  particleOrigin: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: { position: 'absolute' },
  card: {
    minWidth: 240,
    maxWidth: '82%',
    backgroundColor: '#11202E',
    borderRadius: 18,
    borderWidth: 2,
    paddingVertical: 22,
    paddingHorizontal: 26,
    alignItems: 'center',
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  icon: { fontSize: 52, marginBottom: 6 },
  itemName: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  rarityLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  victoryTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFD54F' },
  subtle: { fontSize: 14, color: '#9FB3C8', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 14, marginTop: 12 },
  stat: { flexDirection: 'row', alignItems: 'center' },
  statText: { fontSize: 15, color: '#E0E0E0', fontWeight: '600' },
  upgradeBadge: {
    marginTop: 12,
    color: '#2e7d32',
    backgroundColor: 'rgba(46,125,50,0.18)',
    fontWeight: 'bold',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  newBadge: {
    marginTop: 12,
    color: '#90A4AE',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 2,
  },
  warningRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  warning: { color: '#FFB74D', fontSize: 12, flexShrink: 1 },
  xp: { marginTop: 14, color: '#FFD54F', fontSize: 16, fontWeight: 'bold' },
  levelUp: { marginTop: 6, color: '#4FC3F7', fontSize: 15, fontWeight: 'bold', letterSpacing: 1 },
  prompt: { marginTop: 26, color: '#7E8C9A', fontSize: 13 },
});
