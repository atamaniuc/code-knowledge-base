# CONSTRAINTS

Fifteen hard rules. Not guidelines — a violation is a defect, not a style disagreement.

Enforcement is stated per rule, and it is literal: **enforced** means a command fails, in
the pre-commit hook and in CI. Everything else is caught in review, which means it can be
missed. `make setup` enables the hook; without it, only CI catches violations.

## Content integrity

1. **Never set a promoted status by hand.** _(enforced: `make validate`)_
   `auto_verified` and `verified` are granted by the verification gates, which store the
   fetched source spans that justify them. Writing the status directly asserts evidence
   that does not exist. Author at `draft` and let the gates promote. See `docs/autonomy.md`.

2. **Never edit licenses in `content/sources.yaml`.** _(enforced for use: content whose provenance points at a source without `commercial_ok` fails `make validate`. The edit itself is caught in review.)_
   Whether a source may be used commercially is a legal decision made by a human. An
   agent may read the file; it may not add a source or change `commercial_ok`.

3. **Never create a question without `wiki_refs` and `sources`.** _(enforced: schema)_
   The wiki reference is what lets the evaluator cite a section instead of saying
   "wrong". The source is what lets the claim be re-verified when a version moves.

4. **Never create a question with no backing wiki article.** _(enforced: cross-file check)_
   Facts land in the wiki first. A question that has no article behind it cannot be
   kept accurate and cannot be cited.

5. **Never leave a placeholder.** _(enforced: placeholder scan over `content/`)_
   `TODO`, `FIXME`, `TBD`, `test.skip`, `test.only`, an empty `expected_answer`, an
   empty `naive_approach`. A placeholder that ships reads as a finished answer to the
   user and as progress to the harness. Write it or delete the item.

6. **Never commit secrets or `.env` files.** _(partially enforced: `.gitignore`. No secret scanner yet — this one still relies on review.)_

## Work discipline

7. **Never mark an item done without running its `verification` command.** _(enforced: only `make harness-verify` writes evidence, and CI re-runs every passing claim)_
   Evidence, not confidence. Paste the command output into the item's `evidence`.

8. **Never hold more than one item in `active`.** _(enforced: `make harness-activate` and `make harness-check`)_
   Split attention produces work that is started everywhere and finished nowhere.

9. **Never generate content faster than it can be verified.** _(enforced: `make harness-activate` refuses)_
   The queue limit now applies to items awaiting the gates rather than a person. A backlog
   of ungated drafts is not progress, and counting it as progress is the failure mode the
   limit exists to prevent.

10. **Never add items to `feature_list.json`.** _(review only — the harness cannot tell a human-requested item from a self-assigned one)_
    Scope belongs to the human. A loop that rewrites its own goal has no goal.

11. **Never refactor before verification passes.** _(review only)_
    Refactoring unverified code destroys the evidence of which parts were ever correct.

12. **Never report work as complete without linking the evidence.** _(enforced: an item in a terminal state with no evidence fails `make harness-check`)_

## Product boundaries

13. **Never request broad host permissions in the extension manifest.** _(review only until the extension exists; becomes a manifest check in phase 1)_
    Narrow, per-domain permissions only. `<all_urls>` is the single largest cause of
    slow and failed store review.

14. **Never send user data anywhere except the endpoint the user configured.** _(review only until the extension exists; becomes a lint rule on `fetch` in phase 1)_
    The extension keeps everything local; the only outbound call is to the user's own
    LLM provider with the user's own key. This claim must stay literally true.

15. **Never load or evaluate remote code in the extension.** _(review only until the extension exists)_

## Locked surfaces

16. **Never modify a locked surface.** _(enforced: `scripts/locked-surfaces.sh` in CI)_
    `packages/evaluator/`, `docs/autonomy.md`, `content/sources.yaml`,
    `.github/workflows/`, and the check itself. These define or enforce the acceptance
    signal; a loop that can edit them can grant itself a passing score. Changing them is
    a human act, in a commit without the agent trailer.
    Manifest V3 prohibits it, and it would break the offline guarantee anyway.
