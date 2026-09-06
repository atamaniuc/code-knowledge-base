# CONSTRAINTS

Fifteen hard rules. Not guidelines — a violation is a defect, not a style disagreement.
Rules 1-6 are enforced by `make check`; the rest are enforced by review.

## Content integrity

1. **Never set `review_status: reviewed` or `verified`.**
   Reviewed means a named human checked the fact against the sources. It is the only
   thing separating this product from generated text, and an agent setting it is
   self-approval. Author at `draft`; a human promotes.

2. **Never edit licenses in `content/sources.yaml`.**
   Whether a source may be used commercially is a legal decision made by a human. An
   agent may read the file; it may not add a source or change `commercial_ok`.

3. **Never create a question without `wiki_refs` and `sources`.**
   The wiki reference is what lets the evaluator cite a section instead of saying
   "wrong". The source is what lets the claim be re-verified when a version moves.

4. **Never create a question with no backing wiki article.**
   Facts land in the wiki first. A question that has no article behind it cannot be
   kept accurate and cannot be cited.

5. **Never leave a placeholder.**
   `TODO`, `FIXME`, `TBD`, `test.skip`, `test.only`, an empty `expected_answer`, an
   empty `naive_approach`. A placeholder that ships reads as a finished answer to the
   user and as progress to the harness. Write it or delete the item.

6. **Never commit secrets or `.env` files.**

## Work discipline

7. **Never mark an item done without running its `verification` command.**
   Evidence, not confidence. Paste the command output into the item's `evidence`.

8. **Never hold more than one item in `active`.**
   Split attention produces work that is started everywhere and finished nowhere.

9. **Never generate content while the human review queue holds more than 15 items.**
   Authoring is not the bottleneck; review is. Outrunning it inflates a metric that
   means nothing.

10. **Never add items to `feature_list.json`.**
    Scope belongs to the human. A loop that rewrites its own goal has no goal.

11. **Never refactor before verification passes.**
    Refactoring unverified code destroys the evidence of which parts were ever correct.

12. **Never report work as complete without linking the evidence.**

## Product boundaries

13. **Never request broad host permissions in the extension manifest.**
    Narrow, per-domain permissions only. `<all_urls>` is the single largest cause of
    slow and failed store review.

14. **Never send user data anywhere except the endpoint the user configured.**
    The extension keeps everything local; the only outbound call is to the user's own
    LLM provider with the user's own key. This claim must stay literally true.

15. **Never load or evaluate remote code in the extension.**
    Manifest V3 prohibits it, and it would break the offline guarantee anyway.
