import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { IconProps } from './AbilityIcon';

/**
 * Filled "Luminous Flat" glyphs for equipment slots / item types, drawn with react-native-svg
 * primitives. Keyed by slot through {@link ITEM_SLOT_ICONS} and rendered via {@link ItemSlotIcon}.
 *
 * This replaces the item-slot emoji map that was copy-pasted across InventoryModal, Equipment,
 * ItemDetailsModal, RewardRevealModal and WalkSummaryModal — one registry, one visual language.
 */
const FillFrame = ({
  size = 24,
  color = '#fff',
  style,
  children,
}: IconProps & { children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
    <G fill={color}>{children}</G>
  </Svg>
);

const WeaponIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 2 L14 5 V13 H10 V5 Z" />
    <Path d="M7.5 13 H16.5 V15 H7.5 Z" />
    <Path d="M11 15 H13 V19 H11 Z" />
    <Circle cx={12} cy={20.2} r={1.6} />
  </FillFrame>
);

const OffhandIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M12 2 L20 5 V11 C20 16 16.5 19.8 12 22 C7.5 19.8 4 16 4 11 V5 Z" />
  </FillFrame>
);

const HeadIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M4 8 L7.2 12 L12 6.5 L16.8 12 L20 8 L18.6 18 H5.4 Z" />
  </FillFrame>
);

const ChestIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M6 5 L10 6.2 Q12 7.6 14 6.2 L18 5 L17 13.5 Q12 17.5 7 13.5 Z" />
  </FillFrame>
);

const LegsIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M7 3 H17 L16 21 H12.8 L12 11 L11.2 21 H8 Z" />
  </FillFrame>
);

const BootsIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M8 3 H12 V13 H16.5 Q19 13 19 16 V19 H8 Z" />
  </FillFrame>
);

// A gauntlet: four fingers + a side thumb over the palm, with a flared cuff at the wrist.
const GlovesIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Rect x={8.2} y={4.5} width={1.7} height={6.5} rx={0.85} />
    <Rect x={10.5} y={3.5} width={1.7} height={7.5} rx={0.85} />
    <Rect x={12.8} y={3.7} width={1.7} height={7.3} rx={0.85} />
    <Rect x={15.1} y={4.7} width={1.7} height={6.3} rx={0.85} />
    <Path d="M7.8 9.5 H17.2 V15.5 H7.8 Z" />
    <Path d="M7.8 10.5 Q5 10.3 4.9 12.5 Q4.8 14.6 7.8 14.3 Z" />
    <Rect x={6} y={15} width={12} height={4.6} rx={1.3} />
  </FillFrame>
);

const AccessoryIcon = ({ color = '#fff', ...p }: IconProps) => (
  <FillFrame color={color} {...p}>
    <Path d="M12 3 L14.2 6 L12 8.2 L9.8 6 Z" />
    <Path fillRule="evenodd" d="M12 8.5 A6 6 0 1 1 11.99 8.5 Z M12 11.5 A3 3 0 1 0 12.01 11.5 Z" />
  </FillFrame>
);

const FallbackSlotIcon = (p: IconProps) => (
  <FillFrame {...p}>
    <Path d="M7 9 V7.5 Q7 4.5 12 4.5 Q17 4.5 17 7.5 V9 H19 L18 20 H6 L5 9 Z" />
  </FillFrame>
);

/** Slot/type → glyph. Accessory1/accessory2 normalize to `accessory` (see {@link ItemSlotIcon}). */
export const ITEM_SLOT_ICONS: Record<string, React.FC<IconProps>> = {
  weapon: WeaponIcon,
  offhand: OffhandIcon,
  head: HeadIcon,
  chest: ChestIcon,
  legs: LegsIcon,
  boots: BootsIcon,
  gloves: GlovesIcon,
  accessory: AccessoryIcon,
};

/** Normalize an equipment slot or item type to its icon key (accessory1/accessory2 → accessory). */
export function normalizeSlotKey(slot: string): string {
  return slot.startsWith('accessory') ? 'accessory' : slot;
}

/** Render an item's slot glyph, falling back to a pouch for unknown slots. */
export default function ItemSlotIcon({
  slot,
  size = 24,
  color = '#fff',
  style,
}: IconProps & { slot: string }) {
  const Glyph = ITEM_SLOT_ICONS[normalizeSlotKey(slot)] ?? FallbackSlotIcon;
  return <Glyph size={size} color={color} style={style} />;
}
