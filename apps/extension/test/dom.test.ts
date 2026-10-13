import { describe, expect, it } from "vitest";
import { mount, render, type RenderDocument } from "../src/dom.js";

/** The smallest thing that satisfies the two DOM calls the renderer makes. */
class FakeNode {
  readonly tag: string;
  attrs: Record<string, string> = {};
  children: (FakeNode | string)[] = [];
  html: string | undefined;

  constructor(tag: string) {
    this.tag = tag;
  }
  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }
  append(...nodes: (FakeNode | string)[]): void {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes: (FakeNode | string)[]): void {
    this.children = nodes;
  }
  set innerHTML(value: string) {
    this.html = value;
  }
  get innerHTML(): string {
    return this.html ?? "";
  }
}

const fake: RenderDocument = {
  createElement: (tag: string) => new FakeNode(tag) as unknown as Element,
  createTextNode: (data: string) => data as unknown as Node,
};

const asFake = (node: Node): FakeNode => node as unknown as FakeNode;

describe("render", () => {
  it("writes text as text nodes, never as markup", () => {
    const node = asFake(render({ tag: "p", children: ["<b>not markup</b>"] }, fake));
    expect(node.tag).toBe("p");
    expect(node.children).toEqual(["<b>not markup</b>"]);
    expect(node.html).toBeUndefined();
  });

  it("skips undefined and false attributes and writes true as an empty attribute", () => {
    const node = asFake(
      render({ tag: "button", attrs: { type: "button", disabled: false, hidden: undefined, "aria-pressed": true } }, fake),
    );
    expect(node.attrs).toEqual({ type: "button", "aria-pressed": "" });
  });

  it("nests element children", () => {
    const node = asFake(render({ tag: "ul", children: [{ tag: "li", children: ["one"] }, { tag: "li", children: ["two"] }] }, fake));
    expect(node.children).toHaveLength(2);
    expect((node.children[0] as FakeNode).children).toEqual(["one"]);
  });

  it("uses innerHTML only when a spec carries rendered html, and then no children", () => {
    const node = asFake(render({ tag: "div", html: "<p>safe</p>", children: ["ignored"] }, fake));
    expect(node.html).toBe("<p>safe</p>");
    expect(node.children).toEqual([]);
  });
});

describe("mount", () => {
  it("replaces the container's children", () => {
    const container = new FakeNode("div");
    mount(container as unknown as Element, { tag: "p", children: ["x"] }, fake);
    expect(container.children).toHaveLength(1);
    mount(container as unknown as Element, { tag: "p", children: ["y"] }, fake);
    expect(container.children).toHaveLength(1);
  });
});
