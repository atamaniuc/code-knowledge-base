#!/usr/bin/env tsx
/**
 * Harness CLI — the only thing allowed to move an item's state.
 *
 * Lecture 08's core claim is that the harness, not the agent, controls state
 * transitions, and that passing a verification command is the sole gate. An agent
 * editing `state` by hand is precisely the failure this is meant to prevent, so
 * `check` re-runs every claimed verification instead of trusting the file.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIST = resolve(ROOT, "feature_list.json");

type State = "not_started" | "active" | "blocked" | "passing" | "human_review" | "done";

interface Item {
  id: string;
  phase: string;
  kind?: "code" | "content";
  behavior: string;
  verification: string;
  state: State;
  evidence: string | null;
  last_failure?: string | null;
  notes?: string;
}

interface FeatureList {
  wip_limit: number;
  review_queue_limit: number;
  items: Item[];
  [k: string]: unknown;
}

const read = (): FeatureList => JSON.parse(readFileSync(LIST, "utf8"));
const write = (list: FeatureList) => writeFileSync(LIST, JSON.stringify(list, null, 2) + "\n");

const find = (list: FeatureList, id: string): Item => {
  const item = list.items.find((i) => i.id === id);
  if (!item) {
    fail(`no item "${id}"`, `run "make harness-status" to see the queue`);
  }
  return item;
};

function fail(what: string, fix: string): never {
  console.error(`harness: ${what}\n  fix:  ${fix}`);
  process.exit(1);
}

/** Terminal state after a passing verification: code closes itself, content waits for a human. */
const terminalState = (item: Item): State => (item.kind === "content" ? "human_review" : "passing");

/** A verification command may not run longer than this before it is treated as failed. */
const VERIFICATION_TIMEOUT_MS = 10 * 60 * 1000;

function runVerification(item: Item): { ok: boolean; output: string } {
  try {
    const output = execSync(item.verification, {
      cwd: ROOT,
      encoding: "utf8",
      // stdin is closed: a command that stops to ask a question must fail, not hang the loop.
      stdio: ["ignore", "pipe", "pipe"],
      timeout: VERIFICATION_TIMEOUT_MS,
      env: {
        ...process.env,
        // Nested harness calls degrade to a plain check. Without this, an item whose
        // verification invokes make would inherit ARGS=--reverify (GNU make exports
        // command-line variables to sub-makes) and recurse forever.
        HARNESS_REVERIFY: "1",
      },
    });
    return { ok: true, output };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string; signal?: string };
    if (e.signal === "SIGTERM") {
      return {
        ok: false,
        output:
          `verification exceeded ${VERIFICATION_TIMEOUT_MS / 60000} minutes and was killed\n` +
          "  why:  a verification that never returns blocks the loop indefinitely\n" +
          "  fix:  make the command terminate, or split the item into smaller ones",
      };
    }
    return { ok: false, output: [e.stdout, e.stderr, e.message].filter(Boolean).join("\n") };
  }
}

const lastLines = (text: string, n = 6) =>
  text.trim().split("\n").filter((l) => l.trim().length > 0).slice(-n).join(" | ").slice(0, 500);

// ---------------------------------------------------------------- commands

function status(): void {
  const list = read();
  const byState = new Map<State, Item[]>();
  for (const i of list.items) byState.set(i.state, [...(byState.get(i.state) ?? []), i]);

  for (const state of ["active", "blocked", "human_review", "not_started", "passing", "done"] as State[]) {
    const items = byState.get(state) ?? [];
    if (items.length === 0) continue;
    console.log(`\n${state} (${items.length})`);
    for (const i of items) console.log(`  ${i.id.padEnd(28)} phase ${i.phase}`);
  }

  const active = (byState.get("active") ?? []).length;
  const queued = (byState.get("human_review") ?? []).length;
  console.log(`\nWIP ${active}/${list.wip_limit}   review queue ${queued}/${list.review_queue_limit}`);
}

