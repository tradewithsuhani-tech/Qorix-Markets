#!/usr/bin/env node
/**
 * Build-time per-route SEO prerender.
 *
 * The Qorix Markets web app is a Vite SPA served by nginx with a `try_files`
 * fallback to `/index.html`. That works for app routing, but Google's static
 * crawler reads the *unrendered* HTML — and the shipped `index.html` has a
 * single hardcoded `<title>`, `<meta description>`, `<link canonical href="/">`
 * and `og:url`. Result: every marketing/legal/blog URL is reported as a
 * duplicate of the homepage and Google refuses to index them
 * ("Crawled - currently not indexed", "Discovered - currently not indexed",
 * canonical mismatches in URL Inspection).
 *
 * This script post-processes the Vite build output. For every public route in
 * the sitemap it writes a per-route `<route>/index.html` with the correct
 * title, canonical, description, OG and Twitter tags. Nginx's `try_files
 * $uri $uri/ /index.html` then naturally serves the per-route file when the
 * crawler hits e.g. `/privacy` (matches `/privacy/index.html` via `$uri/`).
 *
 * The hydrated React app overwrites these tags client-side via `useSeo()` —
 * that path is unchanged. This script only fixes the *initial* HTML payload
 * that crawlers and link-preview bots see before JavaScript executes.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, "..", "dist", "public");
const SRC_INDEX = resolve(DIST, "index.html");
const BLOG_FILE = resolve(__dirname, "..", "src", "data", "blog-posts.ts");

const SITE_URL = "https://qorixmarkets.com";
const DEFAULT_OG = `${SITE_URL}/og-share-1200.png?v=1`;

/** Routes whose <title>/canonical/description live in the page's `useSeo()`
 * call or in `LegalLayout` props. Mirrors src/pages/{marketing,legal}/*.tsx. */
const STATIC_ROUTES = [
  // Marketing
  {
    path: "/ai-trading-platform",
    title:
      "Automated AI Trading Platform — Forex, Gold & Crypto | Qorix Markets",
    description:
      "Qorix Markets runs an automated AI trading platform across Forex, Gold, Indices and Crypto majors. Hard risk caps, transparent execution, instant USDT withdrawals. Start from $10.",
  },
  {
    path: "/zero-trading-fee",
    title: "Zero Trading Fees — Automated AI Trading | Qorix Markets",
    description:
      "Trade with 0% commission on Qorix Markets. No swap fees, no account fees, free USDT deposits. Automated AI trading for Forex, Gold and Crypto — start from $10.",
  },
  {
    path: "/low-investment-trading",
    title: "Low Investment Trading — Start From $10 | Qorix Markets",
    description:
      "Start automated AI trading with just $10 on Qorix Markets. Mobile-first, hard risk caps, auto-compounding. Same institutional execution at any portfolio size.",
  },
  {
    path: "/about",
    title: "About Qorix Markets — Our Mission and Team",
    description:
      "Qorix Markets is on a mission to make institutional-grade automated AI trading accessible to every investor. Hard risk caps, transparent execution, $10 minimum.",
  },
  {
    path: "/contact",
    title: "Contact Qorix Markets — Support, Sales & Partnerships",
    description:
      "Reach the Qorix Markets team for support, sales, partnerships or media. 24/7 customer support in English and Hindi. Email support@qorixmarkets.com.",
  },
  {
    path: "/blog",
    title: "Qorix Markets Blog — AI Trading Insights and Guides",
    description:
      "In-depth guides on AI trading, risk management, USDT investing, compounding and portfolio construction — written by the Qorix Markets research team.",
  },
  // Legal
  {
    path: "/legal/regulation",
    title: "Regulatory Disclosure & Company Information — Qorix Markets",
    description:
      "Qorix Markets regulatory disclosure, company information, AML/KYC compliance, sanctions screening and risk warning. Transparent operating model for investors.",
  },
  {
    path: "/legal/risk-disclosure",
    title: "Investment Protection & Risk Disclosure — Qorix Markets",
    description:
      "How Qorix Markets protects investor capital: drawdown caps, profit separation, liquidity guarantees, platform security and the investor commitment.",
  },
  {
    path: "/legal/aml-kyc",
    title: "AML / KYC Policy — Qorix Markets",
    description:
      "Qorix Markets Anti-Money Laundering and Know-Your-Customer policy: identity verification, transaction monitoring, sanctions compliance and record keeping.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy — Qorix Markets",
    description:
      "How Qorix Markets collects, uses, retains and protects personal data. Your rights as a user, security controls and our no-sale-of-data commitment.",
  },
  {
    path: "/terms",
    title: "Terms & Conditions — Qorix Markets",
    description:
      "Qorix Markets Terms and Conditions covering platform usage, investment disclaimers, withdrawal rules, capital protection, account suspension and governing law.",
  },
];

