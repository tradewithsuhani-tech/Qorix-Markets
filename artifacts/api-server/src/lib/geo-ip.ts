import { logger } from "./logger.js";

/**
 * Lightweight IP → city/country lookup using the free ip-api.com endpoint.
 * No API key required, 45 req/min limit. Results are cached in-memory for
 * 1 hour to avoid burning quota on repeat lookups (e.g. same user on the
 * same IP across multiple logins).
 *
 * All errors are swallowed and {city: null, country: null} is returned —
 * geolocation is a "nice to have", never a blocker.
 */

interface GeoResult {
  city: string | null;
  country: string | null;
}

/**
 * Extended result used by the admin Fraud Monitor — includes proxy / VPN
 * / hosting (datacenter) flags + ISP / ASN. Only fetched lazily when an
 * admin is reviewing a user, never on the hot login path.
 */
export interface GeoFullResult extends GeoResult {
  region: string | null;
  isp: string | null;
  org: string | null;
  asn: string | null;
  isProxy: boolean;
  isHosting: boolean;
  isMobile: boolean;
  /** Convenience: true if proxy OR hosting (i.e. likely VPN, Tor exit, or datacenter/bot). */
  suspicious: boolean;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, { value: GeoResult; expiresAt: number }>();
const fullCache = new Map<string, { value: GeoFullResult; expiresAt: number }>();

const PRIVATE_IP_PATTERNS = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^127\./,
  /^::1$/,
  /^fc/i,
  /^fd/i,
  /^localhost$/i,
];

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  return PRIVATE_IP_PATTERNS.some((re) => re.test(ip));
}

export async function lookupGeo(ipAddress: string | null | undefined): Promise<GeoResult> {
  const empty: GeoResult = { city: null, country: null };
  if (!ipAddress) return empty;

  // Strip IPv6 prefix sometimes seen in Express req.ip ("::ffff:1.2.3.4").
  const ip = ipAddress.replace(/^::ffff:/, "");
  if (isPrivateIp(ip)) return empty;

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return empty;
    const data = (await res.json()) as { status?: string; city?: string; country?: string };
    if (data.status !== "success") {
      cache.set(ip, { value: empty, expiresAt: Date.now() + CACHE_TTL_MS });
      return empty;
    }
    const value: GeoResult = {
      city: typeof data.city === "string" && data.city ? data.city : null,
      country: typeof data.country === "string" && data.country ? data.country : null,
    };
    cache.set(ip, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (err: any) {
    // Network error / timeout / DNS — never let geolocation kill a login.
    logger.debug({ ip, err: err?.message }, "[geo-ip] lookup failed (silent)");
    return empty;
  }
}

/**
 * Extended IP intelligence — proxy / VPN / hosting (datacenter / bot) /
 * ISP / ASN. Used by the admin Fraud Monitor only. Free tier of ip-api.com
 * supports these fields with no API key (45 req/min). Cached separately
 * from the lightweight `lookupGeo` cache to avoid evicting hot login-path
 * entries with infrequent admin lookups.
 *
 * Returns `suspicious: true` when the IP is flagged as proxy/VPN OR
 * hosting/datacenter — the typical pattern for VPN users, Tor exits, or
 * scripted/API-driven access from a cloud provider.
 */
export async function lookupGeoFull(
  ipAddress: string | null | undefined,
): Promise<GeoFullResult> {
  const empty: GeoFullResult = {
    city: null,
    country: null,
    region: null,
    isp: null,
    org: null,
    asn: null,
    isProxy: false,
    isHosting: false,
    isMobile: false,
    suspicious: false,
  };
  if (!ipAddress) return empty;

  const ip = ipAddress.replace(/^::ffff:/, "");
  if (isPrivateIp(ip)) return empty;

  const cached = fullCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country,regionName,isp,org,as,proxy,hosting,mobile`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return empty;
    const data = (await res.json()) as {
      status?: string;
      city?: string;
      country?: string;
      regionName?: string;
      isp?: string;
      org?: string;
      as?: string;
      proxy?: boolean;
      hosting?: boolean;
      mobile?: boolean;
    };
    if (data.status !== "success") {
      fullCache.set(ip, { value: empty, expiresAt: Date.now() + CACHE_TTL_MS });
      return empty;
    }
    const isProxy = data.proxy === true;
    const isHosting = data.hosting === true;
    const value: GeoFullResult = {
      city: typeof data.city === "string" && data.city ? data.city : null,
      country: typeof data.country === "string" && data.country ? data.country : null,
      region: typeof data.regionName === "string" && data.regionName ? data.regionName : null,
      isp: typeof data.isp === "string" && data.isp ? data.isp : null,
      org: typeof data.org === "string" && data.org ? data.org : null,
      asn: typeof data.as === "string" && data.as ? data.as : null,
      isProxy,
      isHosting,
      isMobile: data.mobile === true,
      suspicious: isProxy || isHosting,
    };
    fullCache.set(ip, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch (err: any) {
    logger.debug({ ip, err: err?.message }, "[geo-ip] full lookup failed (silent)");
    return empty;
  }
}
