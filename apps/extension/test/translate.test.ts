import { describe, expect, it } from "vitest";
import { buildTranslateUrl, clampPosition, parseTranslateResponse, selectionText, TRANSLATE_ENDPOINTS, TRANSLATE_ORIGINS, translateText, type FetchLike } from "../src/translate.js";

const gtx = [[["Цикл событий заблокирован.","The event loop is blocked.",null,null,10]],null,"en"];
const clients5 = [["Цикл событий заблокирован.","en"]];

function respond(body: unknown, status = 200): FetchLike {
  return async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
}

describe("request", () => {
  it("asks for Russian with the selection url-encoded", () => {
    const url = buildTranslateUrl("https://clients5.google.com/translate_a/t", "event loop & queues");
    expect(url).toContain("clients5.google.com/translate_a/t?");
    expect(url).toContain("tl=ru");
    expect(url).toContain("sl=auto");
    expect(url).toContain("q=event+loop+%26+queues");
  });

  it("uses the client that each endpoint expects", () => {
    expect(buildTranslateUrl("https://clients5.google.com/translate_a/t", "x")).toContain("client=dict-chrome-ex");
    expect(buildTranslateUrl("https://translate.googleapis.com/translate_a/single", "x")).toContain("client=gtx");
    expect(buildTranslateUrl("https://translate.googleapis.com/translate_a/single", "x")).toContain("dt=t");
  });

  it("declares the origins the manifest must grant, and nothing broader", () => {
    expect(TRANSLATE_ORIGINS).toEqual(["https://clients5.google.com/*", "https://translate.googleapis.com/*"]);
    for (const origin of TRANSLATE_ORIGINS) expect(origin).not.toContain("<all_urls>");
    expect(TRANSLATE_ENDPOINTS.every((endpoint) => TRANSLATE_ORIGINS.some((origin) => endpoint.startsWith(origin.replace("/*", ""))))).toBe(true);
  });
});

describe("response", () => {
  it("reads the gtx segment shape", () => {
    expect(parseTranslateResponse(gtx)).toBe("Цикл событий заблокирован.");
  });

  it("joins several segments and several queries", () => {
    expect(parseTranslateResponse([[["Первая", "a", null, null, 10], [" вторая", "b", null, null, 10]], null, "en"])).toBe("Первая вторая");
    expect(parseTranslateResponse([["Первая", "en"], [" вторая", "en"]])).toBe("Первая вторая");
  });

  it("reads the clients5 pair shape", () => {
    expect(parseTranslateResponse(clients5)).toBe("Цикл событий заблокирован.");
  });

  it("reads a sentences object", () => {
    expect(parseTranslateResponse({ sentences: [{ trans: "Привет" }, { trans: " мир" }] })).toBe("Привет мир");
  });

  it("throws rather than pretending an unknown shape is an empty translation", () => {
    expect(() => parseTranslateResponse({ unexpected: true })).toThrow(/no text/);
  });
});

describe("translateText", () => {
  it("returns the translation from the first endpoint that answers", async () => {
    const asked: string[] = [];
    const fake: FetchLike = async (input) => {
      asked.push(new URL(input).host);
      return { ok: true, status: 200, json: async () => clients5 };
    };
    await expect(translateText("The event loop is blocked.", { fetchImpl: fake })).resolves.toBe("Цикл событий заблокирован.");
    expect(asked).toEqual(["clients5.google.com"]);
  });

  it("falls through to the second endpoint when the first is rate limited", async () => {
    let calls = 0;
    const fake: FetchLike = async () => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 429, json: async () => ({}) } : { ok: true, status: 200, json: async () => gtx };
    };
    const translated = await translateText("The event loop is blocked.", { fetchImpl: fake });
    expect(calls).toBe(2);
    expect(translated).toContain("Цикл");
  });

  it("reports every host it tried when none of them answer", async () => {
    const fake: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await expect(translateText("hello", { fetchImpl: fake })).rejects.toThrow(/clients5.*503.*translate.googleapis.*503/);
  });

  it("refuses an empty selection without making a request", async () => {
    let called = false;
    const fake: FetchLike = async () => {
      called = true;
      return { ok: true, status: 200, json: async () => clients5 };
    };
    await expect(translateText("   ", { fetchImpl: fake })).rejects.toThrow(/nothing selected/);
    expect(called).toBe(false);
  });
});

describe("selection and placement", () => {
  it("collapses whitespace and bounds the request size", () => {
    expect(selectionText("  The   event\nloop ")).toBe("The event loop");
    expect(selectionText("x".repeat(2000))).toHaveLength(1000);
  });

  it("keeps the popup inside the panel", () => {
    expect(clampPosition({ x: 5, y: 5 }, { width: 200, height: 80 }, { width: 400, height: 900 })).toEqual({ x: 6, y: 17 });
    expect(clampPosition({ x: 395, y: 880 }, { width: 200, height: 80 }, { width: 400, height: 900 })).toEqual({ x: 194, y: 814 });
  });
});
