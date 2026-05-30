import { Ability } from '../models/Ability';
import { Archetype } from '../models/Archetype';

// Per-archetype ability rosters — consumed by Combat UI (PR 7).
// Numbers are placeholder; tuned during playtesting.
// All costs validated against RESOURCE_CONFIGS max (100) for each archetype.
export const ARCHETYPE_ABILITIES: Readonly<Record<Archetype, Ability[]>> = {
  // Rage: starts at 0, regens 10/turn, max 100.
  // Identity: sustained physical damage; rage dump on Execute.
  [Archetype.Martial]: [
    {
      id: 'strike',
      name: 'Strike',
      primitive: 'direct',
      damageMultiplier: 1.1,
      cooldownMs: 1200,
      resourceCost: 0,
      icon: '⚔️',
      damageType: 'physical',
    },
    {
      id: 'power_strike',
      name: 'Power Strike',
      primitive: 'direct',
      damageMultiplier: 2.0,
      cooldownMs: 3000,
      resourceCost: 30,
      icon: '💪',
      damageType: 'physical',
    },
    {
      id: 'battle_cry',
      name: 'Battle Cry',
      primitive: 'buff_debuff',
      tickDuration: 3,
      statModifiers: { attack: 10 },
      targetSelf: true,
      cooldownMs: 8000,
      resourceCost: 20,
      icon: '📣',
    },
    {
      id: 'execute',
      name: 'Execute',
      primitive: 'direct',
      damageMultiplier: 3.5,
      cooldownMs: 5000,
      resourceCost: 60,
      icon: '💀',
      damageType: 'physical',
    },
  ],

  // Energy: starts at 80, regens 15/turn, max 100.
  // Identity: fast hits, bleed DoT, self-sustain via Evasive Leap.
  [Archetype.Agile]: [
    {
      id: 'quick_slash',
      name: 'Quick Slash',
      primitive: 'direct',
      damageMultiplier: 0.85,
      cooldownMs: 800,
      resourceCost: 0,
      icon: '🗡️',
      damageType: 'physical',
    },
    {
      id: 'twin_fangs',
      name: 'Twin Fangs',
      primitive: 'direct',
      damageMultiplier: 1.5,
      cooldownMs: 2000,
      resourceCost: 20,
      icon: '⚡',
      damageType: 'physical',
    },
    {
      id: 'hemorrhage',
      name: 'Hemorrhage',
      primitive: 'dot',
      damagePerTick: 8,
      tickCount: 3,
      cooldownMs: 4000,
      resourceCost: 25,
      icon: '🩸',
      damageType: 'physical',
    },
    {
      id: 'evasive_leap',
      name: 'Evasive Leap',
      primitive: 'defensive',
      healAmount: 12,
      cooldownMs: 5000,
      resourceCost: 30,
      icon: '🌀',
    },
  ],

  // Mana: starts at 100, regens 20/turn, max 100.
  // Identity: elemental burst damage (fire/frost), fire DoT for sustained pressure.
  [Archetype.Mage]: [
    {
      id: 'arcane_bolt',
      name: 'Arcane Bolt',
      primitive: 'direct',
      damageMultiplier: 1.0,
      cooldownMs: 1500,
      resourceCost: 15,
      icon: '✨',
      damageType: 'physical',
    },
    {
      id: 'fireball',
      name: 'Fireball',
      primitive: 'direct',
      damageMultiplier: 1.8,
      cooldownMs: 3000,
      resourceCost: 30,
      icon: '🔥',
      damageType: 'fire',
    },
    {
      id: 'frost_bolt',
      name: 'Frost Bolt',
      primitive: 'direct',
      damageMultiplier: 1.3,
      cooldownMs: 2500,
      resourceCost: 20,
      icon: '❄️',
      damageType: 'frost',
    },
    {
      id: 'immolate',
      name: 'Immolate',
      primitive: 'dot',
      damagePerTick: 12,
      tickCount: 4,
      cooldownMs: 4500,
      resourceCost: 40,
      icon: '🌋',
      damageType: 'fire',
    },
    {
      id: 'arcane_surge',
      name: 'Arcane Surge',
      primitive: 'direct',
      damageMultiplier: 3.0,
      cooldownMs: 6000,
      resourceCost: 50,
      icon: '🌟',
      damageType: 'physical',
    },
  ],
};