/** Parse `src/data/blog-posts.ts` and pull `slug`, `metaTitle`, `metaDescription`
 * for every BlogPost. The file is hand-authored TypeScript with predictable
 * formatting (one field per line, double-quoted strings, possible multi-line
 * descriptions on the line after `metaDescription:`). A regex-based pull is
 * sufficient and avoids adding a TS loader to the build chain. */
function parseBlogPosts() {
  const src = readFileSync(BLOG_FILE, "utf8");
  const slugRe = /slug:\s*"([^"]+)"/g;
  const titleRe = /metaTitle:\s*"([^"]+)"/g;
  // metaDescription may sit on the same line or on the next line (the codebase
  // uses both styles). Accept either: `metaDescription: "..."` or
  // `metaDescription:\n      "..."`.
  const descRe = /metaDescription:\s*(?:\n\s*)?"([^"]+)"/g;
  const slugs = [...src.matchAll(slugRe)].map((m) => m[1]);
  const titles = [...src.matchAll(titleRe)].map((m) => m[1]);
  const descs = [...src.matchAll(descRe)].map((m) => m[1]);
  if (slugs.length !== titles.length || titles.length !== descs.length) {
    throw new Error(
      `Blog parse mismatch: ${slugs.length} slugs / ${titles.length} titles / ${descs.length} descriptions. Check src/data/blog-posts.ts formatting.`,
    );
  }
  return slugs.map((slug, i) => ({
    path: `/blog/${slug}`,
    title: titles[i],
    description: descs[i],
  }));
}

/** Escape a string for safe insertion inside an HTML attribute value. The
 * blog meta strings can contain quotes, ampersands, and em-dashes. */
function escAttr(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Replace a single tag in the HTML by attribute-key match. Falls back to
 * appending into <head> if not found (defensive — every tag we need exists in
 * the shipped index.html, but layout drift shouldn't silently no-op). */
function replaceTag(html, regex, replacement) {
  if (regex.test(html)) return html.replace(regex, replacement);
  return html.replace("</head>", `    ${replacement}\n  </head>`);
}

function buildHtmlForRoute(srcHtml, route) {
  const url = `${SITE_URL}${route.path}`;
  const title = escAttr(route.title);
  const desc = escAttr(route.description);
  let out = srcHtml;

  // <title>
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);

  // <meta name="description">
  out = replaceTag(
    out,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${desc}" />`,
  );

  // <link rel="canonical">
  out = replaceTag(
    out,
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${url}" />`,
  );

  // Open Graph
  out = replaceTag(
    out,
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${url}" />`,
  );
  out = replaceTag(
    out,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${title}" />`,
  );
  out = replaceTag(
    out,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${desc}" />`,
  );

  // Twitter
  out = replaceTag(
    out,
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${title}" />`,
  );
  out = replaceTag(
    out,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${desc}" />`,
  );

  return out;
}

function writeRoute(route, html) {
  // Always write to `<route>/index.html` so nginx's `$uri/` lookup hits it.
  const dir = resolve(DIST, route.path.replace(/^\//, ""));
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, "index.html"), html, "utf8");
}

function main() {
  const srcHtml = readFileSync(SRC_INDEX, "utf8");
  const routes = [...STATIC_ROUTES, ...parseBlogPosts()];
  for (const route of routes) {
    const html = buildHtmlForRoute(srcHtml, route);
    writeRoute(route, html);
  }
  console.log(
    `[prerender-seo] wrote ${routes.length} per-route index.html files into dist/public/`,
  );
}

main();
