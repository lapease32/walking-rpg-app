#!/usr/bin/env node
/**
 * Generates docs/icon-sheet.html — a self-contained, build-free preview of every vector icon in
 * src/components/icons/. Open the output in any browser (file://) to eyeball the glyphs at any size
 * and tint. Run with:  yarn icons:sheet   (or: node scripts/gen-icon-sheet.mjs)
 *
 * ── Adding / changing an icon ────────────────────────────────────────────────
 * This sheet keeps its own copy of each glyph's SVG so it can render without a React Native build.
 * When you add or edit an icon in src/components/icons/*.tsx, mirror the change in the GROUPS data
 * below (one entry per glyph) and re-run this script. Each entry is:
 *     [name, mode, strokeWidth, innerSvgMarkup]
 *   - mode 'fill' → wrapped in <g fill="currentColor">
 *   - mode 'line' → wrapped in <g fill="none" stroke="currentColor" stroke-width=W round>
 *   - innerSvgMarkup uses plain HTML-SVG (lowercase tags, kebab-case attrs like fill-rule).
 *     Per-child fill="currentColor" stroke="none" overrides are inlined where the component uses them.
 * Because these are the exact same path strings as the .tsx components, the browser renders a
 * faithful proof of what ships in-app.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../docs/icon-sheet.html');

const GROUPS = [
  {
    title: 'Abilities',
    file: 'AbilityIcon.tsx',
    note: 'filled (frost + evasive stay stroke)',
    icons: [
      ['strike', 'fill', 0, '<path d="M12 2 L14 5 V13 H10 V5 Z"/><path d="M7.5 13 H16.5 V15 H7.5 Z"/><path d="M11 15 H13 V20 H11 Z"/>'],
      ['power_strike', 'fill', 0, '<path d="M12 4 L20 12 H16 L12 8 L8 12 H4 Z"/><path d="M12 11 L20 19 H16 L12 15 L8 19 H4 Z"/>'],
      ['battle_cry', 'fill', 0, '<path d="M4 10 H8 L14 6.5 V17.5 L8 14 H4 Z"/><path d="M16.5 9 Q19 12 16.5 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'],
      ['execute', 'fill', 0, '<path fill-rule="evenodd" d="M6 10 A6 6 0 0 1 18 10 V14 Q18 16 16 16 V18 H8 V16 Q6 16 6 14 Z M9.8 10 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M14.2 10 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M12 12 L11.1 13.4 H12.9 Z"/>'],
      ['quick_slash', 'fill', 0, '<path d="M5 18.5 Q9 6 19 8 Q11 9.2 6.6 17.8 Q6.1 18.9 5 18.5 Z"/>'],
      ['twin_fangs', 'fill', 0, '<path d="M5.5 6 H11 L8.25 15.5 Z"/><path d="M13 6 H18.5 L15.75 15.5 Z"/>'],
      ['hemorrhage', 'fill', 0, '<path d="M12 3 C12 3 6 11 6 15 A6 6 0 0 0 18 15 C18 11 12 3 12 3 Z"/>'],
      ['evasive_leap', 'line', 2, '<path d="M17.5 8.5 A5.2 5.2 0 1 0 18 13.5"/><path d="M18 13.5 L20 12 M18 13.5 L18.8 15.6"/>'],
      ['arcane_bolt', 'fill', 0, '<path d="M12 4 C12.5 9 13 10.5 20 12 C13 13.5 12.5 15 12 20 C11.5 15 11 13.5 4 12 C11 10.5 11.5 9 12 4 Z"/>'],
      ['fireball', 'fill', 0, '<path d="M12 3 C15 8 17 9 16 14 A4.5 4.5 0 1 1 8 14 C7.6 11 9 10 9.6 9 C10 11 11 11.4 11.4 11 C12.4 10 11 6 12 3 Z"/>'],
      ['frost_bolt', 'line', 1.8, '<path d="M12 3 V21"/><path d="M4.5 7.5 L19.5 16.5"/><path d="M19.5 7.5 L4.5 16.5"/><path d="M12 6.5 L10 4.5 M12 6.5 L14 4.5 M12 17.5 L10 19.5 M12 17.5 L14 19.5"/>'],
      ['immolate', 'fill', 0, '<path fill-rule="evenodd" d="M12 2 C16 8 18 10 16.5 15 A5 5 0 1 1 7.5 15 C7 12 8 10.5 9 9.5 C9.5 12 11 12 11 11 C12 9 10.5 5 12 2 Z M12 12.8 C13 14.2 13.3 15.5 12 17.2 C11 15.8 11.1 14.4 12 12.8 Z"/>'],
      ['arcane_surge', 'fill', 0, '<path d="M12 2 L13.4 8.6 L18 5.6 L15.4 10.6 L22 12 L15.4 13.4 L18 18.4 L13.4 15.4 L12 22 L10.6 15.4 L6 18.4 L8.6 13.4 L2 12 L8.6 10.6 L6 5.6 L10.6 8.6 Z"/>'],
    ],
  },
  {
    title: 'Item Slots',
    file: 'ItemSlotIcon.tsx',
    note: 'filled · tinted by rarity in-app',
    icons: [
      ['weapon', 'fill', 0, '<path d="M12 2 L14 5 V13 H10 V5 Z"/><path d="M7.5 13 H16.5 V15 H7.5 Z"/><path d="M11 15 H13 V19 H11 Z"/><circle cx="12" cy="20.2" r="1.6"/>'],
      ['offhand', 'fill', 0, '<path d="M12 2 L20 5 V11 C20 16 16.5 19.8 12 22 C7.5 19.8 4 16 4 11 V5 Z"/>'],
      ['head', 'fill', 0, '<path d="M4 8 L7.2 12 L12 6.5 L16.8 12 L20 8 L18.6 18 H5.4 Z"/>'],
      ['chest', 'fill', 0, '<path d="M8 4 L12 7 L16 4 L21 7 L19 11 L16.5 9.5 L17 20 H7 L7 9.5 L5 11 L3 7 L8 4 Z"/>'],
      ['legs', 'fill', 0, '<path d="M7 3 H17 L16 21 H12.8 L12 11 L11.2 21 H8 Z"/>'],
      ['boots', 'fill', 0, '<path d="M8 3 H12 V13 H16.5 Q19 13 19 16 V19 H8 Z"/>'],
      ['gloves', 'fill', 0, '<rect x="8.2" y="4.5" width="1.7" height="6.5" rx="0.85"/><rect x="10.5" y="3.5" width="1.7" height="7.5" rx="0.85"/><rect x="12.8" y="3.7" width="1.7" height="7.3" rx="0.85"/><rect x="15.1" y="4.7" width="1.7" height="6.3" rx="0.85"/><path d="M7.8 9.5 H17.2 V15.5 H7.8 Z"/><path d="M7.8 10.5 Q5 10.3 4.9 12.5 Q4.8 14.6 7.8 14.3 Z"/><rect x="6" y="15" width="12" height="4.6" rx="1.3"/>'],
      ['accessory', 'fill', 0, '<path d="M12 3 L14.2 6 L12 8.2 L9.8 6 Z"/><path fill-rule="evenodd" d="M12 8.5 A6 6 0 1 1 11.99 8.5 Z M12 11.5 A3 3 0 1 0 12.01 11.5 Z"/>'],
      ['fallback', 'fill', 0, '<path d="M7 9 V7.5 Q7 4.5 12 4.5 Q17 4.5 17 7.5 V9 H19 L18 20 H6 L5 9 Z"/>'],
    ],
  },
  {
    title: 'Stats',
    file: 'StatIcon.tsx',
    note: 'hp = solid heart · maxHp = heart + plus',
    icons: [
      ['attack', 'fill', 0, '<path d="M12 2 L14 5 V13 H10 V5 Z"/><path d="M7.5 13 H16.5 V15 H7.5 Z"/><path d="M11 15 H13 V20 H11 Z"/>'],
      ['defense', 'fill', 0, '<path d="M12 2 L20 5 V11 C20 16 16.5 19.8 12 22 C7.5 19.8 4 16 4 11 V5 Z"/>'],
      ['hp', 'fill', 0, '<path d="M12 21 C12 21 3 14.2 3 8.6 C3 5.6 5.3 4 7.6 4 C9.6 4 11 5.4 12 7 C13 5.4 14.4 4 16.4 4 C18.7 4 21 5.6 21 8.6 C21 14.2 12 21 12 21 Z"/>'],
      ['maxHp', 'fill', 0, '<path fill-rule="evenodd" d="M12 21 C12 21 3 14.2 3 8.6 C3 5.6 5.3 4 7.6 4 C9.6 4 11 5.4 12 7 C13 5.4 14.4 4 16.4 4 C18.7 4 21 5.6 21 8.6 C21 14.2 12 21 12 21 Z M11.1 7.4 H12.9 V9.9 H15.4 V11.7 H12.9 V14.2 H11.1 V11.7 H8.6 V9.9 H11.1 Z"/>'],
    ],
  },
  {
    title: 'Damage Types',
    file: 'DamageTypeIcon.tsx',
    note: 'tinted by element in-app',
    icons: [
      ['physical', 'fill', 0, '<path d="M12 2 L14 5 V13 H10 V5 Z"/><path d="M7.5 13 H16.5 V15 H7.5 Z"/><path d="M11 15 H13 V20 H11 Z"/>'],
      ['fire', 'fill', 0, '<path d="M12 2 C16 8 18 10 16.5 15 A5 5 0 1 1 7.5 15 C7 12 8 10.5 9 9.5 C9.5 12 11 12 11 11 C12 9 10.5 5 12 2 Z"/>'],
      ['frost', 'line', 1.8, '<path d="M12 3 V21"/><path d="M4.5 7.5 L19.5 16.5"/><path d="M19.5 7.5 L4.5 16.5"/><path d="M12 6.5 L10 4.5 M12 6.5 L14 4.5 M12 17.5 L10 19.5 M12 17.5 L14 19.5"/>'],
      ['arcane', 'fill', 0, '<path d="M12 3 C12.6 9 13.2 10.4 20 12 C13.2 13.6 12.6 15 12 21 C11.4 15 10.8 13.6 4 12 C10.8 10.4 11.4 9 12 3 Z"/>'],
    ],
  },
  {
    title: 'Resources',
    file: 'ResourceIcon.tsx',
    note: 'per-archetype resource',
    icons: [
      ['rage', 'fill', 0, '<path d="M12 2 C16 8 18 10 16.5 15 A5 5 0 1 1 7.5 15 C7 12 8 10.5 9 9.5 C9.5 12 11 12 11 11 C12 9 10.5 5 12 2 Z"/>'],
      ['energy', 'fill', 0, '<path d="M13 2 L6 13 H10.5 L9.5 22 L18 10 H13 Z"/>'],
      ['mana', 'fill', 0, '<path d="M12 3 C12 3 5.5 11 5.5 15.2 A6.5 6.5 0 0 0 18.5 15.2 C18.5 11 12 3 12 3 Z"/>'],
    ],
  },
  {
    title: 'UI / HUD',
    file: 'UiIcon.tsx',
    note: 'one-off controls',
    icons: [
      ['settings', 'fill', 0, '<rect x="3" y="6.4" width="18" height="1.7" rx="0.85"/><rect x="3" y="12.1" width="18" height="1.7" rx="0.85"/><rect x="3" y="17.8" width="18" height="1.7" rx="0.85"/><path fill-rule="evenodd" d="M8 7.25 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M8 7.25 m-1 0 a1 1 0 1 1 2 0 a1 1 0 1 1 -2 0"/><path fill-rule="evenodd" d="M15 12.95 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M15 12.95 m-1 0 a1 1 0 1 1 2 0 a1 1 0 1 1 -2 0"/><path fill-rule="evenodd" d="M10 18.65 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M10 18.65 m-1 0 a1 1 0 1 1 2 0 a1 1 0 1 1 -2 0"/>'],
      ['inventory', 'fill', 0, '<path d="M8 6 Q8 3 12 3 Q16 3 16 6 V7 H14.6 V6 Q14.6 4.4 12 4.4 Q9.4 4.4 9.4 6 V7 H8 Z"/><path fill-rule="evenodd" d="M5 8 H19 Q20 8 20 9.5 V19 Q20 21 18 21 H6 Q4 21 4 19 V9.5 Q4 8 5 8 Z M8.5 12 H15.5 V14.5 H8.5 Z"/>'],
      ['close', 'line', 2.2, '<path d="M6 6 L18 18 M18 6 L6 18"/>'],
      ['warning', 'fill', 0, '<path fill-rule="evenodd" d="M12 3 L22 20 H2 Z M11.1 9 H12.9 V14.5 H11.1 Z M12 16 A1.15 1.15 0 1 1 11.99 16 Z"/>'],
      ['trophy', 'fill', 0, '<path d="M6 4 H18 V8 Q18 13 12 14 Q6 13 6 8 Z"/><path d="M6 5 H3.5 V7.5 Q3.5 10 6 10.2 V8.2 Q4.8 8 4.8 7 V6.4 H6 Z"/><path d="M18 5 H20.5 V7.5 Q20.5 10 18 10.2 V8.2 Q19.2 8 19.2 7 V6.4 H18 Z"/><rect x="11" y="13.5" width="2" height="4"/><path d="M8 18 H16 L17 21 H7 Z"/>'],
      ['buff', 'line', 2.6, '<path d="M5 15 L12 8 L19 15"/>'],
      ['debuff', 'line', 2.6, '<path d="M5 9 L12 16 L19 9"/>'],
      ['dot', 'fill', 0, '<path d="M12 3 C12 3 5.5 11 5.5 15.2 A6.5 6.5 0 0 0 18.5 15.2 C18.5 11 12 3 12 3 Z"/>'],
      ['flee', 'line', 2, '<path d="M4 8 H16"/><path d="M3 12 H19"/><path d="M6 16 H14"/>'],
    ],
  },
  {
    title: 'Creature Type Emblems',
    file: 'ElementEmblem.tsx',
    note: 'shown in element colors · creature-plate identity',
    icons: [
      ['Fire', 'fill', 0, '<path d="M12 2 C16 8 18 10 16.5 15 A5 5 0 1 1 7.5 15 C7 12 8 10.5 9 9.5 C9.5 12 11 12 11 11 C12 9 10.5 5 12 2 Z"/>', '#FF7043'],
      ['Frost', 'line', 1.8, '<path d="M12 3 V21"/><path d="M4.5 7.5 L19.5 16.5"/><path d="M19.5 7.5 L4.5 16.5"/><path d="M12 6.5 L10 4.5 M12 6.5 L14 4.5 M12 17.5 L10 19.5 M12 17.5 L14 19.5"/>', '#4FC3F7'],
      ['Water', 'fill', 0, '<path d="M12 3 C12 3 5.5 11 5.5 15.2 A6.5 6.5 0 0 0 18.5 15.2 C18.5 11 12 3 12 3 Z"/>', '#29B6F6'],
      ['Air', 'line', 2, '<path d="M3 8 H13 A2.6 2.6 0 1 0 10.4 5.4"/><path d="M3 12 H18 A2.6 2.6 0 1 1 15.4 14.6"/><path d="M3 16 H10"/>', '#90CAF9'],
      ['Earth', 'fill', 0, '<path d="M8 3 H16 L20 10 L12 21 L4 10 Z"/>', '#A1887F'],
      ['Nature', 'fill', 0, '<path d="M20 4 C9 4 4 11 4 20 C13 20 20 15 20 4 Z"/>', '#66BB6A'],
      ['Shadow', 'fill', 0, '<path d="M14.5 3.2 A9 9 0 1 0 14.5 20.8 A7 7 0 1 1 14.5 3.2 Z"/>', '#7E57C2'],
      ['Arcane', 'fill', 0, '<path d="M12 2 L13.4 8.6 L18 5.6 L15.4 10.6 L22 12 L15.4 13.4 L18 18.4 L13.4 15.4 L12 22 L10.6 15.4 L6 18.4 L8.6 13.4 L2 12 L8.6 10.6 L6 5.6 L10.6 8.6 Z"/>', '#BA68C8'],
      ['Spirit', 'fill', 0, '<path fill-rule="evenodd" d="M6 20.5 V11 A6 6 0 0 1 18 11 V20.5 L15.5 18.5 L13.5 20.5 L12 18.8 L10.5 20.5 L8.5 18.5 Z M10 10.5 m-1.1 0 a1.1 1.1 0 1 0 2.2 0 a1.1 1.1 0 1 0 -2.2 0 M14 10.5 m-1.1 0 a1.1 1.1 0 1 0 2.2 0 a1.1 1.1 0 1 0 -2.2 0"/>', '#B39DDB'],
      ['Undead', 'fill', 0, '<path fill-rule="evenodd" d="M6 10 A6 6 0 0 1 18 10 V14 Q18 16 16 16 V18 H8 V16 Q6 16 6 14 Z M9.8 10 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M14.2 10 m-1.5 0 a1.5 1.5 0 1 0 3 0 a1.5 1.5 0 1 0 -3 0 M12 12 L11.1 13.4 H12.9 Z"/>', '#90A4AE'],
      ['Beast', 'fill', 0, '<path d="M12 12 C15.5 12 18 14.5 18 17.5 C18 20 16 20.5 14 19.5 C13 19 11 19 10 19.5 C8 20.5 6 20 6 17.5 C6 14.5 8.5 12 12 12 Z"/><circle cx="6.5" cy="8.5" r="2"/><circle cx="17.5" cy="8.5" r="2"/><circle cx="9.5" cy="5.5" r="1.9"/><circle cx="14.5" cy="5.5" r="1.9"/>', '#FF8A65'],
      ['Vermin', 'fill', 0, '<path d="M12 4 C14.5 4 16 7 16 11 C16 16 14.5 20 12 20 C9.5 20 8 16 8 11 C8 7 9.5 4 12 4 Z"/><path d="M10.5 4 L8 2 M13.5 4 L16 2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>', '#9CCC65'],
      ['Ooze', 'fill', 0, '<path d="M5 14 C5 8.5 8.5 7 12 7 C15.5 7 19 8.5 19 14 C19 18 16.5 19.5 15.5 18.5 C15 20 13.5 20.5 13 19 C12.5 20.5 11 20.5 10.5 19 C9.5 20 6.5 19.5 5 14 Z"/>', '#26A69A'],
      ['Fungus', 'fill', 0, '<path d="M4 12 A8 6 0 0 1 20 12 Z"/><path d="M9.5 12 H14.5 V19 Q14.5 20.5 12 20.5 Q9.5 20.5 9.5 19 Z"/>', '#AB47BC'],
      ['Construct', 'fill', 0, '<path fill-rule="evenodd" d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z M12 9 A3 3 0 1 0 12.01 9 Z"/>', '#78909C'],
    ],
  },
];

const iconCount = GROUPS.reduce((n, g) => n + g.icons.length, 0);
const generatedAt = new Date().toISOString().slice(0, 10);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>StrideQuest — Icon Sheet</title>
<style>
  :root {
    --ground:#f4f2f7; --panel:#fff; --tile:#f7f6fb; --ink:#1a1822; --ink-soft:#57536a;
    --ink-faint:#8a8499; --line:#e6e2ee; --accent:#6a3fe0; --icon-size:40px; --tint:#2a2735;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --ground:#100e17; --panel:#1a1724; --tile:#211d2e; --ink:#ece9f5; --ink-soft:#b1abc3;
      --ink-faint:#7b7590; --line:#2c2839; --accent:#9d80ff; --tint:#ece9f5;
    }
  }
  :root[data-theme="light"] { --ground:#f4f2f7; --panel:#fff; --tile:#f7f6fb; --ink:#1a1822; --ink-soft:#57536a; --ink-faint:#8a8499; --line:#e6e2ee; --accent:#6a3fe0; --tint:#2a2735; }
  :root[data-theme="dark"] { --ground:#100e17; --panel:#1a1724; --tile:#211d2e; --ink:#ece9f5; --ink-soft:#b1abc3; --ink-faint:#7b7590; --line:#2c2839; --accent:#9d80ff; --tint:#ece9f5; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--ground); color:var(--ink); font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; line-height:1.5; }
  .wrap { max-width:1080px; margin:0 auto; padding:0 22px; }
  header { padding:44px 0 22px; }
  .eyebrow { font-family:ui-monospace,Menlo,monospace; font-size:12px; letter-spacing:.2em; text-transform:uppercase; color:var(--accent); font-weight:600; margin-bottom:14px; }
  h1 { font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; font-weight:600; font-size:clamp(30px,5vw,46px); letter-spacing:-.015em; margin:0 0 12px; }
  .sub { color:var(--ink-soft); max-width:68ch; margin:0; font-size:15px; }
  .sub code { font-family:ui-monospace,Menlo,monospace; font-size:13px; color:var(--ink); }
  .controls { position:sticky; top:0; z-index:5; background:color-mix(in srgb,var(--ground) 88%,transparent); backdrop-filter:blur(8px); border-bottom:1px solid var(--line); padding:14px 0; margin-bottom:8px; }
  .controls-inner { display:flex; flex-wrap:wrap; gap:22px 32px; align-items:center; }
  .ctl { display:flex; align-items:center; gap:12px; }
  .ctl > label { font-family:ui-monospace,Menlo,monospace; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--ink-faint); white-space:nowrap; }
  input[type="range"] { width:190px; accent-color:var(--accent); }
  .sizeval { font-family:ui-monospace,Menlo,monospace; font-size:13px; color:var(--ink); min-width:44px; }
  .swatches { display:flex; gap:7px; flex-wrap:wrap; }
  .swatch { width:26px; height:26px; border-radius:7px; border:2px solid transparent; cursor:pointer; padding:0; outline:none; box-shadow:inset 0 0 0 1px rgba(128,128,128,.25); }
  .swatch[aria-pressed="true"], .swatch:focus-visible { border-color:var(--accent); }
  .presets { display:flex; gap:6px; }
  .preset { font-family:ui-monospace,Menlo,monospace; font-size:12px; color:var(--ink-soft); background:var(--tile); border:1px solid var(--line); border-radius:6px; padding:4px 9px; cursor:pointer; }
  .preset:hover { border-color:var(--accent); color:var(--ink); }
  section { padding:26px 0; border-bottom:1px solid var(--line); }
  .sec-head { display:flex; align-items:baseline; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
  .sec-head h2 { font-family:"Iowan Old Style",Palatino,Georgia,serif; font-weight:600; font-size:21px; margin:0; }
  .sec-head .count { font-family:ui-monospace,Menlo,monospace; font-size:12px; color:var(--ink-faint); }
  .sec-head .note { margin-left:auto; font-size:12.5px; color:var(--ink-faint); }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
  .tile { background:var(--tile); border:1px solid var(--line); border-radius:12px; padding:16px 8px 12px; display:flex; flex-direction:column; gap:12px; min-height:110px; }
  .glyph { display:flex; align-items:center; justify-content:center; height:72px; color:var(--tint); }
  .glyph svg { width:var(--icon-size); height:var(--icon-size); display:block; }
  .tile figcaption { width:100%; font-family:ui-monospace,Menlo,monospace; font-size:11px; color:var(--ink-soft); text-align:center; overflow-wrap:anywhere; line-height:1.3; }
  footer { padding:30px 0 60px; }
  footer p { font-family:ui-monospace,Menlo,monospace; font-size:12px; color:var(--ink-faint); margin:0; }
  @media (max-width:560px) { .grid { grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); } input[type="range"]{ width:130px; } }
</style>
</head>
<body>
<header>
  <div class="wrap">
    <div class="eyebrow">StrideQuest · Vector Icons</div>
    <h1>Icon Sheet</h1>
    <p class="sub">A browser preview of every <code>react-native-svg</code> glyph in <code>src/components/icons/</code> — no build required. Scrub <strong>size</strong> down to the in-app range (~13–30px) to check small-size legibility, and try the <strong>tint</strong> swatches. Regenerate with <code>yarn icons:sheet</code>.</p>
  </div>
</header>
<div class="controls">
  <div class="wrap controls-inner">
    <div class="ctl">
      <label for="size">Size</label>
      <input id="size" type="range" min="12" max="72" value="40" />
      <span class="sizeval" id="sizeval">40px</span>
      <div class="presets">
        <button class="preset" data-size="13">13</button>
        <button class="preset" data-size="22">22</button>
        <button class="preset" data-size="26">26</button>
        <button class="preset" data-size="50">50</button>
      </div>
    </div>
    <div class="ctl">
      <label>Tint</label>
      <div class="swatches" id="swatches">
        <button class="swatch" title="Ink (theme)" data-tint="ink" aria-pressed="true" style="background:#8a8499"></button>
        <button class="swatch" title="White" data-tint="#ffffff" style="background:#ffffff"></button>
        <button class="swatch" title="Physical" data-tint="#ECEFF1" style="background:#ECEFF1"></button>
        <button class="swatch" title="Fire" data-tint="#FF7043" style="background:#FF7043"></button>
        <button class="swatch" title="Frost" data-tint="#4FC3F7" style="background:#4FC3F7"></button>
        <button class="swatch" title="Arcane" data-tint="#BA68C8" style="background:#BA68C8"></button>
        <button class="swatch" title="Rare" data-tint="#2196F3" style="background:#2196F3"></button>
        <button class="swatch" title="Epic" data-tint="#9C27B0" style="background:#9C27B0"></button>
        <button class="swatch" title="Legendary" data-tint="#FF9800" style="background:#FF9800"></button>
      </div>
    </div>
  </div>
</div>
<main class="wrap" id="sheet"></main>
<footer><div class="wrap"><p>StrideQuest icon sheet · ${iconCount} glyphs · generated ${generatedAt} by scripts/gen-icon-sheet.mjs</p></div></footer>
<script>
  const LINE = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const groups = ${JSON.stringify(GROUPS)};
  function svgFor(mode, w, inner) {
    const g = mode === 'line' ? '<g ' + LINE + ' stroke-width="' + w + '">' + inner + '</g>' : '<g fill="currentColor">' + inner + '</g>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + g + '</svg>';
  }
  const sheet = document.getElementById('sheet');
  for (const grp of groups) {
    const sec = document.createElement('section');
    const tiles = grp.icons.map(([name, mode, w, inner, fixed]) =>
      '<figure class="tile"><div class="glyph"' + (fixed ? ' style="color:' + fixed + '"' : '') + '>' + svgFor(mode, w, inner) + '</div><figcaption>' + name + '</figcaption></figure>'
    ).join('');
    sec.innerHTML =
      '<div class="sec-head"><h2>' + grp.title + '</h2><span class="count">' + grp.icons.length + ' · ' + grp.file + '</span><span class="note">' + grp.note + '</span></div>' +
      '<div class="grid">' + tiles + '</div>';
    sheet.appendChild(sec);
  }
  const root = document.documentElement;
  const size = document.getElementById('size');
  const sizeval = document.getElementById('sizeval');
  function setSize(v) { v = Math.max(12, Math.min(72, v)); size.value = v; root.style.setProperty('--icon-size', v + 'px'); sizeval.textContent = v + 'px'; }
  size.addEventListener('input', () => setSize(+size.value));
  document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => setSize(+b.dataset.size)));
  const inkColor = () => getComputedStyle(root).getPropertyValue('--ink').trim() || '#888';
  const swatches = [...document.querySelectorAll('.swatch')];
  function setTint(val, btn) { root.style.setProperty('--tint', val === 'ink' ? inkColor() : val); swatches.forEach(s => s.setAttribute('aria-pressed', s === btn ? 'true' : 'false')); }
  swatches.forEach(s => s.addEventListener('click', () => setTint(s.dataset.tint, s)));
  setTint('ink', swatches[0]);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const active = swatches.find(s => s.getAttribute('aria-pressed') === 'true');
    if (active && active.dataset.tint === 'ink') setTint('ink', active);
  });
</script>
</body>
</html>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`Wrote ${OUT} (${iconCount} glyphs across ${GROUPS.length} groups).`);
