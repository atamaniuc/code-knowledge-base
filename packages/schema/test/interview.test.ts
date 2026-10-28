import { describe, expect, it } from "vitest";
import { InterviewBrief } from "../src/interview.js";

const valid = {
  id: "8f0d7c1e-0c1a-4a5e-9d1f-3b2c4d5e6f70",
  slug: "example-senior-nodejs",
  lang: "ru",
  title: "Example · Senior Node.js Engineer",
  summary: "A brief for one target: the posting, the assignment and the interview that follows.",
  target: {
    role: "Senior Node.js Engineer",
    company: "Example Ltd",
    domain: "fintech",
    stack: ["Node.js", "PostgreSQL"],
  },
  stages: [{ name: "Technical interview", minutes: 90, note: "Defence of the assignment, then questions." }],
  groups: [
    {
      id: "assignment-defense",
      title: "Defending the assignment",
      side: "technical",
      domain: "fintech",
      intro: "What the reviewer checks first, and the order to answer in.",
      wiki_refs: ["limits-risk-and-trade-finance"],
      questions: [
        {
          id: "limit-race",
          question: "Two reservations arrive at once with room for one. What happens?",
          likelihood: "high",
          tags: ["concurrency", "postgres"],
          asks: "Whether the check lives in the database rather than in the service.",
          answer: [
            "Name the read-check-write window as the bug, not the traffic spike.",
            "Put the check inside the write: a conditional UPDATE re-evaluating after the lock is released.",
          ],
        },
      ],
    },
  ],
  review_status: "draft",
};

describe("InterviewBrief", () => {
  it("accepts a well-formed brief", () => {
    expect(InterviewBrief.safeParse(valid).success).toBe(true);
  });

  it("rejects a duplicate question id inside one brief", () => {
    // The panel expands by id; a repeat shows the wrong answer.
    const group = valid.groups[0];
    if (!group) throw new Error("fixture lost its group");
    const doubled = { ...valid, groups: [{ ...group, questions: [group.questions[0], group.questions[0]] }] };
    expect(InterviewBrief.safeParse(doubled).success).toBe(false);
  });

  it("rejects a single-bullet answer", () => {
    const group = valid.groups[0];
    if (!group) throw new Error("fixture lost its group");
    const one = { ...valid, groups: [{ ...group, questions: [{ ...group.questions[0], answer: ["Name the race."] }] }] };
    expect(InterviewBrief.safeParse(one).success).toBe(false);
  });

  it("rejects a question that does not say what is being checked", () => {
    const group = valid.groups[0];
    if (!group) throw new Error("fixture lost its group");
    const { asks, ...withoutAsks } = group.questions[0] as Record<string, unknown>;
    void asks;
    const bare = { ...valid, groups: [{ ...group, questions: [withoutAsks] }] };
    expect(InterviewBrief.safeParse(bare).success).toBe(false);
  });

  it("rejects an unknown side, so a typo cannot create a third one", () => {
    const group = valid.groups[0];
    if (!group) throw new Error("fixture lost its group");
    expect(InterviewBrief.safeParse({ ...valid, groups: [{ ...group, side: "behavioural" }] }).success).toBe(false);
  });

  it("rejects a tag outside the closed vocabulary", () => {
    // An open vocabulary grows a near-duplicate per author, and a filter that misses is worse
    // than no filter: it answers "nothing here" with confidence.
    const group = valid.groups[0];
    if (!group) throw new Error("fixture lost its group");
    const stray = { ...valid, groups: [{ ...group, questions: [{ ...group.questions[0], tags: ["limity"] }] }] };
    expect(InterviewBrief.safeParse(stray).success).toBe(false);
  });

  it("rejects a question with no tags, because the tag bar is how related answers are found", () => {
    const group = valid.groups[0];
    if (!group) throw new Error("fixture lost its group");
    const bare = { ...valid, groups: [{ ...group, questions: [{ ...group.questions[0], tags: [] }] }] };
    expect(InterviewBrief.safeParse(bare).success).toBe(false);
  });

  it("rejects unknown fields so a frontmatter typo surfaces", () => {
    expect(InterviewBrief.safeParse({ ...valid, targert: valid.target }).success).toBe(false);
  });

  it("defaults the optional collections to empty arrays", () => {
    const parsed = InterviewBrief.parse(valid);
    expect(parsed.groups[0]?.questions[0]?.traps).toEqual([]);
    expect(parsed.groups[0]?.questions[0]?.follow_ups).toEqual([]);
  });
});
