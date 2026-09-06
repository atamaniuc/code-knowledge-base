/**
 * Job-posting sources.
 *
 * Only sources whose published terms permit this use. The map is built by counting
 * technology mentions, not by redistributing postings, but a source that forbids
 * programmatic use at all is still off the table for a commercial product.
 *
 * Rejected: hh.ru now returns 403 without a registered application, and Remotive's terms
 * restrict use to resharing their jobs with attribution and price commercial access at a
 * five-figure monthly tier.
 *
 * Known bias, stated so it is not mistaken for the whole market: both sources are remote
 * boards, so the sample skews English-language and international. The adapter interface
 * exists so a regional board slots in without touching anything downstream.
 */
export interface Posting {
  id: string;
  source: string;
  title: string;
  body: string;
  url: string;
  /** Level as stated by the source, when it states one. */
  statedLevel?: string;
}

export interface Source {
  id: string;
  attribution: string;
  /** `tags` narrows the pull to a stack; an empty list takes whatever the board returns. */
  fetch(limit: number, tags?: string[]): Promise<Posting[]>;
}

const UA = "interview-prep/0.1 (topic-frequency analysis)";
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "\n").replace(/&[a-z]+;/gi, " ");

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

export const jobicy: Source = {
  id: "jobicy",
  attribution: "Jobicy (https://jobicy.com) — credited as required by their API terms",
  async fetch(limit, tags = []) {
    // One query per tag: filtering a generic engineering pull leaves single-digit samples
    // for a specific stack, which is too small to weight anything on.
    const queries = tags.length > 0 ? tags.map((t) => `tag=${encodeURIComponent(t)}`) : ["industry=engineering"];
    const seen = new Map<string, Posting>();

    for (const query of queries) {
      const data = (await getJson(
        `https://jobicy.com/api/v2/remote-jobs?count=${Math.min(limit, 50)}&${query}`,
      )) as { jobs?: Record<string, string>[] };
      for (const j of data.jobs ?? []) {
        const id = `jobicy:${j.id}`;
        if (seen.has(id)) continue; // the same posting carries several tags
        seen.set(id, {
          id,
          source: "jobicy",
          title: j.jobTitle ?? "",
          body: stripHtml(`${j.jobExcerpt ?? ""}\n${j.jobDescription ?? ""}`),
          url: j.url ?? "",
          statedLevel: j.jobLevel?.toLowerCase(),
        });
      }
    }
    return [...seen.values()];
  },
};

export const arbeitnow: Source = {
  id: "arbeitnow",
  attribution: "Arbeitnow (https://www.arbeitnow.com) job board API",
  async fetch(limit) {
    const data = (await getJson("https://www.arbeitnow.com/api/job-board-api")) as {
      data?: { slug: string; title: string; description: string; url: string }[];
    };
    return (data.data ?? []).slice(0, limit).map((j) => ({
      id: `arbeitnow:${j.slug}`,
      source: "arbeitnow",
      title: j.title,
      body: stripHtml(j.description),
      url: j.url,
    }));
  },
};

export const SOURCES: Source[] = [jobicy, arbeitnow];
