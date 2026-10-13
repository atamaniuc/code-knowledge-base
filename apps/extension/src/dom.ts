import type { Spec } from "./view.js";

/**
 * The one place a Spec becomes a node.
 *
 * Text is written with textContent and attributes with setAttribute, so nothing a view
 * builds can become markup. The single exception is `html`, which only `markdown.ts`
 * produces, after escaping the whole document first — that is what makes the innerHTML
 * assignment below reviewable rather than a hole.
 */
export interface RenderDocument {
  createElement(tag: string): Element;
  createTextNode(data: string): Node;
}

export function render(spec: Spec, doc: RenderDocument = document): Node {
  const node = doc.createElement(spec.tag);
  for (const [name, value] of Object.entries(spec.attrs ?? {})) {
    if (value === undefined || value === false) continue;
    if (value === true) {
      node.setAttribute(name, "");
      continue;
    }
    node.setAttribute(name, String(value));
  }

  if (spec.html !== undefined) {
    node.innerHTML = spec.html;
    return node;
  }

  for (const child of spec.children ?? []) {
    node.append(typeof child === "string" ? doc.createTextNode(child) : render(child, doc));
  }
  return node;
}

export function mount(container: Element, spec: Spec, doc: RenderDocument = document): void {
  container.replaceChildren(render(spec, doc));
}
