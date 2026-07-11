import type { DamageType } from './DamageType';

/**
 * The combat LOG: a turn-by-turn narration feed, separate from the FX-oriented CombatHitEvent
 * stream. Its job is to make every mechanic that fires in a fight identifiable in plain language, so
 * a player can read exactly what happened.
 *
 * Designed to be EXTENSIBLE: new mechanics (glancing blows, dodges, crits, …) add a value to
 * {@link CombatLogTag} and, if needed, a branch in {@link formatCombatLogEntry}. Everything else —
 * the feed, the component, the emit sites — keeps working unchanged. Keep the formatter PURE so the
 * narration is unit-testable.
 */
export type CombatActor = 'player' | 'creature';

/** Modifiers layered onto an action. Extend this union as mechanics are added. */
export type CombatLogTag =
  | 'resisted' // target resisted the damage type
  | 'weak' // target was vulnerable to the damage type
  | 'glancing' // (future) partial hit — reduced damage
  | 'dodged' // (future) fully avoided
  | 'crit'; // (future) critical hit

export type CombatLogKind = 'attack' | 'dot' | 'heal' | 'buff' | 'debuff' | 'defeat';

export interface CombatLogEntry {
  id: number;
  kind: CombatLogKind;
  /** Who performed the action. */
  actor: CombatActor;
  /** Who received it (the sufferer/beneficiary). Omitted only when it doesn't apply. */
  target?: CombatActor;
  /** Ability or effect name — "Fireball", "Immolate", "Battle Cry". Omitted for the basic counter. */
  source?: string;
  /** Damage or heal magnitude. */
  amount?: number;
  damageType?: DamageType | null;
  /** Pre-formatted stat change for buff/debuff (e.g. "ATK ↑ +10"). */
  label?: string;
  tags?: CombatLogTag[];
}

export interface CombatLogNames {
  /** Displayed for the player actor; second-person reads best in a log ("You hit …"). */
  player: string;
  creature: string;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// Subject / object forms so "You"/"you" and the creature name conjugate correctly mid-sentence.
const subj = (actor: CombatActor, n: CombatLogNames): string =>
  actor === 'player' ? n.player : n.creature;
const obj = (actor: CombatActor, n: CombatLogNames): string =>
  actor === 'player' ? n.player.toLowerCase() : n.creature;
const verb = (actor: CombatActor, playerForm: string, creatureForm: string): string =>
  actor === 'player' ? playerForm : creatureForm;

// Suffixes for modifier tags, appended after the base clause. New tags slot in here.
const tagSuffix = (tags: CombatLogTag[] | undefined): string => {
  if (!tags || tags.length === 0) return '';
  const out: string[] = [];
  if (tags.includes('crit')) out.push(' — critical!');
  if (tags.includes('glancing')) out.push(' — glancing');
  if (tags.includes('weak')) out.push(' — vulnerable!');
  if (tags.includes('resisted')) out.push(' (resisted)');
  return out.join('');
};

const typeWord = (t: DamageType | null | undefined): string => (t ? `${t} ` : '');

/**
 * Render a single log entry as one readable line. Pure + total — every kind returns a string.
 */
export function formatCombatLogEntry(e: CombatLogEntry, n: CombatLogNames): string {
  const amt = e.amount ?? 0;
  switch (e.kind) {
    case 'attack': {
      const t = e.target ?? (e.actor === 'player' ? 'creature' : 'player');
      // A fully-dodged hit reads as an avoidance, not "for 0 damage".
      if (e.tags?.includes('dodged')) {
        return `${subj(t, n)} ${verb(t, 'dodge', 'dodges')} ${subj(e.actor, n)}'s attack!`;
      }
      const src = e.source ? ` with ${e.source}` : '';
      return (
        `${subj(e.actor, n)} ${verb(e.actor, 'hit', 'hits')} ${obj(t, n)} for ` +
        `${amt} ${typeWord(e.damageType)}damage${src}${tagSuffix(e.tags)}`
      );
    }
    case 'dot': {
      const t = e.target ?? 'creature';
      const src = e.source ? ` from ${e.source}` : '';
      return (
        `${subj(t, n)} ${verb(t, 'take', 'takes')} ${amt} ${typeWord(e.damageType)}damage` +
        `${src}${tagSuffix(e.tags)}`
      );
    }
    case 'heal': {
      const src = e.source ? ` with ${e.source}` : '';
      return `${subj(e.actor, n)} ${verb(e.actor, 'heal', 'heals')} ${amt} HP${src}`;
    }
    case 'buff': {
      const src = e.source ? ` (${e.source})` : '';
      const what = e.label ?? 'a boon';
      return `${subj(e.actor, n)} ${verb(e.actor, 'gain', 'gains')} ${what}${src}`;
    }
    case 'debuff': {
      const t = e.target ?? 'creature';
      const src = e.source ? ` (${e.source})` : '';
      const what = e.label ?? 'a hex';
      return `${subj(t, n)} ${verb(t, 'suffer', 'suffers')} ${what}${src}`;
    }
    case 'defeat': {
      const t = e.target ?? 'creature';
      return t === 'player' ? `${n.player} were defeated!` : `${cap(n.creature)} is defeated!`;
    }
    default: {
      const _exhaustive: never = e.kind;
      return _exhaustive;
    }
  }
}
