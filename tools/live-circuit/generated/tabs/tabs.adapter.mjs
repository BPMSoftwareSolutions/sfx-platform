// Generated adapter stub for the ui-component.v1 kind "tabs" (version 1).
// Merge into live-circuit/circuit/ui-components.js:
//   1. add the tabs entry below to UI_COMPONENT_ROLES;
//   2. attach UI_COMPONENTS["tabs"] = { version: 1, supportedRoles, render: renderTabs };
// Every render read resolves through the role table; no literal role string
// may be read outside it (K1), so a contract role cannot silently drop.
// This module is importable for "new-component.mjs --check" before the merge.

export const UI_COMPONENT_ROLES = {
  "tabs": {
    version: 1,
    roles: ["tabs","selected"],
    props: [],
  },
};

// Declared props and bindings the validator admits: roles ∪ props, derived.
export const supportedRoles = Object.freeze([
  ...UI_COMPONENT_ROLES["tabs"].roles,
  ...UI_COMPONENT_ROLES["tabs"].props,
]);

export function renderTabs(container, entry, context) {
  const section = h("section", { class: "page-section", id: entry?.sectionId });
  const wrap = h("div", { class: "wrap" });
  const tabsValue = declared(context, entry, "tabs");
  const selectedValue = declared(context, entry, "selected");
  if (tabsValue !== undefined && tabsValue !== null && tabsValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "tabs") }));
  if (selectedValue !== undefined && selectedValue !== null && selectedValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "selected") }));
  if (wrap.hasChildNodes()) section.append(wrap);
  container.append(section);
}
