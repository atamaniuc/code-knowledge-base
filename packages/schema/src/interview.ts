import { z } from "zod";
import { Domain, IsoDate, ReviewStatus, Slug } from "./common.js";

/**
 * A rehearsal brief for one concrete target: this posting, this assignment, this interview.
 *
 * The bank answers "do you know this topic"; a brief answers "will they ask this, and what
 * are they listening for". That difference is why it carries a target rather than a domain,
 * and why its questions are grouped by the side of the interview they belong to: the
 * technology you have to defend, and the business you have to understand.
 */

/** Which half of the interview a group rehearses. */
export const INTERVIEW_SIDES = ["technical", "domain"] as const;
export const InterviewSide = z.enum(INTERVIEW_SIDES);
export type InterviewSide = z.infer<typeof InterviewSide>;

/**
 * Two rungs, not five.
 *
 * A likelihood scale that nobody can calibrate ("62% likely") is a number an author invents;
 * high and medium are both answers to the one question that matters for ordering a rehearsal
 * — will this be asked before there is time for the rest.
 */
export const LIKELIHOODS = ["high", "medium"] as const;
export const Likelihood = z.enum(LIKELIHOODS);
export type Likelihood = z.infer<typeof Likelihood>;

export const InterviewQuestion = z.strictObject({
  /** Global key, unique across every brief: the panel expands it and history records it. */
  id: Slug,
  question: z.string().min(10),
  likelihood: Likelihood,
  /**
   * What the interviewer is checking by asking this — not a summary of the answer.
   * Same reasoning as `probes` on a bank question: an author who cannot say what is being
   * tested cannot say how to prepare for it.
   */
  asks: z.string().min(15),
  /** The spoken answer, in the order it should come out. One bullet is a fact, not an answer. */
  answer: z.array(z.string().min(10)).min(2),
  /** The answer that sounds right and loses the point. */
  traps: z.array(z.string().min(10)).default([]),
  follow_ups: z.array(z.string().min(10)).default([]),
});

export const InterviewGroup = z.strictObject({
  id: Slug,
  title: z.string().min(3),
  side: InterviewSide,
  /** The registry entry this group rehearses, when it maps onto one. */
  domain: Domain.optional(),
  /** Why this group exists and what an answer inside it has to do. */
  intro: z.string().min(20),
  /** Articles to reread when an answer inside this group will not come out. */
  wiki_refs: z.array(Slug).default([]),
  questions: z.array(InterviewQuestion).min(1),
});

/** One round of the hiring process, so the brief can say what each stage is really for. */
export const InterviewStage = z.strictObject({
  name: z.string().min(3),
  /** Roughly how long it runs, in minutes. */
  minutes: z.number().int().min(1).max(600),
  note: z.string().min(10),
});

export const InterviewTarget = z.strictObject({
  role: z.string().min(3),
  /** Who is hiring: the company, and the recruiter when one is in between. */
  company: z.string().min(2),
  domain: Domain,
  stack: z.array(z.string().min(1)).min(1),
});

export const InterviewBrief = z
  .strictObject({
    id: z.uuid(),
    slug: Slug,
    lang: z.enum(["en", "ru"]),
    title: z.string().min(3),
    summary: z.string().min(30),

    target: InterviewTarget,
    stages: z.array(InterviewStage).min(1),
    groups: z.array(InterviewGroup).min(1),

    review_status: ReviewStatus,
    reviewed_at: IsoDate.optional(),
    verified_by: z.string().min(1).optional(),
  })
  /**
   * Ids are keys, not labels.
   *
   * The panel expands a question by id and the history stack remembers it, so a duplicate id
   * means one row silently opens another row's answer. A single brief can decide this, which
   * is why it is a schema rule and not a cross-file one.
   */
  .refine(
    (brief) => {
      const groupIds = new Set<string>();
      const questionIds = new Set<string>();
      for (const group of brief.groups) {
        if (groupIds.has(group.id)) return false;
        groupIds.add(group.id);
        for (const question of group.questions) {
          if (questionIds.has(question.id)) return false;
          questionIds.add(question.id);
        }
      }
      return true;
    },
    {
      error:
        "group ids and question ids must be unique inside one brief: the panel keys expansion and history " +
        "on them, so a repeat makes one row open another row's answer",
      path: ["groups"],
    },
  );

export type InterviewBrief = z.infer<typeof InterviewBrief>;
export type InterviewGroup = z.infer<typeof InterviewGroup>;
export type InterviewQuestion = z.infer<typeof InterviewQuestion>;
export type InterviewStage = z.infer<typeof InterviewStage>;
export type InterviewTarget = z.infer<typeof InterviewTarget>;
