import { describe, expect, it } from "vitest";
import { browserHost, fullscreenActive, toggleFullscreen, type FullscreenHost, type FullscreenWindow } from "../src/fullscreen.js";

/**
 * The measurement these encode (Chrome 155): a side panel reports document.fullscreenEnabled
 * true, accepts requestFullscreen() — and then never settles the promise, fires no
 * fullscreenchange and shows nothing. A bare await therefore hangs forever and the header
 * button appears dead. Every branch below is decided from an injected host so this is a test
 * and not a browser session.
 */
interface Fake {
  /** Does the element API take effect? */
  entered?: boolean;
  /** Does it reject? */
  refuse?: boolean;
  /** Does it never answer at all (the side panel)? */
  pending?: boolean;
  /** chrome.tabs.getCurrent(): null/undefined means a side panel. */
  tab?: unknown;
  window?: FullscreenWindow;
  noWindowApi?: boolean;
  noTabApi?: boolean;
  element?: unknown;
  /** A panel window that is already fullscreen. */
  existingWindow?: FullscreenWindow;
}

function fake(options: Fake = {}): { host: FullscreenHost; calls: string[]; doc: { element: unknown } } {
  const calls: string[] = [];
  const doc = { element: options.element ?? null };
  const host: FullscreenHost = {
    url: "chrome-extension://abc/panel.html",
    get element(): unknown {
      return doc.element;
    },
    requestElement: async () => {
      calls.push("requestElement");
      if (options.pending) return new Promise<void>(() => undefined);
      if (options.refuse) throw new Error("refused");
      if (options.entered) doc.element = { tagName: "HTML" };
    },
    exitElement: async () => {
      calls.push("exitElement");
      doc.element = null;
    },
    currentTab: async () => {
      calls.push("currentTab");
      return "tab" in options ? options.tab : { id: 1 };
    },
    currentWindow: async () => {
      calls.push("currentWindow");
      return options.window ?? { id: 7, state: "normal" };
    },
    updateWindow: async (id, state) => {
      calls.push("updateWindow:" + String(id) + ":" + state);
    },
    createWindow: async () => {
      calls.push("createWindow");
      if (options.noWindowApi) throw new Error("no windows api");
      return { id: 8, state: "normal" };
    },
    createTab: async () => {
      calls.push("createTab");
      if (options.noTabApi) throw new Error("no tabs api");
      return { id: 9 };
    },
    findFullscreenWindow: async () => {
      calls.push("findFullscreenWindow");
      return options.existingWindow;
    },
    focusWindow: async (id) => {
      calls.push("focusWindow:" + String(id));
    },
    timeoutMs: 25,
  };
  return { host, calls, doc };
}

