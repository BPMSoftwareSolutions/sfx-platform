// Generated adapter stub for the ui-component.v1 kind "chart" (version 1).
// Merge into live-circuit/circuit/ui-components.js:
//   1. add the chart entry below to UI_COMPONENT_ROLES;
//   2. attach UI_COMPONENTS["chart"] = { version: 1, supportedRoles, render: renderChart };
// Every render read resolves through the role table; no literal role string
// may be read outside it (K1), so a contract role cannot silently drop.
// This module is importable for "new-component.mjs --check" before the merge.

export const UI_COMPONENT_ROLES = {
  "chart": {
    version: 1,
    roles: ["series","maximum","caption","empty"],
    props: [],
  },
};

// Declared props and bindings the validator admits: roles ∪ props, derived.
export const supportedRoles = Object.freeze([
  ...UI_COMPONENT_ROLES["chart"].roles,
  ...UI_COMPONENT_ROLES["chart"].props,
]);

export function renderChart(container, entry, context) {
  const section = h("section", { class: "page-section", id: entry?.sectionId });
  const wrap = h("div", { class: "wrap" });
  const seriesValue = declared(context, entry, "series");
  const maximumValue = declared(context, entry, "maximum");
  const captionValue = declared(context, entry, "caption");
  const emptyValue = declared(context, entry, "empty");
  if (seriesValue !== undefined && seriesValue !== null && seriesValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "series") }));
  if (maximumValue !== undefined && maximumValue !== null && maximumValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "maximum") }));
  if (captionValue !== undefined && captionValue !== null && captionValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "caption") }));
  if (emptyValue !== undefined && emptyValue !== null && emptyValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "empty") }));
  if (wrap.hasChildNodes()) section.append(wrap);
  container.append(section);
}
