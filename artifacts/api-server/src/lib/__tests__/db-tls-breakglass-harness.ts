// Helper script for db-tls-breakglass.test.ts. Imports @workspace/db once and
// reports the outcome via stdout + exit code so the parent test can spawn it
// under different env-var combinations.
//
// The breakglass guard in lib/db/src/index.ts runs at module-import time and
// the module exports a singleton Pool, so each scenario MUST run in its own
// fresh node process — that's why this harness exists as a standalone script
// instead of being inlined into the test.
//
// Output contract:
//   exit 0 + stdout "IMPORT_OK"   → import succeeded
//   exit 2 + stderr "IMPORT_FAILED:<message>" → import threw
// Anything else means the harness itself crashed (treated as a test failure).
//
// `export {}` is needed so TypeScript treats this file as a module and allows
// top-level await; the file is not imported by anything (it's spawned as its
// own process by the parent test) so the empty export has no runtime effect.
export {};

try {
  await import("@workspace/db");
  // eslint-disable-next-line no-console
  console.log("IMPORT_OK");
  process.exit(0);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(
    "IMPORT_FAILED:" + (err instanceof Error ? err.message : String(err)),
  );
  process.exit(2);
}
