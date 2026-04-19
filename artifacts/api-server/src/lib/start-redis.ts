import { spawn, execSync } from "child_process";

export async function ensureRedisRunning(): Promise<void> {
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
