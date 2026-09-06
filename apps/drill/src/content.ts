import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readYaml, walk } from "@schema/load.js";
import { Question } from "@schema/question.js";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Loads every question in `content/`, skipping any file that fails the schema. */
export function loadQuestions(root: string = REPO_ROOT): Question[] {
  const out: Question[] = [];
  for (const file of walk(join(root, "content/questions"), [".yaml", ".yml"])) {
    const parsed = Question.safeParse(readYaml(root, file).data);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
