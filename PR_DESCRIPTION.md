# Add Creature Combat System and Player HP

This PR implements a complete combat system where creatures can fight back against the player, and adds a player HP system to track health during encounters.

## Features Added

### 🗡️ Creature Combat
- Creatures now attack back when the player fights them
- Combat follows the same damage calculation rules: `damage = attacker.attack - defender.defense` (minimum 1)
- Player attacks first, then creature counterattacks (if still alive)

### ❤️ Player HP System
- Added HP and maxHP fields to Player model
- Players start with 100 HP (configurable via `PLAYER_CONFIG.STARTING_HP`)
- HP increases by 10 per level (configurable via `PLAYER_CONFIG.HP_PER_LEVEL`)
- HP bar displayed in PlayerStats component with color coding:
  - 🟢 Green: >50% HP
  - 🟠 Orange: 25-50% HP
  - 🔴 Red: <25% HP

### 💥 Combat UI Improvements
- Player stats (HP, Attack, Defense) now displayed in EncounterModal
- HP bar with color coding in encounter modal
- Fight button disabled when player is defeated
- Player defeat handling with full HP restore on confirmation

### 🎨 UI Enhancements
- Changed XP bar color to blue (#2196F3) to distinguish from HP bar
- Player stats card in encounter modal with blue border for visual distinction
- Consistent color coding across HP displays

## Technical Changes

### Models
- **Player.ts**: Added `hp`, `maxHp` fields and methods:
  - `takeDamage(amount)`: Apply damage to player
  - `isDefeated()`: Check if HP <= 0
  - `restoreHp(amount)`: Heal player
  - `fullHeal()`: Restore to max HP
  - Updated `checkLevelUp()` to increase max HP and restore HP on level up

- **Creature.ts**: Added `calculateDamage(playerDefense)` method for counterattacks

### Components
- **PlayerStats.tsx**: Added HP bar display above XP bar
- **EncounterModal.tsx**: 
  - Added player stats card showing HP, Attack, and Defense
  - Updated props to accept player stats
  - Disabled fight button when player defeated

### Screens
- **HomeScreen.tsx**: Updated `handleFight()` to:
  - Apply creature counterattack damage
  - Check for player defeat
  - Handle player defeat with alert and HP restoration

### Configuration
- **config.ts**: Added `STARTING_HP: 100` and `HP_PER_LEVEL: 10`

## Gameplay Impact

- **Strategy**: Players must now consider their HP when engaging in combat
- **Risk/Reward**: Fighting creatures is riskier, but rewards remain the same
- **Balance**: Lower level players may need to flee from stronger creatures
- **Engagement**: More tactical decision-making during encounters

## Testing Notes

- Test combat with various creature levels
- Verify HP bar updates correctly during combat
- Ensure player defeat handling works properly
- Check that level ups restore HP correctly
- Verify player stats display correctly in encounter modal

## Breaking Changes

None - this is a fully additive feature. Existing save data will work with default HP values.

