import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Sibling of the other maintenance suites. The existing maintenance.test.ts /
// maintenance-db.test.ts files cover the env-var ETA path and the soft/hard
// admin-toggled freeze. They do NOT cover the *admin-set* ETA contract that
// task #52 wired into POST /admin/settings:
//
//   - valid ISO timestamp -> upsert system_settings.maintenance_ends_at as
//     the canonical UTC ISO string (so the public countdown banner reads the
//     same shape regardless of which input format the admin typed in the
//     datetime-local picker).
//   - null / "" -> DELETE the row so getMaintenanceState() falls back to the
//     MAINTENANCE_ETA env var (the cutover-runbook source of truth). The
//     generic upsert loop in the handler can't represent "absent" because
//     the value column is NOT NULL — the bespoke branch has to actually drop
//     the row.
//   - garbage input -> reject 400 instead of writing junk into the
//     public-facing banner.
//   - the in-memory maintenance cache is cleared the moment the admin POST
//     lands, so the new value is visible on the very NEXT request rather
//     than after the 5 s TTL.
//
// None of that is covered today. A future refactor of the settings handler
// could silently break the live countdown banner — or worse, write garbage
// into the public ETA — and nothing would catch it. This suite proves all
// four branches end-to-end (admin-authed HTTP -> handler -> DB -> public
// status endpoint).

// Critical: MAINTENANCE_MODE / MAINTENANCE_ETA / MAINTENANCE_MESSAGE must
// be UNSET before importing the app so the assertions about env-var
// fallback are unambiguous about which branch is firing. We re-set
// MAINTENANCE_ETA per-test (only where the assertion needs it) and tear
// it back down so other tests in this file aren't surprised by leaked
// env state.
delete process.env["MAINTENANCE_MODE"];
delete process.env["MAINTENANCE_ETA"];
delete process.env["MAINTENANCE_MESSAGE"];

const { default: app } = await import("../../app");
const { db, pool, systemSettingsTable, usersTable } = await import("@workspace/db");
const {
  invalidateMaintenanceCache,
  getMaintenanceState,
} = await import("../../middlewares/maintenance");
const { signToken } = await import("../../middlewares/auth");
const { eq } = await import("drizzle-orm");

let server: Server;
let baseUrl = "";

// Unique-suffix fixture identity so reruns / concurrent suites don't
// collide on the users.email / users.referral_code unique constraints.
const SUFFIX = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const ADMIN_EMAIL = `eta-admin-${SUFFIX}@test.local`;
let adminId = 0;
let adminToken = "";

// IMPORTANT: only ever delete the ONE row this suite is asserting on
// (`maintenance_ends_at`). node:test runs each *.test.ts file in its own
// worker process IN PARALLEL, and the sibling maintenance suites
// (maintenance-hard-block.test.ts in particular) seed `maintenance_mode` /
// `maintenance_hard_block` then make HTTP calls. Wiping those rows from
// THIS worker between their reseed and their fetch races them straight to
// a flaky failure. Restricting our cleanup to `maintenance_ends_at` keeps
// the assertions in this file unambiguous (we own that row outright)
// without trampling on what the other suites care about.
async function clearMaintenanceEndsAtRow(): Promise<void> {
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "maintenance_ends_at"));
  invalidateMaintenanceCache();
}

async function clearWhitelist(): Promise<void> {
  // adminMiddleware refuses requests when an `admin_ip_whitelist` is set and
  // the caller's IP isn't on it. The test client connects from 127.0.0.1, so
  // clear the row up-front; sibling suites can race in between, so we also
  // clear it again at the start of each test.
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "admin_ip_whitelist"));
}

async function readMaintenanceEndsAtRow(): Promise<string | null> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "maintenance_ends_at"))
    .limit(1);
  return rows[0]?.value ?? null;
}

function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
  });
}

