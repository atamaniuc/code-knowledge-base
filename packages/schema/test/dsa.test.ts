import { describe, expect, it } from "vitest";
import { COMPLEXITY_CLASSES, DsaTask, complexityRank } from "../src/dsa.js";

const task = {
  slug: "two-sum",
  title: "Two Sum",
  lang: "en",
  pattern: "hash-map",
  url: "https://leetcode.com/problems/two-sum/",
  naive_approach: {
    idea: "Check every pair of indices and return the first pair that sums to the target.",
    cost: { time: "O(n^2)", space: "O(1)" },
    breaks_at: "Around n > 10^4 the pair enumeration exceeds the time limit.",
  },
  optimal_approach: {
    idea: "Store each seen value with its index and look up the complement in one pass.",
    cost: { time: "O(n)", space: "O(n)" },
    key_insight: "The complement of the current value is enough to find the pair without a second loop.",
  },
  delta: "Trading O(n) space for a hash lookup removes the inner loop entirely.",
  review_status: "draft",
};

describe("complexityRank", () => {
  it("orders classes from cheapest to most expensive", () => {
    const ranks = COMPLEXITY_CLASSES.map(complexityRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("puts linear below quadratic", () => {
    expect(complexityRank("O(n)")).toBeLessThan(complexityRank("O(n^2)"));
  });
});

describe("DsaTask", () => {
  it("accepts a task that trades space for time", () => {
    expect(DsaTask.safeParse(task).success).toBe(true);
  });

  it("rejects a task whose optimal approach is not actually better", () => {
    // Identical costs mean there is no transition to teach.
    const result = DsaTask.safeParse({
      ...task,
      optimal_approach: { ...task.optimal_approach, cost: { time: "O(n^2)", space: "O(1)" } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a task that is worse on both axes", () => {
    const result = DsaTask.safeParse({
      ...task,
      optimal_approach: { ...task.optimal_approach, cost: { time: "O(n^3)", space: "O(n)" } },
    });
    expect(result.success).toBe(false);
  });

  it("requires the key insight that unlocks the optimal approach", () => {
    const { key_insight, ...withoutInsight } = task.optimal_approach;
    void key_insight;
    const result = DsaTask.safeParse({ ...task, optimal_approach: withoutInsight });
    expect(result.success).toBe(false);
  });
});
