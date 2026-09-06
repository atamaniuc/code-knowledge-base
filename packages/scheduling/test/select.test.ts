import { describe, expect, it } from "vitest";
import type { Question } from "@schema/question.js";
import { ReviewStore } from "@drill/store.js";
import { eligible, nextUp } from "../src/select.js";

const q = (over: Partial<Question> & { id: string }): Question =>
  ({
    slug: over.id,
    lang: "en",
    domain: "caching",
    topic: "invalidation",
    tracks: ["backend"],
    levels: ["senior"],
    question: "Question text long enough.",
    probes: "Whether the candidate reasons rather than recites.",
    expected_answer: [
      { text: "First bullet of the answer.", weight: 5, min_level: "middle" },
      { text: "Second bullet of the answer.", weight: 4, min_level: "senior" },
    ],
    follow_ups: [],
    common_mistakes: [],
    related_questions: [],
    wiki_refs: [{ slug: "a", anchor: "b", wiki_reviewed_at: "2026-09-06" }],
    sources: [{ title: "t", url: "https://example.com", kind: "official-docs" }],
    difficulty: 3,
    estimated_minutes: 5,
    review_status: "auto_verified",
    ...over,
  }) as Question;

describe("eligible", () => {
  it("excludes anything the gates have not promoted", () => {
    // Drilling against an unverified answer teaches the wrong thing.
    const pool = [q({ id: "1", review_status: "draft" }), q({ id: "2", review_status: "auto_verified" })];
    expect(eligible(pool, {}).map((x) => x.id)).toEqual(["2"]);
  });

  it("filters by domain and by level", () => {
    const pool = [
      q({ id: "1", domain: "caching", levels: ["senior"] }),
      q({ id: "2", domain: "network", levels: ["senior"] }),
      q({ id: "3", domain: "caching", levels: ["junior"] }),
    ];
    expect(eligible(pool, { domains: ["caching"] }).map((x) => x.id)).toEqual(["1", "3"]);
    expect(eligible(pool, { levels: ["senior"] }).map((x) => x.id)).toEqual(["1", "2"]);
  });
});

describe("nextUp", () => {
  it("puts due repetitions before unseen questions", () => {
    // Opening with new material lets the backlog of things you got wrong keep growing.
    const store = new ReviewStore(":memory:");
    const pool = [q({ id: "seen" }), q({ id: "fresh" })];
    store.record("seen", 4, new Date("2026-09-01T10:00:00Z"));
    expect(nextUp(pool, store, {}, new Date("2026-09-05T10:00:00Z")).map((x) => x.id)).toEqual(["seen", "fresh"]);
    store.close();
  });

  it("omits questions that are answered and not yet due", () => {
    const store = new ReviewStore(":memory:");
    const pool = [q({ id: "seen" })];
    store.record("seen", 5, new Date("2026-09-05T10:00:00Z"));
    expect(nextUp(pool, store, {}, new Date("2026-09-05T12:00:00Z"))).toEqual([]);
    store.close();
  });

  it("respects the session limit", () => {
    const store = new ReviewStore(":memory:");
    const pool = [q({ id: "a" }), q({ id: "b" }), q({ id: "c" })];
    expect(nextUp(pool, store, { limit: 2 }, new Date())).toHaveLength(2);
    store.close();
  });

  it("ignores review history for questions outside the filter", () => {
    const store = new ReviewStore(":memory:");
    const pool = [q({ id: "a", domain: "network" })];
    store.record("a", 4, new Date("2026-09-01T10:00:00Z"));
    expect(nextUp(pool, store, { domains: ["caching"] }, new Date("2026-09-09T10:00:00Z"))).toEqual([]);
    store.close();
  });
});
