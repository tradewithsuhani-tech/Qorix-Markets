import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";

// Bare-import — describeDevice is a pure UA parser, no DB / app boot needed.
const { describeDevice, describeDeviceFull, describeDeviceFromUserAgent } = await import(
  "../../middlewares/auth"
);

function reqWith(ua: string): Request {
  return { headers: { "user-agent": ua } } as unknown as Request;
}

// Golden UA strings collected from real Qorix users (admin LoginEvents drawer
// + Fly request logs). The exact "Samsung Galaxy S23 Ultra" model the user
// asked about is in there. Each assertion below is intentionally narrow —
// ua-parser-js bumps minor labels between releases, so we match prefixes /
// `includes` rather than full equality where the version digits would
// drift across upgrades.

test("describeDevice() backwards-compat shape: { browser, os } strings only", () => {
  const out = describeDevice(reqWith("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"));
  assert.equal(typeof out.browser, "string");
  assert.equal(typeof out.os, "string");
  assert.equal(Object.keys(out).sort().join(","), "browser,os");
});

test("describeDevice() empty UA → 'Unknown' fallbacks (does not throw)", () => {
  const out = describeDevice(reqWith(""));
  assert.equal(out.browser, "Unknown browser");
  assert.equal(out.os, "Unknown OS");
});

test("describeDevice() missing UA header → 'Unknown' fallbacks", () => {
  const out = describeDevice({ headers: {} } as unknown as Request);
  assert.equal(out.browser, "Unknown browser");
  assert.equal(out.os, "Unknown OS");
});

test("Samsung Galaxy S23 Ultra UA → vendor + model exposed", () => {
  // Real Chrome 121 on SM-S918B (Samsung Galaxy S23 Ultra)
  const ua =
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36";
  const full = describeDeviceFull(reqWith(ua));
  assert.equal(full.deviceVendor, "Samsung");
  assert.equal(full.deviceModel, "SM-S918B");
  assert.equal(full.deviceType, "mobile");
  assert.equal(full.osName, "Android");
  assert.equal(full.osVersion, "14");
  assert.equal(full.browserName, "Chrome");
  assert.ok(full.browserVersion?.startsWith("121"));
  assert.ok(full.browserEngine?.startsWith("WebKit") || full.browserEngine?.startsWith("Blink"));
  assert.equal(full.browser, "Chrome 121");
  assert.equal(full.os, "Android 14");
});

test("iPhone 15 Pro Safari UA → vendor=Apple, deviceType=mobile", () => {
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1";
  const full = describeDeviceFull(reqWith(ua));
  assert.equal(full.deviceVendor, "Apple");
  assert.equal(full.deviceType, "mobile");
  assert.equal(full.osName, "iOS");
  assert.ok(full.osVersion?.startsWith("17"));
  assert.equal(full.browserName, "Mobile Safari");
  assert.ok(full.os.startsWith("iOS"));
});

test("Windows desktop Chrome UA → desktop type inferred, OS labelled", () => {
  const ua =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const full = describeDeviceFull(reqWith(ua));
  assert.equal(full.osName, "Windows");
  assert.equal(full.deviceType, "desktop"); // inferred — UA has no device.type
  assert.equal(full.browserName, "Chrome");
  assert.equal(full.browser, "Chrome 120");
  assert.equal(full.cpuArchitecture, "amd64");
});

test("macOS Safari UA → desktop inferred, vendor=Apple", () => {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 " +
    "(KHTML, like Gecko) Version/17.4 Safari/605.1.15";
  const full = describeDeviceFull(reqWith(ua));
  // ua-parser-js v1.x returns "Mac OS" (not "macOS") — match library output
  // verbatim. The deviceType inference still treats it as desktop.
  assert.ok(full.osName === "Mac OS" || full.osName === "macOS");
  assert.equal(full.deviceType, "desktop");
  assert.equal(full.browserName, "Safari");
  assert.ok(full.browser.startsWith("Safari"));
});

test("Xiaomi Redmi Note Chrome → vendor + model captured", () => {
  const ua =
    "Mozilla/5.0 (Linux; Android 13; 23021RAA2Y) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36";
  const full = describeDeviceFull(reqWith(ua));
  assert.equal(full.deviceType, "mobile");
  assert.equal(full.osName, "Android");
  // Xiaomi model code — vendor may be Xiaomi or null depending on
  // ua-parser-js's regex db; just verify model code is preserved.
  assert.equal(full.deviceModel, "23021RAA2Y");
});

test("describeDeviceFull() never throws on garbage UA", () => {
  for (const ua of ["", "x", "🎉", "Mozilla/5.0", "abc; def; ghi"]) {
    assert.doesNotThrow(() => describeDeviceFull(reqWith(ua)));
  }
});

// ─── Lazy refresh path ─────────────────────────────────────────────────────
// `describeDeviceFromUserAgent(uaString)` is the entry point used by the
// admin /devices and /events handlers in routes/fraud.ts to re-parse
// user_devices.user_agent / login_events.user_agent rows on read. It must
// (a) accept a raw UA string (no Request shape), (b) be null-safe so
// "no UA captured" rows don't crash the response, and (c) return labels
// identical to the request-shaped helper for the same UA.