describe("toggleFullscreen", () => {
  it("opens a fullscreen window from a side panel instead of asking the document", async () => {
    const { host, calls } = fake({ tab: null });
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("open-window");
    expect(result.fullscreen).toBe(true);
    expect(calls).toContain("createWindow");
    // The call that hangs in a side panel is never made.
    expect(calls).not.toContain("requestElement");
  });

  it("focuses the fullscreen window that is already open instead of opening a second", async () => {
    const { host, calls } = fake({ tab: null, existingWindow: { id: 8, type: "popup", state: "fullscreen" } });
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("focus-window");
    expect(result.fullscreen).toBe(false);
    expect(calls).toContain("focusWindow:8");
    expect(calls).not.toContain("createWindow");
  });

  it("opens a new window when the previous one is gone", async () => {
    const { host, calls } = fake({ tab: null });
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("open-window");
    expect(calls).toContain("createWindow");
    expect(calls).not.toContain("focusWindow:8");
  });

  it("opens a tab when no window can be created", async () => {
    const { host, calls } = fake({ tab: null, noWindowApi: true });
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("open-tab");
    expect(result.fullscreen).toBe(false);
    expect(calls).toContain("createTab");
  });

  it("says so when neither a window nor a tab can be opened", async () => {
    const { host } = fake({ tab: null, noWindowApi: true, noTabApi: true });
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("unavailable");
    expect(result.fullscreen).toBe(false);
  });

  it("enters fullscreen in a tab when the API honours the call", async () => {
    const { host, calls } = fake({ entered: true });
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("enter-element");
    expect(result.fullscreen).toBe(true);
    expect(calls).toContain("requestElement");
    expect(calls).not.toContain("createWindow");
  });

  it("falls back to a window when the API refuses", async () => {
    const { host, calls } = fake({ refuse: true });
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("open-window");
    expect(calls).toContain("createWindow");
  });

  it("does not hang on a request that never settles", async () => {
    const { host, calls } = fake({ pending: true });
    const started = Date.now();
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("open-window");
    expect(calls).toContain("createWindow");
    // Bounded by timeoutMs (25ms here), not by the promise.
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("leaves the element's fullscreen first", async () => {
    const { host, calls, doc } = fake({ element: { tagName: "HTML" } });
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("exit-element");
    expect(result.fullscreen).toBe(false);
    expect(calls).toContain("exitElement");
    expect(doc.element).toBeNull();
  });

  it("leaves a window that is already fullscreen", async () => {
    const { host, calls } = fake({ window: { id: 7, state: "fullscreen" } });
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("exit-window");
    expect(result.fullscreen).toBe(false);
    expect(calls).toContain("updateWindow:7:normal");
    expect(calls).not.toContain("createWindow");
  });
});

describe("fullscreenActive", () => {
  it("is true while an element is fullscreen", async () => {
    const { host } = fake({ element: { tagName: "HTML" } });
    expect(await fullscreenActive(host)).toBe(true);
  });

  it("is false in a side panel even when the window is filled", async () => {
    const { host } = fake({ tab: null, window: { id: 7, state: "fullscreen" } });
    expect(await fullscreenActive(host)).toBe(false);
  });

  it("is true in a window we put into fullscreen", async () => {
    const { host } = fake({ window: { id: 7, state: "fullscreen" } });
    expect(await fullscreenActive(host)).toBe(true);
  });

  it("is false in an ordinary tab", async () => {
    const { host } = fake({});
    expect(await fullscreenActive(host)).toBe(false);
  });
});

describe("browserHost", () => {
  function chrome(
    create: (options: Record<string, unknown>) => Promise<FullscreenWindow>,
    calls: string[],
    all: FullscreenWindow[] = [],
  ) {
    return {
      runtime: { getURL: (path: string) => "chrome-extension://abc/" + path },
      tabs: { getCurrent: async () => null, create: async () => ({ id: 9 }) },
      windows: {
        getCurrent: async () => ({ id: 4, state: "normal" }),
        getAll: async () => {
          calls.push("getAll");
          return all;
        },
        create: async (options: Record<string, unknown>) => {
          calls.push("create:" + JSON.stringify(options));
          return create(options);
        },
        update: async (id: number, options: { state?: string; focused?: boolean }) => {
          calls.push("update:" + String(id) + ":" + JSON.stringify(options));
          return { id, ...options };
        },
      },
    };
  }
  const document = { fullscreenElement: null, documentElement: { requestFullscreen: async () => undefined }, exitFullscreen: async () => undefined };

  it("creates the window and then puts it into fullscreen, because create ignores the state", async () => {
    const calls: string[] = [];
    const host = browserHost(document as unknown as Document, chrome(async () => ({ id: 4, state: "normal" }), calls));
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("open-window");
    expect(host.url).toBe("chrome-extension://abc/panel.html");
    expect(calls).toEqual([
      "getAll",
      'create:{"url":"chrome-extension://abc/panel.html","type":"popup","focused":true}',
      'update:4:{"state":"fullscreen"}',
    ]);
  });

  it("does not re-state a window that already came back fullscreen", async () => {
    const calls: string[] = [];
    const host = browserHost(document as unknown as Document, chrome(async () => ({ id: 4, state: "fullscreen" }), calls));
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("open-window");
    expect(calls.filter((call) => call.startsWith("update:"))).toEqual([]);
  });

  it("recognises its own fullscreen window and focuses it", async () => {
    const calls: string[] = [];
    const host = browserHost(
      document as unknown as Document,
      chrome(async () => ({ id: 4, state: "normal" }), calls, [{ id: 4, type: "popup", state: "fullscreen" }]),
    );
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("focus-window");
    expect(calls).toContain('update:4:{"focused":true}');
    expect(calls.some((call) => call.startsWith("create:"))).toBe(false);
  });

  it("ignores a fullscreen window that is not a panel popup", async () => {
    const calls: string[] = [];
    const host = browserHost(
      document as unknown as Document,
      chrome(async () => ({ id: 4, state: "normal" }), calls, [{ id: 1, type: "normal", state: "fullscreen" }]),
    );
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("open-window");
    expect(calls.some((call) => call.startsWith("create:"))).toBe(true);
  });

  it("reads fullscreenElement fresh rather than caching it", () => {
    const doc = { fullscreenElement: null as unknown, documentElement: { requestFullscreen: async () => undefined }, exitFullscreen: async () => undefined };
    const host = browserHost(doc as unknown as Document, chrome(async () => ({ id: 4 }), []));
    expect(host.element).toBeNull();
    doc.fullscreenElement = { tagName: "HTML" };
    expect(host.element).not.toBeNull();
  });

  it("survives a chrome that is not there at all", async () => {
    const host = browserHost(document as unknown as Document, undefined);
    const result = await toggleFullscreen(host);
    expect(result.action).toBe("unavailable");
  });
});
