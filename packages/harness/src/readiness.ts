/**
 * Definition of Ready and Definition of Done, as rules rather than prose.
 *
 * Both exist in .harness/1-instructions/definition-of-done.md for people; these are the parts a machine can
 * decide, checked at the two moments they matter — before an item is started, and before
 * it is closed. A definition nothing enforces is a wish.
 */

export interface Item {
  id: string;
  kind?: "code" | "content";
  behavior: string;
  verification: string;
  state: string;
  evidence: string | null;
  depends_on?: string[];
}

export interface Violation {
  what: string;
  why: string;
  fix: string;
}

/** Phrasing that describes activity rather than an outcome someone could observe. */
const TASK_SHAPED = /^(implement|add|create|build|write|refactor|update|fix|make)\b/i;
const PLACEHOLDER = /\b(TODO|TBD|FIXME)\b/;

/** Terminal states a dependency must have reached before an item can start. */
const SATISFIED = new Set(["passing", "auto_verified", "verified", "done"]);

/**
 * Definition of Ready. Checked before an item may be activated.
 *
 * The expensive failure is starting work whose success cannot be decided, because it is
 * only discovered at the end, when the work is already done and unfalsifiable.
 */
export function readiness(item: Item, all: Item[]): Violation[] {
  const problems: Violation[] = [];

  if (item.behavior.trim().length < 40) {
    problems.push({
      what: "behavior is too short to describe an observable outcome",
      why: "a one-line task name cannot be verified, so nobody can tell when it is finished",
      fix: "state what will be observably true, in the terms someone could check",
    });
  }

  if (TASK_SHAPED.test(item.behavior.trim())) {
    problems.push({
      what: `behavior describes an activity ("${item.behavior.trim().split(/\s+/)[0]} ...") rather than an outcome`,
      why: "an activity is complete when you stop doing it, which is not a definition of done",
      fix: 'rewrite as the state that will hold — "the validator rejects X" rather than "add a check for X"',
    });
  }

  if (PLACEHOLDER.test(item.behavior)) {
    problems.push({
      what: "behavior still contains a placeholder",
      why: "the scope is not settled, so any verification written against it is provisional",
      fix: "settle the scope before starting",
    });
  }

  if (!item.verification.trim()) {
    problems.push({
      what: "no verification command",
      why: "without an executable check the item can only be closed on an opinion",
      fix: "give a command that passes when the behavior holds and fails when it does not",
    });
  }

  if (!item.kind) {
    problems.push({
      what: "no kind",
      why: "code closes on its verification passing; content closes on the promotion gates. The rules differ",
      fix: 'set kind to "code" or "content"',
    });
  }

  for (const id of item.depends_on ?? []) {
    const dep = all.find((i) => i.id === id);
    if (!dep) {
      problems.push({ what: `unknown dependency "${id}"`, why: "the ordering it implies cannot be checked", fix: "fix the id or drop the dependency" });
    } else if (!SATISFIED.has(dep.state)) {
      problems.push({
        what: `dependency "${id}" is ${dep.state}`,
        why: "starting on an unfinished dependency produces work that has to be redone when it lands",
        fix: `close "${id}" first`,
      });
    }
  }

  return problems;
}

/**
 * Definition of Done. Checked before an item is recorded as closed.
 *
 * The verification command passing is necessary and not sufficient: evidence has to exist
 * and be tied to this item, or "done" is an assertion again.
 */
export function doneness(item: Item, verificationPassed: boolean): Violation[] {
  const problems: Violation[] = [];

  if (!verificationPassed) {
    problems.push({
      what: "verification did not pass",
      why: "done means a command succeeded, not that the work looked right",
      fix: "fix the cause and run it again",
    });
  }

  if (!item.evidence || item.evidence.trim().length === 0) {
    problems.push({
      what: "no evidence recorded",
      why: "a closed item with no output cannot be re-checked later, and CI re-runs these claims",
      fix: "let the harness record the command output rather than setting state by hand",
    });
  }

  return problems;
}

export function format(id: string, violations: Violation[]): string {
  return violations.map((v) => `${id}: ${v.what}\n  why:  ${v.why}\n  fix:  ${v.fix}`).join("\n\n");
}
