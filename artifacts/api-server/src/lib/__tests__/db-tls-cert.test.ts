import { test, after } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import tls from "node:tls";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

// Regression test for the MITM hardening in lib/db/src/index.ts. The DB client
// was just changed to verify the Postgres server's TLS certificate against the
// system CA bundle whenever sslmode is on. If someone in the future re-introduces
// `rejectUnauthorized: false` (or strips the `wantsSsl` branch entirely), the
// production DB connection silently becomes vulnerable to a network attacker
// presenting a self-signed cert. This test stands up a fake Postgres server
// that:
//   1. accepts the 8-byte SSLRequest startup packet,
//   2. replies "S" to advertise SSL support, and
//   3. upgrades the socket to TLS using a freshly generated SELF-SIGNED cert.
// We then point the real @workspace/db Pool/Client at it with sslmode=require
// and assert that the connection is refused with a recognisable TLS-cert error
// code. If the verification gets disabled, this test will start failing because
// the connection will progress past TLS instead of being aborted.

interface ServerState {
  sslRequestsReceived: number;
}

function generateSelfSignedCert(): { key: Buffer; cert: Buffer } {
  // Node has no first-class API for minting an X.509 cert, so we shell out to
  // openssl (present in the base container image). The cert is throwaway and
  // never written outside the temp dir.
  const dir = mkdtempSync(path.join(tmpdir(), "pg-tls-test-"));
  try {
    const keyPath = path.join(dir, "key.pem");
    const certPath = path.join(dir, "cert.pem");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-days",
        "365",
        "-nodes",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=IP:127.0.0.1,DNS:localhost",
      ],
      { stdio: "pipe" },
    );
    return {
      key: readFileSync(keyPath),
      cert: readFileSync(certPath),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function startFakePostgresTlsServer(creds: {
  key: Buffer;
  cert: Buffer;
}): Promise<{ server: net.Server; port: number; state: ServerState }> {
  return new Promise((resolve) => {
    const state: ServerState = { sslRequestsReceived: 0 };
    const server = net.createServer((socket) => {
      socket.once("data", (data) => {
        // Postgres SSLRequest is exactly 8 bytes: length=8, code=80877103.
        // On localhost the kernel delivers it in one chunk so we don't need a
        // length-prefixed accumulator here. socket data is typed as
        // string | Buffer because of the optional encoding setter; we never
        // call setEncoding so this is always a Buffer at runtime, but the
        // explicit guard keeps the TS narrowing honest.
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (
          buf.length >= 8 &&
          buf.readUInt32BE(0) === 8 &&
          buf.readUInt32BE(4) === 80877103
        ) {
          state.sslRequestsReceived++;
          socket.write("S");
          // Upgrade the raw TCP socket to TLS using our self-signed cert.
          // The client will start a TLS handshake, validate the chain against
          // its CA bundle, fail, and abort. We don't need to send any
          // post-TLS Postgres bytes — we just need the client to attempt the
          // handshake.
          const tlsSocket = new tls.TLSSocket(socket, {
            isServer: true,
            key: creds.key,
            cert: creds.cert,
          });
          tlsSocket.on("secure", () => {
            // The TLS handshake completed successfully — that should NEVER
            // happen for a properly hardened client (the cert is self-signed).
            // Close the socket immediately so the test fails fast with a
            // "Connection terminated" / ECONNRESET style error instead of
            // hanging forever waiting for a Postgres startup response. The
            // test assertions look for a specific TLS-cert-rejection code,
            // so an early close here surfaces a regression as a clean
            // assertion failure rather than a frozen test runner.
            tlsSocket.destroy();
          });
          tlsSocket.on("error", () => {
            /* expected: client aborts the handshake */
          });
          tlsSocket.on("close", () => {});
        } else {
          socket.destroy();
        }
      });
      socket.on("error", () => {});
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, port: addr.port, state });
    });
  });
}

// MUST happen before importing @workspace/db: that module reads DATABASE_URL
// at module-load time and constructs a singleton Pool. Cleanse the escape-hatch
// envs from the parent shell so we are exercising the strict verification path,
// not the break-glass downgrade.
//
// IMPORTANT: we deliberately DO NOT put `?sslmode=require` in DATABASE_URL.
// `pg-connection-string` v2 silently rewrites sslmode=require into a verify-
// full ssl config and OVERWRITES whatever ssl options @workspace/db passed in.
// If we set sslmode in the URL, the test would still pass even after a
// regression that flipped our code to `rejectUnauthorized: false`, because
// pg-connection-string's ssl config would take over. By setting PGSSL=require
// instead — which is one of the wantsSsl triggers in lib/db/src/index.ts —
// we make our own `ssl: { rejectUnauthorized }` block the ONLY thing standing
// between the pool and a self-signed cert. That's the actual contract under
// test.
const creds = generateSelfSignedCert();
const fake = await startFakePostgresTlsServer(creds);
process.env["DATABASE_URL"] =
  `postgres://test:test@127.0.0.1:${fake.port}/test`;
process.env["PGSSL"] = "require";
delete process.env["PGSSL_ALLOW_INVALID_CERT"];
delete process.env["PGSSL_BREAK_GLASS_ACK"];

const { pool, createListenClient } = await import("@workspace/db");

