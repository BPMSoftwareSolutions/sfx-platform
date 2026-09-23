import type { MaterialShape } from './scl-theme';

/**
 * Shape geometry for the canonical component materials — §12.3.
 *
 * The material plate is clipped to the token's defining silhouette and the thin contour is
 * reasserted over it, exactly as the content lab's enhanced infographics composite the plates
 * (`enhance_infographics.py`). Every path is a pure function of the drawn box: the same graph
 * always produces the same geometry, so SSR, exports and tests agree.
 *
 * The silhouettes stay wide-safe: slanted and notched edges live in the outer bands so the
 * wrapped label keeps a continuous face, and `details` reassert only glyphs the plate carries.
 */

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MaterialGeometry {
  /** The defining silhouette: clip, face and contour all use it. */
  silhouette: string;
  /** Decorative strokes reasserted over the material (never enclosing rectangles). */
  details: string[];
  /** Left inset the wrapped label must respect so it never crosses a shape's glyph band. */
  labelInsetX: number;
}

/**
 * Left label inset per silhouette. Shapes whose defining glyphs live in the left band (forks,
 * hubs, merges, the shield check, the document stack) push the text right of them.
 */
const LABEL_INSET: Record<MaterialShape, number> = {
  'rounded-rectangle': 14,
  'beveled-rectangle': 14,
  capsule: 18,
  socket: 24,
  'tabbed-tile': 14,
  'shield-check': 58,
  'document-stack': 24,
  'person-in-gate': 24,
  'top-band-frame': 14,
  fork: 58,
  'radial-hub': 58,
  merge: 58,
  diamond: 36,
  'solid-end-cap': 20,
  'barred-octagon': 24,
};

const n = (value: number) => Math.round(value * 100) / 100;

function roundedRect(box: Box, inset = 0, radius?: number): string {
  const x = box.x + inset;
  const y = box.y + inset;
  const w = box.width - inset * 2;
  const h = box.height - inset * 2;
  const r = Math.min(radius ?? Math.min(16, h * 0.32), w / 2, h / 2);
  return [
    `M ${n(x + r)} ${n(y)}`,
    `H ${n(x + w - r)}`,
    `Q ${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)}`,
    `V ${n(y + h - r)}`,
    `Q ${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}`,
    `H ${n(x + r)}`,
    `Q ${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)}`,
    `V ${n(y + r)}`,
    `Q ${n(x)} ${n(y)} ${n(x + r)} ${n(y)}`,
    'Z',
  ].join(' ');
}

function beveledRect(box: Box, inset = 0): string {
  const x = box.x + inset;
  const y = box.y + inset;
  const w = box.width - inset * 2;
  const h = box.height - inset * 2;
  const b = Math.min(16, h * 0.34, w * 0.2);
  return [
    `M ${n(x + b)} ${n(y)}`,
    `H ${n(x + w - b)}`,
    `L ${n(x + w)} ${n(y + b)}`,
    `V ${n(y + h - b)}`,
    `L ${n(x + w - b)} ${n(y + h)}`,
    `H ${n(x + b)}`,
    `L ${n(x)} ${n(y + h - b)}`,
    `V ${n(y + b)}`,
    'Z',
  ].join(' ');
}

function capsule(box: Box, inset = 0): string {
  const x = box.x + inset;
  const y = box.y + inset;
  const w = box.width - inset * 2;
  const h = box.height - inset * 2;
  const r = Math.min(h / 2, w / 2);
  return [
    `M ${n(x + r)} ${n(y)}`,
    `H ${n(x + w - r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}`,
    `H ${n(x + r)}`,
    `A ${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}`,
    'Z',
  ].join(' ');
}

function octagon(box: Box, inset = 0): string {
  const x = box.x + inset;
  const y = box.y + inset;
  const w = box.width - inset * 2;
  const h = box.height - inset * 2;
  const b = Math.min(18, h * 0.36, w * 0.2);
  return [
    `M ${n(x + b)} ${n(y)}`,
    `H ${n(x + w - b)}`,
    `L ${n(x + w)} ${n(y + b)}`,
    `V ${n(y + h - b)}`,
    `L ${n(x + w - b)} ${n(y + h)}`,
    `H ${n(x + b)}`,
    `L ${n(x)} ${n(y + h - b)}`,
    `V ${n(y + b)}`,
    'Z',
  ].join(' ');
}

function socket(box: Box): string {
  const x = box.x;
  const y = box.y;
  const w = box.width;
  const h = box.height;
  const m = Math.min(14, h * 0.3);
  const notch = Math.min(12, h * 0.22);
  return [
    `M ${n(x + m)} ${n(y)}`,
    `H ${n(x + w - m)}`,
    `Q ${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + m)}`,
    `V ${n(y + h - m)}`,
    `Q ${n(x + w)} ${n(y + h)} ${n(x + w - m)} ${n(y + h)}`,
    `H ${n(x + m)}`,
    `Q ${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - m)}`,
    `V ${n(y + h * 0.64)}`,
    `Q ${n(x + notch)} ${n(y + h * 0.5)} ${n(x)} ${n(y + h * 0.36)}`,
    `V ${n(y + m)}`,
    `Q ${n(x)} ${n(y)} ${n(x + m)} ${n(y)}`,
    'Z',
  ].join(' ');
}

