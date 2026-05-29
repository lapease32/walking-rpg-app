import { PLAYER_CONFIG } from '../constants/config';
import {
  WeaponItem,
  OffhandItem,
  HeadItem,
  ChestItem,
  LegsItem,
  BootsItem,
  GlovesItem,
  AccessoryItem,
  Item,
} from './Item';
import {
  Archetype,
  Attributes,
  ARCHETYPE_CONFIGS,
  computeAttributes,
  deriveAttack,
  deriveDefense,
  deriveMaxHp,
} from './Archetype';

export { Archetype };

export type EquipmentSlot =
  | 'weapon'
  | 'offhand'
  | 'head'
  | 'chest'
  | 'legs'
  | 'boots'
  | 'gloves'
  | 'accessory1'
  | 'accessory2';

export interface Equipment {
  weapon: null | WeaponItem;
  offhand: null | OffhandItem;
  head: null | HeadItem;
  chest: null | ChestItem;
  legs: null | LegsItem;
  boots: null | BootsItem;
  gloves: null | GlovesItem;
  accessory1: null | AccessoryItem;
  accessory2: null | AccessoryItem;
}

export function createEmptyEquipment(): Equipment {
  return {
    weapon: null,
    offhand: null,
    head: null,
    chest: null,
    legs: null,
    boots: null,
    gloves: null,
    accessory1: null,
    accessory2: null,
  };
}

export function createEmptyInventory(): (Item | null)[] {
  return new Array(PLAYER_CONFIG.MAX_INVENTORY_SIZE).fill(null);
}

export interface PlayerData {
  id: string;
  name: string;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  hp?: number;
  maxHp?: number;
  totalDistance: number;
  totalEncounters: number;
  creaturesDefeated: number;
  equipment: Equipment;
  inventory?: (Item | null)[];
  // Archetype and primary attributes — absent in saves created before this
  // feature; fromJSON defaults to Martial and recomputes from level.
  archetype?: Archetype;
  str?: number;
  agi?: number;
  int?: number;
}

export interface PlayerStats {
  id: string;
  name: string;
  level: number;
  experience: number;
  experienceForNextLevel: number;
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
  totalDistance: number;
  totalEncounters: number;
  creaturesDefeated: number;
  archetype: Archetype;
  str: number;
  agi: number;
  int: number;
}

export interface PlayerConstructorParams {
  id?: string;
  name?: string;
  level?: number;
  experience?: number;
  attack?: number;
  defense?: number;
  hp?: number;
  maxHp?: number;
  totalDistance?: number;
  totalEncounters?: number;
  creaturesDefeated?: number;
  equipment?: Equipment;
  inventory?: (Item | null)[];
  archetype?: Archetype;
  str?: number;
  agi?: number;
  int?: number;
}

export class Player {
  id: string;
  name: string;
  level: number;
  experience: number;
  attack: number;
  defense: number;
  hp: number;
  maxHp: number;
  totalDistance: number;
  totalEncounters: number;
  creaturesDefeated: number;
  equipment: Equipment;
  inventory: (Item | null)[];
  archetype: Archetype;
  str: number;
  agi: number;
  int: number;

