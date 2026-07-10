import { ABILITY_ICONS } from '../../components/icons/AbilityIcon';
import { ARCHETYPE_ABILITIES } from '../../constants/abilities';
import { Ability } from '../../models/Ability';
import { Archetype } from '../../models/Archetype';

const ALL_ABILITIES: Ability[] = ([] as Ability[]).concat(
  ...[Archetype.Martial, Archetype.Agile, Archetype.Mage].map(a => ARCHETYPE_ABILITIES[a]),
);

describe('ABILITY_ICONS registry', () => {
  it('has a dedicated glyph for every ability id in the roster', () => {
    for (const ability of ALL_ABILITIES) {
      expect(ABILITY_ICONS[ability.id]).toBeDefined();
    }
  });

  it('does not carry glyphs for ids outside the roster', () => {
    const rosterIds = new Set(ALL_ABILITIES.map(a => a.id));
    for (const id of Object.keys(ABILITY_ICONS)) {
      expect(rosterIds.has(id)).toBe(true);
    }
  });
});
