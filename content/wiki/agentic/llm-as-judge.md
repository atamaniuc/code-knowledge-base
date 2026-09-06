---
slug: llm-as-judge
title: LLM as judge
lang: en
domain: agentic
topic: evaluation
tech:
  name: LLM evaluation
  version_range: ">=2023"
levels: [middle, senior, staff]
summary: >-
  Using a model to score model output makes continuous evaluation affordable and
  introduces measurable biases — position, verbosity, self-preference. The
  engineering question is not whether it is biased but whether the bias is
  measured and controlled.
prerequisites: [evaluating-rag]
related: [evaluating-rag]
sources:
  - title: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena"
    url: https://arxiv.org/abs/2306.05685
    kind: paper
  - title: "RAGAS: Automated Evaluation of Retrieval Augmented Generation"
    url: https://arxiv.org/abs/2309.15217
    kind: paper
review_status: draft
---

## Why it exists

Human evaluation is the gold standard and does not scale to every commit. A model judge
turns a week of annotation into a minute of inference, which is what makes evaluation
continuous rather than occasional. That is a real capability, not a compromise, and
dismissing it in an interview reads as inexperience.

The cost is that the judge is a model, with a model's failure modes, sitting in the place
where your ground truth is supposed to be.

## The named biases

**Position bias.** Given two candidates, judges favour one slot over the other
independently of content. The mitigation is mechanical: evaluate both orderings and keep
the verdict only when it agrees with itself. Disagreement is a signal the comparison is
too close to call, which is itself information.

**Verbosity bias.** Longer answers score higher at equal quality. Untreated, this
optimisation pressure teaches whatever you are tuning to pad, and the metric rises while
the product gets worse.

**Self-preference.** A judge tends to prefer text from its own family. This is the one
that matters most structurally: when the generator and the judge share a model, they share
blind spots, and the score stops measuring quality and starts measuring agreement.

## Direct scoring versus pairwise

**Pairwise** comparison — which of these two is better — is the more reliable signal,
because relative judgement is easier than absolute and calibration drift cancels out. It
costs O(n²) comparisons and gives you a ranking rather than a number.

**Direct scoring** against a rubric gives an absolute number you can threshold in CI, and
is what you want for a regression gate. It needs a rubric specific enough that two runs
agree, which is where most implementations fail: "rate this answer 1 to 10" is not a
rubric, it is a vibe with a number attached.

The workable middle is a rubric decomposed into checkable criteria, scored per criterion,
aggregated deterministically. That is also what makes disagreement debuggable — you can
see which criterion the judge and the human disagree on, rather than staring at a 6 versus
an 8.

## Calibrating the judge

A judge you have not calibrated is an opinion generator. The minimum bar:

- A small human-labelled set, tens of examples, covering the failure modes you care about.
- Agreement measured against it, tracked as a number, re-checked whenever the judge prompt
  or model changes.
- The judge prompt versioned like code, because changing it silently invalidates every
  historical score.

Agreement does not have to be high to be useful. It has to be *known*, and stable enough
that a movement in the metric means something happened.

## Where it must not be used alone

Anything with a deterministic check should use the deterministic check. Schema validity,
compilation, test results, retrieval recall against labelled chunks — these are decidable,
and putting a judge in front of a decidable question adds noise for nothing.

The judge belongs where the question is genuinely subjective: is the tone right, is the
explanation clear, does the answer address what was asked. Reaching for it first, before
asking whether the property is checkable, is the most common design error in this area.