function tabbedTile(box: Box): string {
  const x = box.x;
  const y = box.y;
  const w = box.width;
  const h = box.height;
  const tab = Math.min(14, h * 0.32);
  const tabWidth = Math.min(Math.max(w * 0.34, 90), w * 0.55);
  const r = Math.min(12, h * 0.24);
  const main = roundedRect({ x, y: y + tab, width: w, height: h - tab }, 0, r);
  const tabPath = [
    `M ${n(x + r)} ${n(y + tab)}`,
    `V ${n(y + r)}`,
    `Q ${n(x)} ${n(y)} ${n(x + r)} ${n(y)}`,
    `H ${n(x + tabWidth - r)}`,
    `Q ${n(x + tabWidth)} ${n(y)} ${n(x + tabWidth)} ${n(y + r)}`,
    `V ${n(y + tab)}`,
    'Z',
  ].join(' ');
  return `${main} ${tabPath}`;
}

function documentStack(box: Box): string {
  const x = box.x;
  const y = box.y;
  const w = box.width;
  const h = box.height;
  const back = roundedRect({ x: x + 4, y: y + 4, width: w - 12, height: h - 12 }, 0, 8);
  const front = roundedRect({ x: x + 12, y: y + 12, width: w - 24, height: h - 24 }, 0, 8);
  return `${back} ${front}`;
}

function shield(box: Box): string {
  const x = box.x;
  const y = box.y;
  const w = box.width;
  const h = box.height;
  const m = Math.min(12, w * 0.1);
  return [
    `M ${n(x + m)} ${n(y)}`,
    `H ${n(x + w - m)}`,
    `V ${n(y + h * 0.52)}`,
    `Q ${n(x + w - m)} ${n(y + h * 0.82)} ${n(x + w / 2)} ${n(y + h)}`,
    `Q ${n(x + m)} ${n(y + h * 0.82)} ${n(x + m)} ${n(y + h * 0.52)}`,
    'Z',
  ].join(' ');
}

function topBandFrame(box: Box, inset = 0): string {
  return roundedRect(box, inset, 12);
}

function fork(box: Box): string {
  const x = box.x;
  const y = box.y;
  const w = box.width;
  const h = box.height;
  const g = Math.min(52, w * 0.22);
  const body = roundedRect({ x: x + g - 8, y, width: w - g + 8, height: h }, 0, 12);
  const left = [
    `M ${n(x + 4)} ${n(y + 8)}`,
    `L ${n(x + g)} ${n(y + h * 0.32)}`,
    `V ${n(y + h * 0.68)}`,
    `L ${n(x + 4)} ${n(y + h - 8)}`,
    'Z',
  ].join(' ');
  return `${body} ${left}`;
}

function radialHub(box: Box): string {
  const x = box.x;
  const y = box.y;
  const w = box.width;
  const h = box.height;
  const g = Math.min(58, w * 0.22);
  const r = Math.min(h * 0.42, g * 0.55);
  const cx = x + g * 0.55;
  const cy = y + h / 2;
  const body = roundedRect({ x: x + g - 8, y, width: w - g + 8, height: h }, 0, 12);
  const hub = [
    `M ${n(cx - r)} ${n(cy)}`,
    `A ${n(r)} ${n(r)} 0 1 1 ${n(cx + r)} ${n(cy)}`,
    `A ${n(r)} ${n(r)} 0 1 1 ${n(cx - r)} ${n(cy)}`,
    'Z',
  ].join(' ');
  return `${body} ${hub}`;
}

function merge(box: Box): string {
  const x = box.x;
  const y = box.y;
  const w = box.width;
  const h = box.height;
  const g = Math.min(52, w * 0.22);
  const body = roundedRect({ x: x + g - 8, y, width: w - g + 8, height: h }, 0, 12);
  const left = [
    `M ${n(x + 4)} ${n(y + 6)}`,
    `L ${n(x + g - 4)} ${n(y + h * 0.42)}`,
    `L ${n(x + g - 4)} ${n(y + h * 0.58)}`,
    `L ${n(x + 4)} ${n(y + h - 6)}`,
    'Z',
  ].join(' ');
  return `${body} ${left}`;
}

