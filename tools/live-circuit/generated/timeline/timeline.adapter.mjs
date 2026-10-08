// Generated adapter stub for the ui-component.v1 kind "timeline" (version 1).
// Merge into live-circuit/circuit/ui-components.js:
//   1. add the timeline entry below to UI_COMPONENT_ROLES;
//   2. attach UI_COMPONENTS["timeline"] = { version: 1, supportedRoles, render: renderTimeline };
// Every render read resolves through the role table; no literal role string
// may be read outside it (K1), so a contract role cannot silently drop.
// This module is importable for "new-component.mjs --check" before the merge.

export const UI_COMPONENT_ROLES = {
  "timeline": {
    version: 1,
    roles: ["spans","duration","playhead","seek"],
    props: [],
  },
};

// Declared props and bindings the validator admits: roles ∪ props, derived.
export const supportedRoles = Object.freeze([
  ...UI_COMPONENT_ROLES["timeline"].roles,
  ...UI_COMPONENT_ROLES["timeline"].props,
]);

export function renderTimeline(container, entry, context) {
  const section = h("section", { class: "page-section", id: entry?.sectionId });
  const wrap = h("div", { class: "wrap" });
  const spansValue = declared(context, entry, "spans");
  const durationValue = declared(context, entry, "duration");
  const playheadValue = declared(context, entry, "playhead");
  const seekValue = declared(context, entry, "seek");
  if (spansValue !== undefined && spansValue !== null && spansValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "spans") }));
  if (durationValue !== undefined && durationValue !== null && durationValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "duration") }));
  if (playheadValue !== undefined && playheadValue !== null && playheadValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "playhead") }));
  if (seekValue !== undefined && seekValue !== null && seekValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "seek") }));
  if (wrap.hasChildNodes()) section.append(wrap);
  container.append(section);
}
