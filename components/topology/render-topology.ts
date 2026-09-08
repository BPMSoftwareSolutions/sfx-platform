import type { TopologyNode, TopologyRoute, TopologyView } from '@/contracts/topology';

import {
  NODE_GRAMMAR,
  TOPOLOGY_INK,
  TOPOLOGY_MUTED,
  TOPOLOGY_SURFACE,
  routeColor,
  routeHasArrow,
  routeIsDashed,
  routeLabel,
} from './grammar';

/**
 * Topology renderer — ADR 0001.
 *
 * Produces the diagram SVG from a view's graph and its measured layout. Written as a string
 * builder rather than a React tree for two reasons: the same function serves both the page and
 * the on-demand endpoint without pulling `react-dom/server` into a route, and the largest view
 * carries 1,493 components, where reconciliation buys nothing.
 *
 * Geometry is never invented. Node boxes and route paths come from `layout` — Graphviz's measured
 * output — and this module only decides how those shapes are painted.
 */

/** Escapes text for XML content and double-quoted attribute values. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Wraps a label to a pixel width. Deterministic, and marks truncation rather than hiding it. */
export function wrapLabel(text: string, maxWidth: number, fontSize: number, maxLines: number): string[] {
  // Average glyph advance for the UI stack at this size.
  const columns = Math.max(8, Math.floor(maxWidth / (fontSize * 0.55)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let consumed = 0;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > columns && line) {
      lines.push(line);
      consumed += line.length + 1;
      if (lines.length === maxLines) {
        line = '';
        break;
      }
      line = word;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) {
    lines.push(line);
    consumed += line.length;
  }
  const last = lines[lines.length - 1];
  if (lines.length === maxLines && consumed < text.length && last) {
    lines[lines.length - 1] = `${last.replace(/\s+\S*$/, '')}…`;
  }
  return lines;
}

/** Node outline for a canonical grammar shape, drawn inside the measured box. */
function shapePath(shape: string, x: number, y: number, w: number, h: number): string | undefined {
  const bevel = Math.min(18, h / 4);
  switch (shape) {
    case 'diamond':
      return `M ${x + w / 2} ${y} L ${x + w} ${y + h / 2} L ${x + w / 2} ${y + h} L ${x} ${y + h / 2} Z`;
    case 'beveled-rectangle':
      return `M ${x + bevel} ${y} L ${x + w} ${y} L ${x + w} ${y + h - bevel} L ${x + w - bevel} ${y + h} L ${x} ${y + h} L ${x} ${y + bevel} Z`;
    case 'barred-octagon':
      return `M ${x + bevel} ${y} L ${x + w - bevel} ${y} L ${x + w} ${y + bevel} L ${x + w} ${y + h - bevel} L ${x + w - bevel} ${y + h} L ${x + bevel} ${y + h} L ${x} ${y + h - bevel} L ${x} ${y + bevel} Z`;
    case 'merge':
      return `M ${x} ${y} L ${x + w} ${y} L ${x + w / 2} ${y + h} Z`;
    case 'radial-hub':
      return `M ${x + w / 2} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    default:
      return undefined;
  }
}

function cornerRadius(shape: string, h: number): number {
  if (shape === 'capsule') return h / 2;
  if (shape === 'socket') return 6;
  if (shape === 'tabbed-tile') return 4;
  if (shape === 'solid-end-cap') return 10;
  return 15;
}

function text(
  value: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  bold = false,
): string {
  if (!value) return '';
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="middle"${
    bold ? ' font-weight="600"' : ''
  }>${esc(value)}</text>`;
}

function renderNode(node: TopologyNode, box: readonly [number, number, number, number]): string {
  const [x, y, w, h] = box;
  const grammar = NODE_GRAMMAR[node.kind];
  const compact =
    grammar.shape === 'radial-hub' || grammar.shape === 'merge' || grammar.shape === 'solid-end-cap';
  const pad = grammar.shape === 'diamond' ? 55 : 28;

  const path = shapePath(grammar.shape, x, y, w, h);
  const outline = path
    ? `<path d="${path}" fill="#0e2333" stroke="${grammar.color}" stroke-width="2.2"/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${cornerRadius(grammar.shape, h)}" fill="#0e2333" stroke="${grammar.color}" stroke-width="2.2"/>`;

  // The material plate is decorative: hidden from assistive technology, ignoring pointers (§6.6).
  const material = `<image href="${grammar.texture}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" class="topology-material" aria-hidden="true"/>`;

  const body = compact
    ? text(grammar.label.toUpperCase(), x + w / 2, y - 13, 11, grammar.color, true)
    : text(grammar.label.toUpperCase(), x + w / 2, y + 30, 11, grammar.color, true) +
      wrapLabel(node.label, w - pad * 2, 17, 3)
        .map((line, i) => text(line, x + w / 2, y + 58 + i * 23, 17, TOPOLOGY_INK, true))
        .join('');

  const captionValue = compact ? node.label : node.detail;
  const caption = captionValue
    ? text(
        captionValue.length > 43 ? `${captionValue.slice(0, 42)}…` : captionValue,
        x + w / 2,
        y + h + (compact ? 25 : 23),
        compact ? 15 : 11,
        compact ? TOPOLOGY_INK : TOPOLOGY_MUTED,
      )
    : '';

  return (
    `<g id="${esc(node.id)}" data-entity="${esc(node.id)}" data-type="${esc(node.kind)}" role="button" tabindex="0"` +
    ` aria-label="${esc(`${grammar.label}: ${node.label}`)}" class="topology-node">` +
    `<title>${esc(node.label)}</title><desc>${esc(node.identity)}</desc>` +
    outline +
    material +
    body +
    caption +
    `</g>`
  );
}

function renderRoute(
  route: TopologyRoute,
  path: string,
  label: readonly [number, number] | undefined,
  markerId: string,
): string {
  const color = routeColor(route.kind);
  const dash = routeIsDashed(route.kind) ? ' stroke-dasharray="7 5"' : '';
  const marker = routeHasArrow(route.kind) ? ` marker-end="url(#${markerId})"` : '';
  const caption = route.label.length > 48 ? `${route.label.slice(0, 47)}…` : route.label;

  return (
    `<g id="${esc(route.id)}" data-route="${esc(route.id)}" data-source="${esc(route.source)}"` +
    ` data-target="${esc(route.target)}" role="button" tabindex="0"` +
    ` aria-label="${esc(`${routeLabel(route.kind)}: ${route.label}`)}" class="topology-route">` +
    `<title>${esc(route.identity)}</title><desc>${esc(`${routeLabel(route.kind)} / ${route.label}`)}</desc>` +
    `<path class="route-path" d="${esc(path)}" fill="none" stroke="${color}" stroke-width="2"${dash}${marker}/>` +
    (label && caption ? text(caption, label[0], label[1], 12, color) : '') +
    `</g>`
  );
}

export function renderTopologySvg(view: TopologyView): string {
  const { layout } = view;
  const markerId = `${view.id}-arrow`;
  const titleId = `${view.id}-title`;
  const descId = `${view.id}-desc`;

  const routes = view.routes
    .map((route) => {
      const path = layout.routes[route.id];
      // A route with no measured geometry is omitted rather than drawn along a guessed line.
      return path ? renderRoute(route, path, layout.routeLabels[route.id], markerId) : '';
    })
    .join('');

  const nodes = view.nodes
    .map((node) => {
      const box = layout.boxes[node.id];
      return box ? renderNode(node, box) : '';
    })
    .join('');

  return (
    `<svg viewBox="0 0 ${layout.width} ${layout.height}" width="100%" role="img"` +
    ` aria-labelledby="${esc(titleId)} ${esc(descId)}" xmlns="http://www.w3.org/2000/svg">` +
    `<title id="${esc(titleId)}">${esc(view.label)}</title>` +
    `<desc id="${esc(descId)}">${esc(
      `${view.nodes.length} components and ${view.routes.length} declared routes. The component list beside this diagram carries the same content as text.`,
    )}</desc>` +
    `<defs><marker id="${markerId}" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">` +
    `<path d="M0 0 L9 4 L0 8" fill="none" stroke="#a3c3cd" stroke-width="1.8"/></marker></defs>` +
    `<rect x="0" y="0" width="${layout.width}" height="${layout.height}" fill="${TOPOLOGY_SURFACE}"/>` +
    routes +
    nodes +
    `</svg>`
  );
}
