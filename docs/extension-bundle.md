# The extension bundle

What the side panel reads, and why the shape is what it is. The producer is
`scripts/bundle-extension.ts`; the consumer is `apps/extension/src/`.

## Why a bundle at all

Manifest V3 forbids remotely hosted code, and the bank works with the network off: the content
is baked in at build time, updates arrive as extension updates, and nothing is fetched at
runtime except the bundle that ships inside the package.

There is exactly one exception, and it is a click away: selecting text in the panel offers to
translate it, and only that click sends the selected phrase to Google Translate. It is
implemented in `apps/extension/src/translate.ts`, the manifest grants the two translate
origins and nothing else, and no other module may reach the network.

**The posting URL is an argument, never a repository value.** A job posting is a thing a
person runs a command against; a repository that stores one has quietly become about that
posting. The URL reaches the bundle only through the command that generated it.

## Building it

```bash
make extension ARGS="--include-drafts"                             # bank only
make prep ARGS="<job-url> --out=.pipeline/prep/role.json"          # parse a posting
make extension ARGS="--include-drafts --plan=.pipeline/prep/role.json"   # bank + plan
```

`--include-drafts` maps `review_status: draft` to `auto_verified` on the way out — the same
remap the CLI does for the same flag. The shared selector starts a session only from
promoted content, so a bundle that carried `draft` verbatim would render an empty drill
however many questions it held. Without the flag only `auto_verified` and `verified` items
ship, which is what a store build must do.

## Shape: schema 2

```ts
{
  schema: 2,
  generatedAt: string,
  questions: Shipped[],
  wiki: ShippedArticle[],
  domains: { id, title, description }[],
  levels: string[],            // ordered junior → head
  plan: BundlePlan | null,
}
```

`Shipped` is what the panel renders and nothing else: `id, slug, domain, topic, subtopic?,
levels, tracks, tech (string | null), question, probes, answerStrategy?, expected[{text,
level, weight}], followUps, mistakes, reviewStatus, difficulty, minutes, wikiRefs[{slug,
anchor}]`. Authoring metadata stays in `content/`. Every field the panel reads is camelCase
and the authoring field it comes from is snake_case — the bundler is the only place the two
vocabularies meet, and it keeps the boundary in one file.

`ShippedArticle` is `{ slug, title, domain, topic, levels, summary, body }` with `body` in
Markdown. The wiki ships whole because a missed bullet's feedback is "read this section" —
a link that needs the network contradicts the offline promise, so the section travels with
the package. The panel escapes the body before rendering it: it is data, not markup to be
trusted.

`BundlePlan` carries identities, not copies: `source{title, url, level, capturedAt}`,
`levels`, `emphasis[{domain, required[], optional[]}]`, `core[{id, slug, domain, levels,
reason}]`, `stretch[]` and `gaps[{domain, technologies[]}]`. A plan that duplicated the
questions would drift from the bank the first time either was edited.

## The bundler trims the plan against the bundle

Every `core` and `stretch` entry must resolve to a question that actually shipped, and the
bundler drops the ones that do not, with a warning. A plan naming a question the bundle does
not carry renders as an empty session — the exact failure this check exists to make
impossible.

## Constraints a change must not break

- `permissions` stay `["storage", "sidePanel"]`; `host_permissions` are exactly the two
  Google Translate origins from `TRANSLATE_ORIGINS` and never a wildcard.
- No remote code. The only absolute URLs in the built `panel.js` are those two endpoints, and
  the only literal `fetch` is the relative `content.json`.
- The drill stays two-stage: question and probes first, expected answer only after the user
  commits. Seeing the answer while thinking produces recognition, which is what an interview
  does not test.

`apps/extension/test/` asserts these against the built output rather than the source, which
is why they run after `make extension`.
