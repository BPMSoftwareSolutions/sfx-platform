// Generated adapter stub for the ui-component.v1 kind "form" (version 1).
// Merge into live-circuit/circuit/ui-components.js:
//   1. add the form entry below to UI_COMPONENT_ROLES;
//   2. attach UI_COMPONENTS["form"] = { version: 1, supportedRoles, render: renderForm };
// Every render read resolves through the role table; no literal role string
// may be read outside it (K1), so a contract role cannot silently drop.
// This module is importable for "new-component.mjs --check" before the merge.

export const UI_COMPONENT_ROLES = {
  "form": {
    version: 1,
    roles: ["fields","values","submit"],
    props: [],
  },
};

// Declared props and bindings the validator admits: roles ∪ props, derived.
export const supportedRoles = Object.freeze([
  ...UI_COMPONENT_ROLES["form"].roles,
  ...UI_COMPONENT_ROLES["form"].props,
]);

export function renderForm(container, entry, context) {
  const section = h("section", { class: "page-section", id: entry?.sectionId });
  const wrap = h("div", { class: "wrap" });
  const fieldsValue = declared(context, entry, "fields");
  const valuesValue = declared(context, entry, "values");
  const submitValue = declared(context, entry, "submit");
  if (fieldsValue !== undefined && fieldsValue !== null && fieldsValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "fields") }));
  if (valuesValue !== undefined && valuesValue !== null && valuesValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "values") }));
  if (submitValue !== undefined && submitValue !== null && submitValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "submit") }));
  if (wrap.hasChildNodes()) section.append(wrap);
  container.append(section);
}