// Idle-client errors don't apply (we never get a healthy client into the pool),
// but suppress 'error' events defensively so a stray emit can't trip the
// runner. The query rejection is what we actually assert on.
pool.on("error", () => {});

after(async () => {
  await pool.end().catch(() => {});
  await new Promise<void>((resolve) => fake.server.close(() => resolve()));
});

// Codes Node's TLS layer can produce when the peer presents an untrusted cert.
// All of them mean "verification failed" — which one fires depends on Node /
// OpenSSL version and how the cert is structured.
const TLS_REJECT_CODES = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_SIGNATURE_FAILURE",
]);

function extractTlsCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  if (typeof e.code === "string") return e.code;
  if (e.cause && typeof e.cause.code === "string") return e.cause.code;
  return undefined;
}

test("pool.query() against a server presenting a self-signed cert is rejected with a TLS cert error", async () => {
  let caught: unknown = null;
  try {
    await pool.query("SELECT 1");
  } catch (err) {
    caught = err;
  }
  assert.ok(
    caught,
    "pool.query must reject when the Postgres server presents a self-signed cert with sslmode=require",
  );
  const code = extractTlsCode(caught);
  assert.ok(
    code !== undefined && TLS_REJECT_CODES.has(code),
    `expected a TLS self-signed-cert rejection code, got code=${String(code)} message=${String((caught as Error)?.message)}. ` +
      `If this passed (no error), someone has likely re-introduced rejectUnauthorized:false in lib/db/src/index.ts and re-opened the MITM hole.`,
  );
  // Defensive: prove the failure happened at the TLS step, not earlier (TCP
  // refused, wrong port, etc.). The fake server only bumps this counter after
  // it has actually parsed an SSLRequest from the client.
  assert.equal(
    fake.state.sslRequestsReceived,
    1,
    "fake server must have received exactly one Postgres SSLRequest before TLS failed (otherwise the test passed for the wrong reason)",
  );
});

test("DATABASE_URL containing ?sslmode=require also rejects a self-signed cert (URL trigger path)", async () => {
  // Behavioural test for the OTHER way operators turn SSL on: putting
  // `?sslmode=require` in DATABASE_URL itself (this is what every managed
  // provider's connection string looks like). The protection here actually
  // comes from `pg-connection-string` v2 silently treating sslmode=require as
  // verify-full and synthesising its own ssl block — so this test guards a
  // contract one layer up from `lib/db/src/index.ts`: "if your DATABASE_URL
  // says sslmode=require, a bad cert MUST be rejected, regardless of which
  // layer enforces it." If pg ever upgrades to v9 with weaker libpq-style
  // semantics, or if pg-connection-string changes behaviour, this test
  // catches the regression before it reaches production.
  //
  // We use a fresh standalone Pool here (not the singleton from @workspace/db)
  // so we can point it at a connection string with sslmode set without
  // re-importing the module under different env. This intentionally bypasses
  // our own wantsSsl branch — the whole point is to prove the URL-trigger
  // path is safe end-to-end.
  const { default: pg } = await import("pg");
  const standalonePool = new pg.Pool({
    connectionString: `postgres://test:test@127.0.0.1:${fake.port}/test?sslmode=require`,
  });
  standalonePool.on("error", () => {});
  const sslRequestsBefore = fake.state.sslRequestsReceived;
  let caught: unknown = null;
  try {
    await standalonePool.query("SELECT 1");
  } catch (err) {
    caught = err;
  } finally {
    await standalonePool.end().catch(() => {});
  }
  assert.ok(
    caught,
    "Pool with ?sslmode=require in the URL must reject a self-signed cert",
  );
  const code = extractTlsCode(caught);
  assert.ok(
    code !== undefined && TLS_REJECT_CODES.has(code),
    `expected a TLS self-signed-cert rejection code from the sslmode=require URL path, got code=${String(code)} message=${String((caught as Error)?.message)}. ` +
      `If this passed (no error), the contract that DATABASE_URL?sslmode=require enforces strict cert verification has been silently weakened — investigate pg / pg-connection-string upgrades.`,
  );
  assert.equal(
    fake.state.sslRequestsReceived - sslRequestsBefore,
    1,
    "fake server must have received exactly one SSLRequest from the sslmode=require pool before TLS failed",
  );
});

test("createListenClient().connect() against a self-signed cert is also rejected (LISTEN path uses the same SSL config)", async () => {
  // The LISTEN client is a separate code path in lib/db/src/index.ts that
  // duplicates the same ssl config. Cover it explicitly so a regression in one
  // call site can't slip through while the other stays safe.
  const sslRequestsBefore = fake.state.sslRequestsReceived;
  const client = createListenClient();
  let caught: unknown = null;
  try {
    await client.connect();
  } catch (err) {
    caught = err;
  } finally {
    await client.end().catch(() => {});
  }
  assert.ok(
    caught,
    "createListenClient().connect() must reject when the Postgres server presents a self-signed cert",
  );
  const code = extractTlsCode(caught);
  assert.ok(
    code !== undefined && TLS_REJECT_CODES.has(code),
    `expected a TLS self-signed-cert rejection code from the LISTEN client, got code=${String(code)} message=${String((caught as Error)?.message)}`,
  );
  assert.equal(
    fake.state.sslRequestsReceived - sslRequestsBefore,
    1,
    "fake server must have received exactly one SSLRequest from createListenClient before TLS failed",
  );
});
