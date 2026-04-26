#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const target = path.resolve(
  __dirname,
  "..",
  "..",
  "api-client-react",
  "src",
  "generated",
  "api.ts",
);

if (!fs.existsSync(target)) {
  console.error(`patch-generated: target not found: ${target}`);
  process.exit(1);
}

const NEEDLE = "query?: UseQueryOptions<";
const ALREADY = "query?: Partial<UseQueryOptions<";

const original = fs.readFileSync(target, "utf8");

let result = "";
let i = 0;
let wrapped = 0;
let alreadyWrapped = 0;

while (i < original.length) {
  if (original.startsWith(ALREADY, i)) {
    alreadyWrapped++;
    result += original[i];
    i++;
    continue;
  }

  if (original.startsWith(NEEDLE, i)) {
    const ltPos = i + "query?: UseQueryOptions".length;
    let depth = 0;
    let j = ltPos;
    for (; j < original.length; j++) {
      const c = original[j];
      if (c === "<") {
        depth++;
      } else if (c === ">") {
        depth--;
        if (depth === 0) break;
      }
    }

    if (depth !== 0 || j >= original.length) {
      result += original[i];
      i++;
      continue;
    }

    const useQueryOptionsExpr = original.slice(
      i + "query?: ".length,
      j + 1,
    );
    result += "query?: Partial<" + useQueryOptionsExpr + ">";
    i = j + 1;
    wrapped++;
    continue;
  }

  result += original[i];
  i++;
}

if (result === original) {
  console.log(
    `patch-generated: no changes (${alreadyWrapped} occurrence(s) already wrapped)`,
  );
} else {
  fs.writeFileSync(target, result);
  console.log(
    `patch-generated: wrapped ${wrapped} \`query?: UseQueryOptions<...>\` occurrence(s) with Partial<>`,
  );
}

// Drift guards. If either of these fires, orval's output format
// has likely changed and this script needs to be updated.

// 1) The generator must produce at least one query options hook.
//    If we found nothing to wrap *and* nothing was already wrapped,
//    the regex/needle no longer matches orval's output.
if (wrapped === 0 && alreadyWrapped === 0) {
  console.error(
    "patch-generated: ERROR — found 0 `query?: UseQueryOptions<` occurrences " +
      "to wrap or already wrap. Orval's output format may have changed; " +
      "update lib/api-spec/scripts/patch-generated.mjs.",
  );
  process.exit(1);
}

// 2) After patching, no unwrapped `query?: UseQueryOptions<...>` should remain.
const final = fs.readFileSync(target, "utf8");
let unwrapped = 0;
let k = 0;
while (k < final.length) {
  if (final.startsWith(ALREADY, k)) {
    k += ALREADY.length;
    continue;
  }
  if (final.startsWith(NEEDLE, k)) {
    unwrapped++;
    k += NEEDLE.length;
    continue;
  }
  k++;
}
if (unwrapped > 0) {
  console.error(
    `patch-generated: ERROR — ${unwrapped} unwrapped \`query?: UseQueryOptions<\` ` +
      "occurrence(s) remain after patching. The patch script's bracket walker " +
      "may have failed to handle a new pattern in orval's output.",
  );
  process.exit(1);
}