function diamond(box: Box): string {
  const x = box.x;
  const y = box.y;
  const w = box.width;
  const h = box.height;
  const b = Math.min(26, h * 0.5, w * 0.15);
  return [
    `M ${n(x)} ${n(y + h / 2)}`,
    `L ${n(x + b)} ${n(y)}`,
    `H ${n(x + w - b)}`,
    `L ${n(x + w)} ${n(y + h / 2)}`,
    `L ${n(x + w - b)} ${n(y + h)}`,
    `H ${n(x + b)}`,
    'Z',
  ].join(' ');
}

function solidEndCap(box: Box): string {
  const x = box.x;
  const y = box.y;
  const w = box.width;
  const h = box.height;
  const r = Math.min(h / 2, w / 2);
  return [
    `M ${n(x)} ${n(y)}`,
    `H ${n(x + w)}`,
    `V ${n(y + h - r)}`,
    `Q ${n(x + w)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)}`,
    `H ${n(x + r)}`,
    `Q ${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - r)}`,
    'Z',
  ].join(' ');
}

function personGate(box: Box): string {
  return roundedRect(box, 0, 12);
}

export function materialGeometry(shape: MaterialShape, box: Box): MaterialGeometry {
  return { ...silhouetteGeometry(shape, box), labelInsetX: LABEL_INSET[shape] ?? 14 };
}

function silhouetteGeometry(shape: MaterialShape, box: Box): Omit<MaterialGeometry, 'labelInsetX'> {
  const cx = box.x + box.width;
  const cy = box.y + box.height / 2;
  const glyph = Math.min(11, box.height * 0.3);

  switch (shape) {
    case 'rounded-rectangle':
      return { silhouette: roundedRect(box), details: [] };
    case 'beveled-rectangle':
      return { silhouette: beveledRect(box), details: [] };
    case 'capsule':
      return { silhouette: capsule(box), details: [] };
    case 'socket':
      return { silhouette: socket(box), details: [] };
    case 'tabbed-tile':
      return { silhouette: tabbedTile(box), details: [] };
    case 'shield-check':
      return {
        silhouette: shield(box),
        details: [
          `M ${n(box.x + 18)} ${n(box.y + box.height * 0.48)} L ${n(box.x + 30)} ${n(box.y + box.height * 0.6)} L ${n(box.x + 50)} ${n(box.y + box.height * 0.34)}`,
        ],
      };
    case 'document-stack':
      return {
        silhouette: documentStack(box),
        details: [
          `M ${n(box.x + 20)} ${n(box.y + 20)} H ${n(box.x + box.width - 32)}`,
          `M ${n(box.x + 20)} ${n(box.y + 30)} H ${n(box.x + box.width - 44)}`,
        ],
      };
    case 'person-in-gate':
      return {
        silhouette: personGate(box),
        details: [
          `M ${n(cx - 16)} ${n(cy + 4)} A ${n(glyph)} ${n(glyph)} 0 1 1 ${n(cx - 16 + glyph * 2)} ${n(cy + 4)}`,
          `M ${n(cx - 26)} ${n(box.y + box.height - 12)} Q ${n(cx - 16)} ${n(cy - 2)} ${n(cx - 6)} ${n(box.y + box.height - 12)}`,
        ],
      };
    case 'top-band-frame':
      return {
        silhouette: topBandFrame(box),
        details: [
          `M ${n(box.x + 4)} ${n(box.y + Math.min(14, box.height * 0.3))} H ${n(box.x + box.width - 4)}`,
        ],
      };
    case 'fork':
      return {
        silhouette: fork(box),
        details: [
          `M ${n(box.x + 10)} ${n(box.y + box.height * 0.3)} Q ${n(box.x + 34)} ${n(cy)} ${n(box.x + 10)} ${n(box.y + box.height * 0.7)}`,
        ],
      };
    case 'radial-hub':
      return {
        silhouette: radialHub(box),
        details: [
          `M ${n(box.x + 8)} ${n(box.y + box.height * 0.22)} Q ${n(box.x + 34)} ${n(cy)} ${n(box.x + 8)} ${n(box.y + box.height * 0.78)}`,
        ],
      };
    case 'merge':
      return {
        silhouette: merge(box),
        details: [
          `M ${n(box.x + 10)} ${n(box.y + box.height * 0.28)} Q ${n(box.x + 38)} ${n(cy)} ${n(box.x + 52)} ${n(cy)}`,
          `M ${n(box.x + 10)} ${n(box.y + box.height * 0.72)} Q ${n(box.x + 38)} ${n(cy)} ${n(box.x + 52)} ${n(cy)}`,
        ],
      };
    case 'diamond':
      return { silhouette: diamond(box), details: [] };
    case 'solid-end-cap':
      return { silhouette: solidEndCap(box), details: [] };
    case 'barred-octagon':
      return {
        silhouette: octagon(box),
        details: [
          `M ${n(box.x + box.width * 0.38)} ${n(box.y + box.height * 0.78)} L ${n(box.x + box.width * 0.62)} ${n(box.y + box.height * 0.22)}`,
        ],
      };
  }
}