  constructor({
    id = 'player1',
    name = 'Adventurer',
    level = 1,
    experience = 0,
    attack,
    defense,
    hp,
    maxHp,
    totalDistance = 0,
    totalEncounters = 0,
    creaturesDefeated = 0,
    equipment,
    inventory,
    archetype = Archetype.Martial,
    str,
    agi,
    int,
  }: PlayerConstructorParams = {}) {
    this.id = id;
    this.name = name;
    this.level = level;
    this.experience = experience;
    this.archetype = archetype;

    // Primary attributes: use provided values or compute from archetype + level.
    const computed: Attributes = computeAttributes(archetype, level);
    this.str = str ?? computed.str;
    this.agi = agi ?? computed.agi;
    this.int = int ?? computed.int;

    // Derived combat stats: use provided values (e.g. loaded from a save that
    // already has equipment bonuses baked in) or derive from attributes.
    this.attack = attack ?? deriveAttack(this.str, this.agi);
    this.defense = defense ?? deriveDefense(this.str, this.agi);
    this.maxHp = maxHp ?? deriveMaxHp(this.archetype, this.str, this.agi);
    this.hp = hp ?? this.maxHp;
    if (this.hp > this.maxHp) {
      this.hp = this.maxHp;
    }

    this.totalDistance = totalDistance;
    this.totalEncounters = totalEncounters;
    this.creaturesDefeated = creaturesDefeated;

    this.equipment = equipment ?? createEmptyEquipment();

    const maxSlots = PLAYER_CONFIG.MAX_INVENTORY_SIZE;
    if (inventory && Array.isArray(inventory) && inventory.length === maxSlots) {
      this.inventory = [...inventory];
    } else if (inventory && Array.isArray(inventory)) {
      const normalized = [...inventory];
      while (normalized.length < maxSlots) {
        normalized.push(null);
      }
      this.inventory = normalized.slice(0, maxSlots);
    } else {
      this.inventory = createEmptyInventory();
    }
  }

  getExperienceForNextLevel(): number {
    return Math.floor(100 * Math.pow(Math.max(1, this.level), 1.5));
  }

  addExperience(amount: number): number {
    this.experience += amount;
    return this.checkLevelUp();
  }

  checkLevelUp(): number {
    let levelsGained = 0;
    let expNeeded = this.getExperienceForNextLevel();
    const cfg = ARCHETYPE_CONFIGS[this.archetype];

    while (this.experience >= expNeeded) {
      this.experience -= expNeeded;
      this.level += 1;
      levelsGained += 1;

      this.str += cfg.strPerLevel;
      this.agi += cfg.agiPerLevel;
      this.int += cfg.intPerLevel;

      expNeeded = this.getExperienceForNextLevel();
    }

    if (levelsGained > 0) {
      // recalculateStats recomputes maxHp from new attributes and adjusts
      // current HP by the same delta — giving the level-up HP restoration.
      this.recalculateStats();
    }

    return levelsGained;
  }