test("describeDeviceFromUserAgent() accepts a raw UA string (no Request shape)", () => {
  const ua = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36";
  const out = describeDeviceFromUserAgent(ua);
  assert.equal(out.deviceVendor, "Samsung");
  assert.equal(out.deviceModel, "SM-S918B");
  assert.ok(out.os.startsWith("Android"));
  assert.ok(out.browser.startsWith("Chrome"));
});

test("describeDeviceFromUserAgent() null/undefined → 'Unknown' fallbacks (does not throw)", () => {
  // Stored user_agent column is nullable — older login_events rows have null.
  // The lazy-refresh path passes the column straight through, so the helper
  // must accept null without crashing the API response.
  for (const ua of [null, undefined, ""]) {
    const out = describeDeviceFromUserAgent(ua);
    assert.equal(out.browser, "Unknown browser");
    assert.equal(out.os, "Unknown OS");
    assert.equal(out.deviceModel, null);
    assert.equal(out.deviceVendor, null);
  }
});

// ─── Placeholder model filter ──────────────────────────────────────────────
// ua-parser-js surfaces literal placeholder strings as `device.model` in
// two cases that show up constantly in real Qorix login data:
//   - "K"          → Chrome 110+ on Android with UA Reduction (~70% of mobile)
//   - "Macintosh"  → every Mac, since the UA never exposes the actual model
// Both are useless as device identifiers and were rendering as misleading
// `[Apple Macintosh]` / `[K]` badges in the admin Account Security drawer
// (user reported Apr 29). Filter to null at parse time so the badge
// disappears for these cases and the card relies on OS / browser labels.

test("describeDeviceFromUserAgent() suppresses 'K' Android UA-Reduction placeholder", () => {
  const ua = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36";
  const out = describeDeviceFromUserAgent(ua);
  assert.equal(out.deviceModel, null, "'K' is a UA-Reduction placeholder, not a device model");
  // The rest of the parse must still work — only the model is suppressed.
  assert.equal(out.osName, "Android");
  assert.equal(out.deviceType, "mobile");
  assert.ok(out.browser.startsWith("Chrome"));
});

test("describeDeviceFromUserAgent() suppresses generic 'Macintosh' model", () => {
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";
  const out = describeDeviceFromUserAgent(ua);
  assert.equal(out.deviceModel, null, "'Macintosh' is the platform name, not a hardware model");
  assert.equal(out.deviceVendor, "Apple");
  assert.equal(out.deviceType, "desktop");
});

// ─── Client Hints layered on top of the UA string ─────────────────────────
// `Sec-CH-UA-Model` is the whole reason UA-CH exists — modern Chrome on
// Android sends the real model ("Pixel 7", "SM-S918B") via this hint
// instead of via the UA string. `describeDeviceFull(req)` must read the
// hint and let it win over the UA-derived (placeholder) model.

test("describeDeviceFull() uses Sec-CH-UA-Model to override UA-Reduction placeholder", () => {
  const req = {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
      // RFC 8941 structured-headers — values come quoted on the wire.
      "sec-ch-ua-model": '"Pixel 7"',
      "sec-ch-ua-platform-version": '"14.4.1"',
      "sec-ch-ua-mobile": "?1",
    },
  } as unknown as Request;
  const out = describeDeviceFull(req);
  assert.equal(out.deviceModel, "Pixel 7", "hint must beat the 'K' placeholder");
  assert.equal(out.osVersion, "14.4.1", "hint must override coarse UA OS version");
  assert.equal(out.os, "Android 14.4.1", "OS label must rebuild with the precise version");
  assert.equal(out.deviceType, "mobile");
});

test("describeDeviceFull() handles Safari/iOS (no hints sent) without crashing", () => {
  // Safari does NOT support UA-CH — the headers will simply be absent.
  // Must fall back to UA-only parse cleanly.
  const req = {
    headers: {
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
    },
  } as unknown as Request;
  const out = describeDeviceFull(req);
  assert.equal(out.deviceVendor, "Apple");
  assert.equal(out.deviceType, "mobile");
  assert.equal(out.osName, "iOS");
  assert.ok(out.osVersion?.startsWith("17"));
});

test("describeDeviceFull() ignores empty-string hint values (Chrome cold-start case)", () => {
  // Before the page has earned the high-entropy hint promise, Chrome
  // sometimes sends `Sec-CH-UA-Model: ""` instead of omitting the header.
  // Empty-string must NOT clobber the UA-derived model with null.
  const req = {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
      "sec-ch-ua-model": '""',
    },
  } as unknown as Request;
  const out = describeDeviceFull(req);
  assert.equal(out.deviceModel, "SM-S918B", "empty hint must fall through to UA-derived model");
});

test("describeDeviceFromUserAgent() yields the same labels as describeDeviceFull(req) for identical UA", () => {
  // Locks in: re-parsing a stored UA on read produces exactly what the
  // initial parse on insert produced — no drift between the two paths.
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15";
  const fromUa = describeDeviceFromUserAgent(ua);
  const fromReq = describeDeviceFull(reqWith(ua));
  assert.equal(fromUa.browser, fromReq.browser);
  assert.equal(fromUa.os, fromReq.os);
  assert.equal(fromUa.deviceType, fromReq.deviceType);
  assert.equal(fromUa.deviceModel, fromReq.deviceModel);
  assert.equal(fromUa.deviceVendor, fromReq.deviceVendor);
  assert.equal(fromUa.osVersion, fromReq.osVersion);
  assert.equal(fromUa.browserVersion, fromReq.browserVersion);
});
