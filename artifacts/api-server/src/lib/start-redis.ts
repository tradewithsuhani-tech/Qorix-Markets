import { spawn, execSync } from "child_process";

/**
 * Check whether REDIS_URL points at a remote Redis (Upstash, ElastiCache,
 * a Fly Redis app, etc.) rather than the local in-container redis-server.
 * In hosted environments (Fly, etc.) we MUST NOT spawn a local redis-server
 * because (a) the binary isn't installed and (b) using a local Redis would
 * silently lose all queue / cache state on every machine restart.
 */
function isRemoteRedisUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function ensureRedisRunning(): Promise<void> {
  if (isRemoteRedisUrl(process.env["REDIS_URL"])) {
    console.log("[redis] REDIS_URL points to a remote host — skipping local redis-server bootstrap.");
    return;
  }

  try {
    execSync("redis-cli ping", { stdio: "ignore", timeout: 1000 });
    console.log("[redis] Already running.");
    return;
  } catch {
  }

  console.log("[redis] Starting redis-server...");

  const proc = spawn("redis-server", ["--save", "", "--loglevel", "warning"], {
    stdio: "ignore",
    detached: true,
  });
  proc.unref();

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      execSync("redis-cli ping", { stdio: "ignore", timeout: 1000 });
      console.log("[redis] Ready.");
      return;
    } catch {
    }
  }

  throw new Error("Redis did not start within 10 seconds.");
}