before(async () => {
  await clearMaintenanceEndsAtRow();
  await clearWhitelist();

  // Bypass /auth/register because (a) it's a POST and could be blocked by
  // unrelated maintenance toggles racing in from sibling suites, and (b) we
  // need precise control over isAdmin so authMiddleware/adminMiddleware
  // behave deterministically. signToken uses the same JWT_SECRET that
  // authMiddleware verifies, so the token round-trips through the real
  // middleware.
  await db.delete(usersTable).where(eq(usersTable.email, ADMIN_EMAIL));
  const [admin] = await db
    .insert(usersTable)
    .values({
      email: ADMIN_EMAIL,
      passwordHash: "x",
      fullName: "Maintenance ETA Admin",
      isAdmin: true,
      adminRole: "admin",
      sponsorId: 0,
      referralCode: `ETA${SUFFIX}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  adminId = admin!.id;
  adminToken = signToken(adminId, true);

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  try {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  } finally {
    try {
      // Best-effort cleanup. Each delete is scoped to identifiers we created
      // in `before`, so it's safe even on partial failures.
      if (adminId) {
        await db.delete(usersTable).where(eq(usersTable.id, adminId));
      }
      await clearMaintenanceEndsAtRow();
      delete process.env["MAINTENANCE_ETA"];
    } finally {
      await pool.end();
    }
  }
});

test("valid ISO timestamp upserts the canonical UTC ISO and surfaces it on GET /admin/settings + /api/system/status", async () => {
  await clearMaintenanceEndsAtRow();
  await clearWhitelist();
  // Make sure the env-var path doesn't mask the DB row we're about to write
  // — getMaintenanceState() picks env over DB when both are present.
  delete process.env["MAINTENANCE_ETA"];
  invalidateMaintenanceCache();

  // Send a non-UTC offset on purpose so the assertion proves the handler
  // canonicalised the value (not just stored whatever the admin typed).
  // 2099-06-15T12:34:56-05:00 == 2099-06-15T17:34:56.000Z.
  const adminInput = "2099-06-15T12:34:56-05:00";
  const expectedCanonical = "2099-06-15T17:34:56.000Z";

  const postRes = await authedFetch("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify({ maintenanceEndsAt: adminInput }),
  });
  assert.equal(
    postRes.status,
    200,
    "valid ISO timestamp must be accepted by POST /admin/settings",
  );

  // The row must be the canonical UTC ISO string — that's what the public
  // countdown banner reads, so any drift here is visible to users.
  const persisted = await readMaintenanceEndsAtRow();
  assert.equal(
    persisted,
    expectedCanonical,
    "system_settings.maintenance_ends_at must be the canonical UTC ISO string regardless of which TZ offset the admin typed",
  );

  // GET /admin/settings must echo the same canonical value back to the admin
  // UI, otherwise the input field would lose information on every save.
  const getRes = await authedFetch("/api/admin/settings");
  assert.equal(getRes.status, 200);
  const getBody = (await getRes.json()) as { maintenanceEndsAt?: string | null };
  assert.equal(
    getBody.maintenanceEndsAt,
    expectedCanonical,
    "GET /admin/settings must echo back the same canonical ISO that POST stored",
  );

  // /api/system/status is the public read path the banner polls. With no
  // MAINTENANCE_ETA env var set, the DB-backed value must surface here as
  // `maintenanceEndsAt`. (`maintenance` itself stays false because we did
  // NOT set maintenance_mode — the ETA can be staged ahead of the freeze.)
  const statusRes = await fetch(`${baseUrl}/api/system/status`);
  assert.equal(statusRes.status, 200);
  const statusBody = (await statusRes.json()) as {
    maintenanceEndsAt?: string | null;
  };
  assert.equal(
    statusBody.maintenanceEndsAt,
    expectedCanonical,
    "/api/system/status must surface the admin-set ETA as `maintenanceEndsAt` when MAINTENANCE_ETA env var is unset",
  );
});

test("maintenanceEndsAt: null DELETEs the row and /api/system/status falls back to MAINTENANCE_ETA env var", async () => {
  await clearMaintenanceEndsAtRow();
  await clearWhitelist();

  // Seed a DB row first so we can prove the null-payload actually deleted
  // it (rather than the row never being there in the first place).
  const seeded = "2099-12-31T00:00:00.000Z";
  const seedRes = await authedFetch("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify({ maintenanceEndsAt: seeded }),
  });
  assert.equal(seedRes.status, 200, "seed POST must succeed before testing null-clear");
  assert.equal(
    await readMaintenanceEndsAtRow(),
    seeded,
    "sanity check: the seed row should be present before we try to clear it",
  );

  // Now point the env var at a *different* value so the fallback assertion
  // can distinguish "row was deleted, env wins" from "row still there".
  // getEnvMaintenanceEndsAt() reads process.env on every call, so this is
  // picked up immediately (after invalidateMaintenanceCache below).
  const envFallback = "2098-01-01T00:00:00.000Z";
  process.env["MAINTENANCE_ETA"] = envFallback;
  try {
    const clearRes = await authedFetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({ maintenanceEndsAt: null }),
    });
    assert.equal(
      clearRes.status,
      200,
      "POST with maintenanceEndsAt:null must succeed (it's the documented 'clear' shape)",
    );

    // The row must be gone — the generic upsert loop can't model "absent"
    // because the value column is NOT NULL, so the bespoke branch has to
    // physically delete the row. Anything else (e.g. writing the literal
    // string "null") would leak garbage into the public banner.
    assert.equal(
      await readMaintenanceEndsAtRow(),
      null,
      "system_settings.maintenance_ends_at row must be DELETEd by maintenanceEndsAt:null (not stored as the string 'null')",
    );

    // /api/system/status now sees no DB row -> falls back to env. Without
    // this fallback, the cutover runbook (which sets MAINTENANCE_ETA via
    // Fly secret) would be silently overridden by an empty admin input.
    const statusRes = await fetch(`${baseUrl}/api/system/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = (await statusRes.json()) as {
      maintenanceEndsAt?: string | null;
    };
    assert.equal(
      statusBody.maintenanceEndsAt,
      envFallback,
      "with the DB row cleared, /api/system/status must fall back to the MAINTENANCE_ETA env var",
    );
  } finally {
    delete process.env["MAINTENANCE_ETA"];
    invalidateMaintenanceCache();
  }
});

test('maintenanceEndsAt: "" also DELETEs the row and /api/system/status falls back to MAINTENANCE_ETA env var', async () => {
  // Same contract as the null test, but for the empty-string shape. The
  // datetime-local input on the admin form sends "" when cleared by the
  // user (not null), so both shapes have to delete the row — otherwise
  // clicking "Clear" in the admin UI would leave the old ETA behind.
  await clearMaintenanceEndsAtRow();
  await clearWhitelist();

  const seeded = "2099-11-30T00:00:00.000Z";
  const seedRes = await authedFetch("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify({ maintenanceEndsAt: seeded }),
  });
  assert.equal(seedRes.status, 200, "seed POST must succeed before testing empty-string-clear");
  assert.equal(
    await readMaintenanceEndsAtRow(),
    seeded,
    "sanity check: the seed row should be present before we try to clear it with empty string",
  );

  const envFallback = "2098-02-02T02:02:02.000Z";
  process.env["MAINTENANCE_ETA"] = envFallback;
  try {
    const clearRes = await authedFetch("/api/admin/settings", {
      method: "POST",
      body: JSON.stringify({ maintenanceEndsAt: "" }),
    });
    assert.equal(
      clearRes.status,
      200,
      "POST with maintenanceEndsAt:'' must succeed — the admin UI sends empty string when the field is cleared",
    );
    assert.equal(
      await readMaintenanceEndsAtRow(),
      null,
      "system_settings.maintenance_ends_at row must be DELETEd by maintenanceEndsAt:'' (the datetime-local input emits '' when cleared)",
    );

    const statusRes = await fetch(`${baseUrl}/api/system/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = (await statusRes.json()) as {
      maintenanceEndsAt?: string | null;
    };
    assert.equal(
      statusBody.maintenanceEndsAt,
      envFallback,
      "with the DB row cleared via '', /api/system/status must fall back to the MAINTENANCE_ETA env var",
    );
  } finally {
    delete process.env["MAINTENANCE_ETA"];
    invalidateMaintenanceCache();
  }
});

test("non-parseable string returns 400 with no row written", async () => {
  await clearMaintenanceEndsAtRow();
  await clearWhitelist();
  // Make sure no MAINTENANCE_ETA env leaks across so the post-condition
  // assertion (no row written) is unambiguous.
  delete process.env["MAINTENANCE_ETA"];
  invalidateMaintenanceCache();

  const garbage = "not-a-real-timestamp";
  const res = await authedFetch("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify({ maintenanceEndsAt: garbage }),
  });
  assert.equal(
    res.status,
    400,
    "non-parseable maintenanceEndsAt must be rejected with 400 — silently writing garbage into the public banner is the worst-case outcome here",
  );
  const body = (await res.json()) as { error?: string };
  assert.match(
    String(body.error ?? ""),
    /maintenanceEndsAt/i,
    "the 400 body must mention the offending field so admins can self-correct",
  );

  // Crucially: NO row must have been written. The bespoke branch runs
  // before the generic upsert loop precisely so a 400 short-circuits
  // before any partial write — assert that promise.
  assert.equal(
    await readMaintenanceEndsAtRow(),
    null,
    "a 400 response must not leave any row in system_settings.maintenance_ends_at — partial writes on the unhappy path are the hardest bugs to spot",
  );
});

test("cache is invalidated on every POST so the new ETA is visible on the very next request (not after the 5 s TTL)", async () => {
  // The maintenance middleware caches getMaintenanceState() for CACHE_TTL_MS
  // (5 s). The admin POST handler calls notifyMaintenanceInvalidation() on
  // any maintenance-key change, which drops the local cache so the operator's
  // *next* request sees the new value with zero RTT. Without this, the admin
  // UI would lie about the saved value for up to 5 s after every save.
  await clearMaintenanceEndsAtRow();
  await clearWhitelist();
  // Env unset so the merged endsAt is driven entirely by the DB row — that
  // makes "value changed in /api/system/status" a clean signal that the
  // cache was actually invalidated by the second POST.
  delete process.env["MAINTENANCE_ETA"];
  invalidateMaintenanceCache();

  // First POST sets value A. notifyMaintenanceInvalidation fires; cache
  // dropped.
  const valueA = "2099-03-03T03:03:03.000Z";
  const postA = await authedFetch("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify({ maintenanceEndsAt: valueA }),
  });
  assert.equal(postA.status, 200);

  // Prime the cache by reading the public status endpoint. From this point
  // on, getMaintenanceState() inside this process would return cached A
  // for up to 5 s — UNLESS the next POST invalidates.
  const primeRes = await fetch(`${baseUrl}/api/system/status`);
  assert.equal(primeRes.status, 200);
  const primeBody = (await primeRes.json()) as { maintenanceEndsAt?: string | null };
  assert.equal(primeBody.maintenanceEndsAt, valueA, "sanity check: cache primed with value A");

  // Independent confirmation that the cache is hot for value A. If
  // getMaintenanceState() is bypassing the cache entirely, this whole test
  // collapses to "are reads consistent with writes" — useful, but not the
  // assertion we want. By reading from getMaintenanceState() directly we
  // also exercise the in-process cache the middleware uses on every request.
  const stateA = await getMaintenanceState();
  assert.equal(
    stateA.endsAt,
    valueA,
    "in-process cache must hold value A right after priming",
  );

  // Now POST value B. The handler must call notifyMaintenanceInvalidation
  // and drop the cache locally — otherwise the next read returns stale A.
  const valueB = "2099-04-04T04:04:04.000Z";
  const postB = await authedFetch("/api/admin/settings", {
    method: "POST",
    body: JSON.stringify({ maintenanceEndsAt: valueB }),
  });
  assert.equal(postB.status, 200);

  // The IMMEDIATE next read must reflect B. We are well within the 5 s
  // TTL, so a passing assertion here can only mean the cache was actively
  // invalidated by the POST (not that the TTL expired).
  const freshRes = await fetch(`${baseUrl}/api/system/status`);
  assert.equal(freshRes.status, 200);
  const freshBody = (await freshRes.json()) as { maintenanceEndsAt?: string | null };
  assert.equal(
    freshBody.maintenanceEndsAt,
    valueB,
    "POST /admin/settings must invalidate the maintenance cache so the new ETA is visible on the very next request — without this, the admin UI lies for up to CACHE_TTL_MS after every save",
  );

  // Same assertion via the in-process state helper, to rule out any
  // intermediary HTTP-layer caching being the thing that changed.
  const stateB = await getMaintenanceState();
  assert.equal(
    stateB.endsAt,
    valueB,
    "in-process getMaintenanceState() must return the new value immediately after POST — proves notifyMaintenanceInvalidation() ran inside the handler",
  );
});
