import { DAMAGE_TYPE_ICONS } from '../../components/icons/DamageTypeIcon';
import { RESOURCE_ICONS } from '../../components/icons/ResourceIcon';
import { ARCHETYPE_CONFIGS } from '../../models/Archetype';

describe('DAMAGE_TYPE_ICONS registry', () => {
  it('has a glyph for every damage type', () => {
    for (const type of ['physical', 'fire', 'frost', 'arcane'] as const) {
      expect(DAMAGE_TYPE_ICONS[type]).toBeDefined();
    }
  });
});

describe('RESOURCE_ICONS registry', () => {
  it('has a glyph for every archetype resource', () => {
    for (const cfg of Object.values(ARCHETYPE_CONFIGS)) {
      expect(RESOURCE_ICONS[cfg.resource]).toBeDefined();
    }
  });
});
