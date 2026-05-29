import { DamageType, Resistances, applyResistance } from './DamageType';
import { Archetype } from './Archetype';

export type AbilityPrimitive = 'direct' | 'dot' | 'buff_debuff' | 'defensive';

interface AbilityBase {
  id: string;
  name: string;
  primitive: AbilityPrimitive;
  cooldownMs: number;
  resourceCost: number;
  icon: string;
}

export interface DirectAbility extends AbilityBase {
  primitive: 'direct';
  damageMultiplier: number;
  damageType: DamageType;
}

export interface DotAbility extends AbilityBase {
  primitive: 'dot';
  damagePerTick: number;
  tickCount: number;
  damageType: DamageType;
}

export interface StatModifiers {
  attack?: number;
  defense?: number;
}

export interface BuffDebuffAbility extends AbilityBase {
  primitive: 'buff_debuff';
  tickDuration: number;
  statModifiers: StatModifiers;
  targetSelf: boolean;
}

export interface DefensiveAbility extends AbilityBase {
  primitive: 'defensive';
  healAmount?: number;
  healPercent?: number;
  shieldAmount?: number;
}

export type Ability = DirectAbility | DotAbility | BuffDebuffAbility | DefensiveAbility;

export interface StatusEffect {
  id: string;
  type: 'dot' | 'buff' | 'debuff';
  remainingTicks: number;
  damagePerTick?: number;
  damageType?: DamageType;
  statModifiers?: StatModifiers;
}

export interface CombatantState {
  statusEffects: StatusEffect[];
  resource: number;
}

export interface ResourceConfig {
  max: number;
  startValue: number;
  regenPerTurn: number;
}

// Placeholder values — tuned in PR 5 when abilities have actual costs.
export const RESOURCE_CONFIGS: Readonly<Record<Archetype, ResourceConfig>> = {
  [Archetype.Martial]: { max: 100, startValue: 0, regenPerTurn: 10 },
  [Archetype.Agile]: { max: 100, startValue: 80, regenPerTurn: 15 },
  [Archetype.Mage]: { max: 100, startValue: 100, regenPerTurn: 20 },
};

export interface AbilityResult {
  damage: number;
  heal: number;
  shield: number;
  appliedEffects: StatusEffect[];
}

export interface TickResult {
  dotDamage: number;
  updatedState: CombatantState;
}

export function initCombatState(archetype: Archetype): CombatantState {
  return {
    statusEffects: [],
    resource: RESOURCE_CONFIGS[archetype].startValue,
  };
}

export function regenResource(state: CombatantState, archetype: Archetype): CombatantState {
  const cfg = RESOURCE_CONFIGS[archetype];
  return { ...state, resource: Math.min(cfg.max, state.resource + cfg.regenPerTurn) };
}

// Advance one turn's worth of status effects on a combatant.
// Returns total DoT damage dealt this tick and the updated state with expired effects removed.
// Resistance application for DoT damage is the caller's responsibility.
export function tickStatusEffects(state: CombatantState): TickResult {
  let dotDamage = 0;
  const remaining: StatusEffect[] = [];

  for (const effect of state.statusEffects) {
    if (effect.type === 'dot' && effect.damagePerTick !== undefined) {
      dotDamage += effect.damagePerTick;
    }
    if (effect.remainingTicks > 1) {
      remaining.push({ ...effect, remainingTicks: effect.remainingTicks - 1 });
    }
    // effect at remainingTicks === 1: last tick, then expires
  }

  return { dotDamage, updatedState: { ...state, statusEffects: remaining } };
}

export function resolveAbility(
  ability: Ability,
  casterAttack: number,
  targetDefense: number,
  targetResistances: Resistances,
  casterMaxHp: number,
): AbilityResult {
  const base: AbilityResult = { damage: 0, heal: 0, shield: 0, appliedEffects: [] };

  switch (ability.primitive) {
    case 'direct': {
      // Same formula as Player.calculateDamage; resistance layer on top.
      // At resistance=0 (all current creatures) this is byte-for-byte identical to the old path.
      const rawDamage = Math.max(
        1,
        Math.floor((casterAttack - targetDefense) * ability.damageMultiplier),
      );
      const damage = applyResistance(rawDamage, targetResistances[ability.damageType]);
      return { ...base, damage };
    }

    case 'dot': {
      const effect: StatusEffect = {
        id: ability.id,
        type: 'dot',
        remainingTicks: ability.tickCount,
        damagePerTick: ability.damagePerTick,
        damageType: ability.damageType,
      };
      return { ...base, appliedEffects: [effect] };
    }

    case 'buff_debuff': {
      const effect: StatusEffect = {
        id: ability.id,
        type: ability.targetSelf ? 'buff' : 'debuff',
        remainingTicks: ability.tickDuration,
        statModifiers: ability.statModifiers,
      };
      return { ...base, appliedEffects: [effect] };
    }

    case 'defensive': {
      const heal =
        (ability.healAmount ?? 0) +
        (ability.healPercent !== undefined ? Math.floor(casterMaxHp * ability.healPercent) : 0);
      const shield = ability.shieldAmount ?? 0;
      return { ...base, heal, shield };
    }

    default: {
      const _exhaustive: never = ability;
      return _exhaustive;
    }
  }
}
