import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { useSeo, SITE_URL } from "@/lib/seo";
import { getPostBySlug, BLOG_POSTS, type BlogPost } from "@/data/blog-posts";
import { ArrowRight, Calendar, Clock, ChevronLeft, User, ListOrdered } from "lucide-react";
import { trackCta } from "@/lib/analytics";
import { withRef } from "@/lib/referral";
import aiTradingHero from "@/assets/blog/ai-trading-hero.png";
import forexVsCrypto from "@/assets/blog/forex-vs-crypto.png";
import zeroFeeTrading from "@/assets/blog/zero-fee-trading.png";

const POST_IMAGES: Record<string, string> = {
  "how-ai-trading-works": aiTradingHero,
  "forex-vs-crypto-which-is-better": forexVsCrypto,
  "zero-fee-trading-explained": zeroFeeTrading,
};

export default function BlogPostPage() {
  const [, params] = useRoute<{ slug: string }>("/blog/:slug");
  const slug = params?.slug ?? "";
  const post = getPostBySlug(slug);

  useSeo({
    title: post?.metaTitle ?? "Article not found",
    description: post?.metaDescription ?? "Article not found on Qorix Markets blog.",
    canonical: `/blog/${slug}`,
    type: "article",
    keywords: post?.keywords,
    image: post?.featuredImage ? `${SITE_URL}${post.featuredImage}` : undefined,
    noindex: !post,
    jsonLd: post
      ? {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.metaDescription,
          datePublished: post.publishedAt,
          author: { "@type": "Person", name: post.author },
          publisher: {
            "@type": "Organization",
            name: "Qorix Markets",
            logo: { "@type": "ImageObject", url: `${SITE_URL}/qorix-logo.png` },
          },
          mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${post.slug}` },
          image: `${SITE_URL}${post.featuredImage}`,
        }
      : undefined,
  });

  // Auto-generate the table of contents from H2 sections in the post body.
  const toc = useMemo(() => {
    if (!post) return [] as { id: string; text: string }[];
    return post.body
      .filter((b) => b.type === "h2" && b.text)
      .map((b) => ({ id: slugify(b.text!), text: b.text! }));
  }, [post]);

  // Pre-compute keyword regex for inline highlighting in body paragraphs.
  const highlightRe = useMemo(() => {
    if (!post?.keywords) return null;
    const terms = post.keywords
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length >= 4)
      .map(escapeRegex);
    if (!terms.length) return null;
    return new RegExp(`\\b(${terms.join("|")})\\b`, "gi");
  }, [post]);

  if (!post) {
    return (
      <MarketingShell>
        <div className="max-w-2xl mx-auto px-4 py-24 text-center">
          <h1 className="text-3xl font-black text-white mb-3">Article not found</h1>
          <p className="text-slate-400 mb-6">The article you are looking for does not exist or has been moved.</p>
          <Link href="/blog" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold text-white" style={{ background: "linear-gradient(90deg,#10b981,#22c55e)" }}>
            Back to blog
          </Link>
        </div>
      </MarketingShell>
    );
  }

  const related = post.relatedSlugs
    .map((s) => BLOG_POSTS.find((p) => p.slug === s))
    .filter(Boolean) as BlogPost[];

  return (
    <MarketingShell>
      <article className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-14 grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-10">
        <div className="min-w-0">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6">
            <ChevronLeft size={14} /> All articles
          </Link>

          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-3">{post.category}</div>
          <h1 className="text-3xl md:text-5xl font-black text-white leading-[1.1] mb-5">{post.title}</h1>
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-8 flex-wrap">
            <span className="inline-flex items-center gap-1"><User size={12} /> {post.author}</span>
            <span className="inline-flex items-center gap-1"><Calendar size={12} /> {formatDate(post.publishedAt)}</span>
            <span className="inline-flex items-center gap-1"><Clock size={12} /> {post.readMinutes} min read</span>
          </div>

          <div className="relative aspect-video rounded-2xl mb-8 overflow-hidden" style={{ border: "1px solid rgba(16,185,129,0.18)" }}>
            <img
              src={POST_IMAGES[post.slug] ?? post.featuredImage}
              alt={post.featuredImageAlt}
              loading="eager"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(135deg, rgba(5,15,12,0.10), rgba(5,15,12,0.45))" }}
            />
          </div>

          {/* Inline TOC for mobile (sidebar handles desktop) */}
          {toc.length > 0 && (
            <details className="lg:hidden mb-6 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <summary className="cursor-pointer text-sm font-bold text-white inline-flex items-center gap-2">
                <ListOrdered size={14} className="text-emerald-300" /> Table of contents
              </summary>
              <ul className="mt-3 space-y-1.5 text-sm">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="text-slate-400 hover:text-emerald-300">{t.text}</a>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="space-y-5 text-slate-300 leading-relaxed">
            {post.body.map((b, i) => {
              if (b.type === "h2") return <h2 key={i} id={slugify(b.text!)} className="text-2xl md:text-3xl font-black text-white mt-8 mb-2 scroll-mt-24">{b.text}</h2>;
              if (b.type === "h3") return <h3 key={i} className="text-xl font-bold text-white mt-6 mb-1">{b.text}</h3>;
              if (b.type === "p") return <p key={i}>{highlight(b.text ?? "", highlightRe)}</p>;
              if (b.type === "ul") return (
                <ul key={i} className="list-disc pl-6 space-y-1.5">
                  {(b.items ?? []).map((it, j) => <li key={j}>{highlight(it, highlightRe)}</li>)}
                </ul>
              );
              if (b.type === "quote") return (
                <blockquote key={i} className="border-l-2 pl-4 text-slate-400 italic" style={{ borderColor: "rgba(16,185,129,0.6)" }}>
                  {b.text}
                </blockquote>
              );
              if (b.type === "cta") return (
                <Link
                  key={i}
                  href={withRef(b.href ?? "/signup")}
                  onClick={() => trackCta(b.text ?? "Blog CTA", `blog:${post.slug}`)}
                  className="not-prose inline-flex items-center gap-1.5 px-5 py-2.5 my-3 rounded-xl text-sm font-bold text-white shadow-lg"
                  style={{ background: "linear-gradient(90deg,#10b981,#22c55e)" }}
                >
                  {b.text} <ArrowRight size={14} />
                </Link>
              );
              return null;
            })}
          </div>

          {related.length > 0 && (
            <section className="mt-14 pt-10 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <h2 className="text-xl font-bold text-white mb-5">Related reading</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}`}
                    className="block rounded-2xl p-4 hover:border-emerald-400/30 transition-colors"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-1.5">{r.category}</div>
                    <h3 className="text-sm font-bold text-white leading-snug">{r.title}</h3>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sticky desktop TOC sidebar */}
        {toc.length > 0 && (
          <aside className="hidden lg:block">
            <div className="sticky top-20 rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold text-slate-400 mb-3">
                <ListOrdered size={12} className="text-emerald-300" /> On this page
              </div>
              <ul className="space-y-2 text-sm">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="text-slate-400 hover:text-emerald-300 leading-snug block">
                      {t.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </article>
    </MarketingShell>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text: string, re: RegExp | null) {
  if (!re) return text;
  const parts = text.split(re);
  return parts.map((p, i) => {
    if (i % 2 === 1) {
      return (
        <mark
          key={i}
          className="px-1 rounded"
          style={{ background: "rgba(16,185,129,0.18)", color: "#a7f3d0" }}
        >
          {p}
        </mark>
      );
    }
    return <span key={i}>{p}</span>;
  });
}