function activate(id: string): void {
  const list = read();
  const active = list.items.filter((i) => i.state === "active");
  if (active.length >= list.wip_limit) {
    fail(
      `WIP limit reached — "${active[0]?.id}" is already active`,
      "finish or block that item first; split attention is what produces work started everywhere and finished nowhere",
    );
  }
  const queued = list.items.filter((i) => i.state === "human_review").length;
  if (queued >= list.review_queue_limit) {
    fail(
      `review queue is full (${queued}/${list.review_queue_limit})`,
      "review the queued items before generating more; authoring is not the bottleneck, review is",
    );
  }
  const item = find(list, id);
  if (item.state !== "not_started" && item.state !== "blocked") {
    fail(`"${id}" is ${item.state}, not startable`, "pick a not_started or blocked item");
  }
  item.state = "active";
  write(list);
  console.log(`active: ${id}\n  ${item.behavior}\n  verify with: make harness-verify ID=${id}`);
}

function verify(id: string): void {
  const list = read();
  const item = find(list, id);
  if (item.state !== "active") {
    fail(`"${id}" is ${item.state}; only an active item can be verified`, `run "make harness-activate ID=${id}" first`);
  }

  console.log(`running: ${item.verification}\n`);
  const { ok, output } = runVerification(item);

  if (!ok) {
    item.state = "blocked";
    item.last_failure = lastLines(output);
    write(list);
    console.error(output);
    fail(`"${id}" failed verification and is now blocked`, "fix the cause, then re-activate; do not edit state by hand");
  }

  item.state = terminalState(item);
  item.evidence = lastLines(output);
  item.last_failure = null;
  write(list);
  console.log(output);
  console.log(`${id} -> ${item.state}`);
  if (item.state === "human_review") {
    console.log("  machine checks passed; a human closes this item (CONSTRAINTS.md #1)");
  }
}

/**
 * Invariants plus re-verification. Run in CI so a hand-edited `passing` is caught:
 * the claim is only accepted if the command still passes here.
 */
function check(reverify: boolean): void {
  const list = read();
  const problems: string[] = [];

  if (reverify && process.env.HARNESS_REVERIFY === "1") {
    console.log("harness: already inside a re-verification run, checking invariants only");
    reverify = false;
  }

  const active = list.items.filter((i) => i.state === "active");
  if (active.length > list.wip_limit) {
    problems.push(
      `WIP limit exceeded: ${active.length} active (${active.map((i) => i.id).join(", ")})\n` +
        `  why:  split attention produces work started everywhere and finished nowhere\n` +
        `  fix:  keep exactly one item active`,
    );
  }

  const queued = list.items.filter((i) => i.state === "human_review");
  if (queued.length > list.review_queue_limit) {
    problems.push(
      `review queue over limit: ${queued.length}/${list.review_queue_limit}\n` +
        `  why:  review is the bottleneck; outrunning it inflates a metric that means nothing\n` +
        `  fix:  review the queued items before generating more`,
    );
  }

  for (const item of list.items) {
    if ((item.state === "passing" || item.state === "human_review" || item.state === "done") && !item.evidence) {
      problems.push(
        `"${item.id}" is ${item.state} with no evidence\n` +
          `  why:  done means a command passed, not that the work looked right\n` +
          `  fix:  run "make harness-verify ID=${item.id}" instead of editing state`,
      );
    }
  }

  if (reverify) {
    for (const item of list.items.filter((i) => i.state === "passing" || i.state === "done")) {
      const { ok, output } = runVerification(item);
      if (!ok) {
        problems.push(
          `"${item.id}" claims ${item.state} but its verification fails now\n` +
            `  command: ${item.verification}\n` +
            `  output:  ${lastLines(output, 3)}\n` +
            `  fix:  fix the regression, or the claim was never true`,
        );
      }
    }
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`harness: ${p}\n`);
    console.error(`${problems.length} harness invariant violation(s)`);
    process.exit(1);
  }
  console.log(`harness invariants hold${reverify ? " (all passing items re-verified)" : ""}`);
}

// ---------------------------------------------------------------- entry

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case "status":
    status();
    break;
  case "activate":
    if (!arg) fail("activate needs an item id", 'run "make harness-status" to see the queue');
    activate(arg);
    break;
  case "verify":
    if (!arg) fail("verify needs an item id", "pass the id of the active item");
    verify(arg);
    break;
  case "check":
    check(arg === "--reverify");
    break;
  default:
    console.log("usage: harness status | activate <id> | verify <id> | check [--reverify]");
    process.exit(cmd ? 1 : 0);
}
