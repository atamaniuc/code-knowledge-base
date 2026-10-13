import type { DomainInfo, Plan, Question, WikiArticle } from "../src/bundle.js";

/** One question with every field the panel reads, so a test can override just what it is about. */
export function question(overrides: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    slug: "rag-topk-regression",
    domain: "agentic",
    topic: "evaluation",
    levels: ["senior", "staff"],
    tracks: ["backend"],
    tech: "RAG",
    question: "You raise top-k from 5 to 20 and quality gets worse. Explain what is happening.",
    probes: "Whether the candidate knows that context position matters, not just context presence.",
    expected: [{ text: "Attention is not uniform across position.", level: "senior", weight: 5 }],
    followUps: ["How would you decide the right k?"],
    mistakes: ["Answering that the model got confused."],
    minutes: 6,
    difficulty: 4,
    reviewStatus: "auto_verified",
    wikiRefs: [{ slug: "evaluating-rag", anchor: "position-effects" }],
    ...overrides,
  };
}

export const DOMAINS: DomainInfo[] = [
  { id: "agentic", title: "Agentic & AI-assisted development", description: "LLMs in production." },
  { id: "data", title: "Databases", description: "Postgres and friends." },
];

export function article(overrides: Partial<WikiArticle> = {}): WikiArticle {
  return {
    slug: "evaluating-rag",
    title: "Evaluating a RAG system",
    domain: "agentic",
    topic: "evaluation",
    levels: ["senior"],
    summary: "Retrieval and generation fail differently and have to be measured separately.",
    body: "## Position effects\n\nAttention is **not** uniform. Use a recall metric to check it.",
    ...overrides,
  };
}

export function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    source: { title: "Senior Node.js Engineer", url: "https://example.invalid/jobs/1", level: "senior", capturedAt: "2026-10-13T16:37:41.191Z" },
    levels: ["senior", "staff"],
    emphasis: [{ domain: "agentic", required: ["RAG"], optional: ["Redis"] }],
    core: [{ id: "q-1", slug: "rag-topk-regression", domain: "agentic", levels: ["senior"], reason: "agentic is a stated requirement" }],
    stretch: [{ id: "q-2", slug: "cache-stampede", domain: "data", levels: ["senior"], reason: "heaviest domain the posting does not name" }],
    gaps: [{ domain: "data", technologies: ["ClickHouse"] }],
    ...overrides,
  };
}

export const WIKI_TITLES: Record<string, string> = { "evaluating-rag": "Evaluating a RAG system" };