  calculateDamage(creatureDefense: number, damageMultiplier: number = 1.0): number {
    const baseDamage = this.attack - creatureDefense;
    return Math.max(1, Math.floor(baseDamage * damageMultiplier));
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  isDefeated(): boolean {
    return this.hp <= 0;
  }

  restoreHp(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  fullHeal(): void {
    this.hp = this.maxHp;
  }

  addDistance(distance: number): void {
    this.totalDistance += distance;
  }

  incrementEncounters(): void {
    this.totalEncounters += 1;
  }

  defeatCreature(): void {
    this.creaturesDefeated += 1;
  }

  forceLevelUp(): void {
    this.level += 1;
    const cfg = ARCHETYPE_CONFIGS[this.archetype];
    this.str += cfg.strPerLevel;
    this.agi += cfg.agiPerLevel;
    this.int += cfg.intPerLevel;
    this.recalculateStats();
  }

  resetLevel(): void {
    this.level = 1;
    this.experience = 0;
    const attrs = computeAttributes(this.archetype, 1);
    this.str = attrs.str;
    this.agi = attrs.agi;
    this.int = attrs.int;
    this.recalculateStats();
    this.hp = this.maxHp;
  }

  getStats(): PlayerStats {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
      experience: this.experience,
      experienceForNextLevel: this.getExperienceForNextLevel(),
      attack: this.attack,
      defense: this.defense,
      hp: this.hp,
      maxHp: this.maxHp,
      totalDistance: this.totalDistance,
      totalEncounters: this.totalEncounters,
      creaturesDefeated: this.creaturesDefeated,
      archetype: this.archetype,
      str: this.str,
      agi: this.agi,
      int: this.int,
    };
  }

  addItemToInventory(item: Item): number {
    const emptySlotIndex = this.inventory.findIndex(slot => slot === null);
    if (emptySlotIndex !== -1) {
      this.inventory[emptySlotIndex] = item;
      return emptySlotIndex;
    }
    return -1;
  }

  removeItemFromInventory(index: number): Item | null {
    if (index < 0 || index >= this.inventory.length) {
      return null;
    }
    const item = this.inventory[index];
    this.inventory[index] = null;
    return item;
  }

  getEmptyInventorySlots(): number {
    return this.inventory.filter(slot => slot === null).length;
  }

  getUsedInventorySlots(): number {
    return this.inventory.filter(slot => slot !== null).length;
  }

  isInventoryFull(): boolean {
    return this.getEmptyInventorySlots() === 0;
  }

  equipItem(inventoryIndex: number): boolean {
    if (inventoryIndex < 0 || inventoryIndex >= this.inventory.length) {
      return false;
    }
    const item = this.inventory[inventoryIndex];
    if (!item) {
      return false;
    }
    if (item.level > this.level) {
      return false;
    }

    let targetSlot: EquipmentSlot;
    if (item.type === 'accessory') {
      targetSlot = this.equipment.accessory1 === null ? 'accessory1' : 'accessory2';
    } else {
      targetSlot = item.slot;
    }

    this.inventory[inventoryIndex] = null;

    const existingItem = this.equipment[targetSlot];
    if (existingItem) {
      const emptySlotIndex = this.inventory.findIndex(slot => slot === null);
      if (emptySlotIndex !== -1) {
        this.inventory[emptySlotIndex] = existingItem;
      } else {
        this.inventory[inventoryIndex] = item;
        return false;
      }
    }

    if (item.type === 'accessory') {
      if (targetSlot === 'accessory1') {
        this.equipment.accessory1 = item;
      } else {
        this.equipment.accessory2 = item;
      }
    } else {
      switch (targetSlot) {
        case 'weapon':
          this.equipment.weapon = item as WeaponItem;
          break;
        case 'offhand':
          this.equipment.offhand = item as OffhandItem;
          break;
        case 'head':
          this.equipment.head = item as HeadItem;
          break;
        case 'chest':
          this.equipment.chest = item as ChestItem;
          break;
        case 'legs':
          this.equipment.legs = item as LegsItem;
          break;
        case 'boots':
          this.equipment.boots = item as BootsItem;
          break;
        case 'gloves':
          this.equipment.gloves = item as GlovesItem;
          break;
      }
    }

    this.recalculateStats();
    return true;
  }

  private recalculateStats(): void {
    // Base stats from primary attributes
    let baseAttack = deriveAttack(this.str, this.agi);
    let baseDefense = deriveDefense(this.str, this.agi);
    let baseMaxHp = deriveMaxHp(this.archetype, this.str, this.agi);

    // Add equipment bonuses
    Object.values(this.equipment).forEach(item => {
      if (item) {
        if (item.attack !== undefined) baseAttack += item.attack;
        if (item.defense !== undefined) baseDefense += item.defense;
        if (item.maxHp !== undefined) baseMaxHp += item.maxHp;
      }
    });

    const maxHpChange = baseMaxHp - this.maxHp;
    this.attack = baseAttack;
    this.defense = baseDefense;
    this.maxHp = baseMaxHp;
    this.hp = Math.max(0, Math.min(this.maxHp, this.hp + maxHpChange));
  }

  toJSON(): PlayerData {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
      experience: this.experience,
      attack: this.attack,
      defense: this.defense,
      hp: this.hp,
      maxHp: this.maxHp,
      totalDistance: this.totalDistance,
      totalEncounters: this.totalEncounters,
      creaturesDefeated: this.creaturesDefeated,
      equipment: this.equipment,
      inventory: [...this.inventory],
      archetype: this.archetype,
      str: this.str,
      agi: this.agi,
      int: this.int,
    };
  }

  static fromJSON(data: PlayerData): Player {
    // Saves created before archetypes default to Martial.
    // str/agi/int are recomputed from level if absent so old saves
    // get correct attribute values without a manual migration step.
    const archetype = data.archetype ?? Archetype.Martial;
    let { str, agi, int: intVal } = data;
    if (str === undefined || agi === undefined || intVal === undefined) {
      const attrs = computeAttributes(archetype, data.level);
      str = attrs.str;
      agi = attrs.agi;
      intVal = attrs.int;
    }
    return new Player({ ...data, archetype, str, agi, int: intVal });
  }
}
