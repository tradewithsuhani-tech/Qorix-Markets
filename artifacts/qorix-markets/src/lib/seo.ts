import { useEffect } from "react";

export interface SeoProps {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: object | object[];
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
 * description, canonical, Open Graph, Twitter card, and one or many
 * JSON-LD blocks. Pass an array to `jsonLd` to emit multiple schema
 * documents on a single page (e.g. Organization + FAQPage + BlogPosting).
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

    const blocks = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
    const scripts: HTMLScriptElement[] = [];
    blocks.forEach((b) => {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.dataset["seo"] = "1";
      s.text = JSON.stringify(b);
      document.head.appendChild(s);
      scripts.push(s);
    });
    return () => {
      scripts.forEach((s) => s.parentNode && s.parentNode.removeChild(s));
    };
  }, [title, description, canonical, image, type, noindex, keywords, jsonLdKey]);
}

export const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Qorix Markets",
  alternateName: ["QorixMarkets", "Qorix"],
  url: SITE_URL,
  logo: `${SITE_URL}/qorix-logo.png`,
  image: `${SITE_URL}/og-share-1200.png`,
  slogan: "Smarter Trading. Better Living.",
  foundingDate: "2024",
  sameAs: [
    "https://twitter.com/qorixmarkets",
    "https://t.me/qorixmarkets",
  ],
  description:
    "Qorix Markets is an automated AI trading platform for Forex, Gold, Indices and Crypto majors. Hard risk caps, transparent execution and instant USDT withdrawals — start from $10.",
  contactPoint: [{
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@qorixmarkets.com",
    availableLanguage: ["English", "Hindi"],
  }],
};

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Qorix Markets",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/blog?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

export function reviewJsonLd(items: { name: string; rating: number; quote: string }[]) {
  const avg =
    items.reduce((s, r) => s + r.rating, 0) / Math.max(items.length, 1);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Qorix Markets AI Trading Platform",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: avg.toFixed(1),
      reviewCount: items.length,
      bestRating: 5,
      worstRating: 1,
    },
    review: items.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.name },
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
      },
      reviewBody: r.quote,
    })),
  };
}
