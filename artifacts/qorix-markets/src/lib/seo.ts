import { useEffect } from "react";

export interface SeoProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: object;
  keywords?: string;
}

export const SITE_URL = "https://qorixmarkets.com";
const DEFAULT_OG = `${SITE_URL}/og-share-1200.png`;

function upsertMeta(name: string, content: string, attr: "name" | "property" = "name") {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  if (!href) return;
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * Lightweight SEO helper for our Vite SPA. Updates document.title, meta
 * description, canonical, Open Graph, Twitter card, and optional JSON-LD.
 * Search bots that execute JavaScript (Googlebot, Bingbot) read the
 * resulting DOM. Pre-rendering can be added later via vite-plugin-ssr or
 * a static export without changing call sites.
 */
export function useSeo({
  title,
  description,
  canonical,
  image,
  type = "website",
  noindex,
  jsonLd,
  keywords,
}: SeoProps) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : "";
  useEffect(() => {
    const fullTitle = title.toLowerCase().includes("qorix")
      ? title
      : `${title} | Qorix Markets`;
    document.title = fullTitle;

    upsertMeta("description", description);
    upsertMeta("robots", noindex ? "noindex,nofollow" : "index,follow");
    if (keywords) upsertMeta("keywords", keywords);

    const path = canonical
      ? canonical.startsWith("http")
        ? canonical
        : `${SITE_URL}${canonical}`
      : typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : SITE_URL;
    upsertLink("canonical", path);

    const ogImage = image || DEFAULT_OG;
    upsertMeta("og:title", fullTitle, "property");
    upsertMeta("og:description", description, "property");
    upsertMeta("og:type", type, "property");
    upsertMeta("og:url", path, "property");
    upsertMeta("og:image", ogImage, "property");
    upsertMeta("og:site_name", "Qorix Markets", "property");

    upsertMeta("twitter:card", "summary_large_image");
    upsertMeta("twitter:title", fullTitle);
    upsertMeta("twitter:description", description);
    upsertMeta("twitter:image", ogImage);

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset["seo"] = "1";
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };
  }, [title, description, canonical, image, type, noindex, keywords, jsonLdKey]);
}

export const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Qorix Markets",
  url: SITE_URL,
  logo: `${SITE_URL}/qorix-logo.png`,
  sameAs: [
    "https://twitter.com/qorixmarkets",
    "https://t.me/qorixmarkets",
  ],
  description:
    "Qorix Markets is a professionally managed AI-driven USDT trading platform with zero commissions and entry from just $10.",
};
