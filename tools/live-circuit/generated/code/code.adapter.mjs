// Generated adapter stub for the ui-component.v1 kind "code" (version 1).
// Merge into live-circuit/circuit/ui-components.js:
//   1. add the code entry below to UI_COMPONENT_ROLES;
//   2. attach UI_COMPONENTS["code"] = { version: 1, supportedRoles, render: renderCode };
// Every render read resolves through the role table; no literal role string
// may be read outside it (K1), so a contract role cannot silently drop.
// This module is importable for "new-component.mjs --check" before the merge.

export const UI_COMPONENT_ROLES = {
  "code": {
    version: 1,
    roles: ["text","language","caption"],
    props: [],
  },
};

// Declared props and bindings the validator admits: roles ∪ props, derived.
export const supportedRoles = Object.freeze([
  ...UI_COMPONENT_ROLES["code"].roles,
  ...UI_COMPONENT_ROLES["code"].props,
]);

export function renderCode(container, entry, context) {
  const section = h("section", { class: "page-section", id: entry?.sectionId });
  const wrap = h("div", { class: "wrap" });
  const textValue = declared(context, entry, "text");
  const languageValue = declared(context, entry, "language");
  const captionValue = declared(context, entry, "caption");
  if (textValue !== undefined && textValue !== null && textValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "text") }));
  if (languageValue !== undefined && languageValue !== null && languageValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "language") }));
  if (captionValue !== undefined && captionValue !== null && captionValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "caption") }));
  if (wrap.hasChildNodes()) section.append(wrap);
  container.append(section);
}
