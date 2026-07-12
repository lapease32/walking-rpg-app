import { ELEMENT_EMBLEMS, ELEMENT_COLORS } from '../../components/icons/ElementEmblem';
import { CREATURE_TEMPLATES } from '../../models/Creature';

describe('ELEMENT_EMBLEMS registry', () => {
  it('has an emblem AND a color for every creature type in the roster', () => {
    const types = Array.from(new Set(CREATURE_TEMPLATES.map(t => t.type)));
    expect(types.length).toBeGreaterThan(0);
    for (const type of types) {
      expect(ELEMENT_EMBLEMS[type]).toBeDefined();
      expect(ELEMENT_COLORS[type]).toBeDefined();
    }
  });
});
