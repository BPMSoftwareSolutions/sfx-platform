// Generated adapter stub for the ui-component.v1 kind "media.gallery" (version 1).
// Merge into live-circuit/circuit/ui-components.js:
//   1. add the media.gallery entry below to UI_COMPONENT_ROLES;
//   2. attach UI_COMPONENTS["media.gallery"] = { version: 1, supportedRoles, render: renderMediaGallery };
// Every render read resolves through the role table; no literal role string
// may be read outside it (K1), so a contract role cannot silently drop.
// This module is importable for "new-component.mjs --check" before the merge.

export const UI_COMPONENT_ROLES = {
  "media.gallery": {
    version: 1,
    roles: ["items","caption","empty"],
    props: [],
  },
};

// Declared props and bindings the validator admits: roles ∪ props, derived.
export const supportedRoles = Object.freeze([
  ...UI_COMPONENT_ROLES["media.gallery"].roles,
  ...UI_COMPONENT_ROLES["media.gallery"].props,
]);

export function renderMediaGallery(container, entry, context) {
  const section = h("section", { class: "page-section", id: entry?.sectionId });
  const wrap = h("div", { class: "wrap" });
  const itemsValue = declared(context, entry, "items");
  const captionValue = declared(context, entry, "caption");
  const emptyValue = declared(context, entry, "empty");
  if (itemsValue !== undefined && itemsValue !== null && itemsValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "items") }));
  if (captionValue !== undefined && captionValue !== null && captionValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "caption") }));
  if (emptyValue !== undefined && emptyValue !== null && emptyValue !== "") wrap.append(h("p", { class: "note", text: declaredText(context, entry, "empty") }));
  if (wrap.hasChildNodes()) section.append(wrap);
  container.append(section);
}
