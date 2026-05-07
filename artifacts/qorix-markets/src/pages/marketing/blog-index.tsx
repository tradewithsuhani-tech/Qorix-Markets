import { MarketingShell, MarketingHero } from "@/components/marketing/marketing-shell";
import { useSeo, SITE_URL } from "@/lib/seo";
import { BLOG_POSTS } from "@/data/blog-posts";
import { Link } from "wouter";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import aiTradingHero from "@/assets/blog/ai-trading-hero.png";

export default function BlogIndexPage() {
  useSeo({
    title: "Qorix Markets Blog — AI Trading Insights and Guides",
    description:
      "Guides, market analysis, and platform updates from the Qorix Markets team. Learn AI trading, risk management, and how to grow capital safely.",
    canonical: "/blog",
    keywords: "qorix markets blog, ai trading blog, trading insights, trading guides",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Qorix Markets Blog",
      url: `${SITE_URL}/blog`,
      blogPost: BLOG_POSTS.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        url: `${SITE_URL}/blog/${p.slug}`,
        datePublished: p.publishedAt,
        author: { "@type": "Person", name: p.author },
      })),
    },
  });

  const [featured, ...rest] = BLOG_POSTS;

  return (
    <MarketingShell>
      <MarketingHero
        badge="Blog"
        title={<>Insights from the <span className="text-emerald-300">Qorix desk</span></>}
        subtitle="Guides, market analysis, and platform updates. Written for investors, by traders."
      />

      <section className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {featured && (
          <Link
            href={`/blog/${featured.slug}`}
            className="block group rounded-3xl overflow-hidden mb-10 transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="grid md:grid-cols-2">
              <div className="relative aspect-video md:aspect-auto md:min-h-[360px] overflow-hidden">
                <img
                  src={featured.slug === "how-ai-trading-works" ? aiTradingHero : featured.featuredImage}
                  alt={featured.featuredImageAlt}
                  loading="eager"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(135deg, rgba(5,15,12,0.20), rgba(5,15,12,0.55))" }}
                />
              </div>
              <div className="p-6 md:p-8 flex flex-col justify-center">
                <span className="inline-flex w-fit items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4"
                  style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.30)", color: "#6ee7b7" }}>
                  Featured · {featured.category}
                </span>
                <h2 className="text-2xl md:text-3xl font-black text-white leading-tight group-hover:text-emerald-200 transition-colors">
                  {featured.title}
                </h2>
                <p className="mt-3 text-slate-400 leading-relaxed">{featured.excerpt}</p>
                <div className="mt-5 flex items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Calendar size={12} /> {formatDate(featured.publishedAt)}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {featured.readMinutes} min read</span>
                </div>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300 group-hover:gap-2 transition-all">
                  Read article <ArrowRight size={14} />
                </span>
              </div>
            </div>
          </Link>
        )}

        <h2 className="text-xl md:text-2xl font-bold text-white mb-5">Latest articles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rest.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group rounded-2xl overflow-hidden block transition-all"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div
                className="aspect-video"
                style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(34,197,94,0.14))" }}
                role="img"
                aria-label={p.featuredImageAlt}
              />
              <div className="p-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-2">{p.category}</div>
                <h3 className="text-base font-bold text-white leading-tight group-hover:text-emerald-200 transition-colors">
                  {p.title}
                </h3>
                <p className="mt-2 text-xs text-slate-400 line-clamp-2">{p.excerpt}</p>
                <div className="mt-4 flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><Calendar size={11} /> {formatDate(p.publishedAt)}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={11} /> {p.readMinutes} min</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
