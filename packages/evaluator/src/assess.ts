import { LEVELS, type Level } from "@schema/common.js";
import type { ExpectedAnswerBullet, Question } from "@schema/question.js";

/** How well one expected bullet was covered by the answer. */
export type Coverage = "covered" | "partial" | "missing";

/** Partial credit. A half-stated point is worth something, but not the point. */
const CREDIT: Record<Coverage, number> = { covered: 1, partial: 0.5, missing: 0 };

/**
 * Share of the weight at a level that must be covered to claim it.
 *
 * Not 1.0 deliberately: interviewers do not require every point, and a threshold of
 * one makes a single missed bullet indistinguishable from a blank answer.
 */
export const LEVEL_THRESHOLD = 0.75;

export interface BulletVerdict {
  index: number;
  coverage: Coverage;
  /** Why the judge decided this, quoted from the answer where possible. */
  note?: string;
}

export interface Assessment {
  verdicts: BulletVerdict[];
  /** Highest level whose bullets were covered past the threshold; null if none were. */
  level: Level | null;
  /** The level above `level`, and what was missing for it. Null at the top. */
  nextLevel: { level: Level; missing: ExpectedAnswerBullet[] } | null;
  /** Weighted coverage across all bullets, 0..1. For progress tracking, not for grading. */
  score: number;
}

const ordered = (levels: Iterable<Level>): Level[] => LEVELS.filter((l) => [...levels].includes(l));

/** Bullets expected at `level` — that is, everything required at or below it. */
function bulletsUpTo(bullets: ExpectedAnswerBullet[], level: Level): ExpectedAnswerBullet[] {
  const cap = LEVELS.indexOf(level);
  return bullets.filter((b) => LEVELS.indexOf(b.min_level) <= cap);
}

function coverageRatio(bullets: ExpectedAnswerBullet[], verdicts: BulletVerdict[], all: ExpectedAnswerBullet[]): number {
  const indices = new Set(bullets.map((b) => all.indexOf(b)));
  const relevant = verdicts.filter((v) => indices.has(v.index));
  const total = bullets.reduce((sum, b) => sum + b.weight, 0);
  if (total === 0) return 1;
  const earned = relevant.reduce((sum, v) => sum + (all[v.index]?.weight ?? 0) * CREDIT[v.coverage], 0);
  return earned / total;
}

/** Bullets a level introduces — those whose `min_level` is exactly this level. */
function bulletsAt(bullets: ExpectedAnswerBullet[], level: Level): ExpectedAnswerBullet[] {
  return bullets.filter((b) => b.min_level === level);
}

/**
 * Turns per-bullet coverage into a level.
 *
 * A level is claimed only when two things hold: everything expected at or below it is
 * covered past the threshold, and the bullets that level itself introduces are covered
 * past the threshold. The first stops a candidate reaching senior by answering the staff
 * point while missing the basics. The second stops the opposite: without it, a light
 * high-level bullet — two weight units out of twenty-five — could be skipped entirely
 * and the cumulative ratio would still clear the bar.
 */
export function assess(question: Question, verdicts: BulletVerdict[]): Assessment {
  const bullets = question.expected_answer;
  const levels = ordered(new Set(bullets.map((b) => b.min_level)));

  let achieved: Level | null = null;
  for (const level of levels) {
    const cumulative = coverageRatio(bulletsUpTo(bullets, level), verdicts, bullets);
    const introduced = coverageRatio(bulletsAt(bullets, level), verdicts, bullets);
    if (cumulative >= LEVEL_THRESHOLD && introduced >= LEVEL_THRESHOLD) achieved = level;
    else break;
  }

  const nextIndex = achieved === null ? 0 : levels.indexOf(achieved) + 1;
  const next = levels[nextIndex];
  const missingFor = (level: Level) =>
    bulletsUpTo(bullets, level).filter((b) => {
      const v = verdicts.find((x) => x.index === bullets.indexOf(b));
      return !v || v.coverage !== "covered";
    });

  return {
    verdicts,
    level: achieved,
    nextLevel: next ? { level: next, missing: missingFor(next) } : null,
    score: coverageRatio(bullets, verdicts, bullets),
  };
}

/** Sections of the wiki to read, derived from the bullets that were missed. */
export function studyRefs(question: Question, assessment: Assessment): { slug: string; anchor: string }[] {
  const missed = assessment.verdicts.some((v) => v.coverage !== "covered");
  return missed ? question.wiki_refs.map((r) => ({ slug: r.slug, anchor: r.anchor })) : [];
}
