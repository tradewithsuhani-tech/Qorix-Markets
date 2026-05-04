import { useRoute, Link } from "wouter";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { useSeo, SITE_URL } from "@/lib/seo";
import { getPostBySlug, BLOG_POSTS, type BlogPost } from "@/data/blog-posts";
import { ArrowRight, Calendar, Clock, ChevronLeft, User } from "lucide-react";

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
      <article className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-6">
          <ChevronLeft size={14} /> All articles
        </Link>

        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 mb-3">{post.category}</div>
        <h1 className="text-3xl md:text-5xl font-black text-white leading-[1.1] mb-5">{post.title}</h1>
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-8">
          <span className="inline-flex items-center gap-1"><User size={12} /> {post.author}</span>
          <span className="inline-flex items-center gap-1"><Calendar size={12} /> {formatDate(post.publishedAt)}</span>
          <span className="inline-flex items-center gap-1"><Clock size={12} /> {post.readMinutes} min read</span>
        </div>

        <div
          className="aspect-video rounded-2xl mb-8"
          style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.20), rgba(59,130,246,0.18))" }}
          role="img"
          aria-label={post.featuredImageAlt}
        />

        <div className="space-y-5 text-slate-300 leading-relaxed">
          {post.body.map((b, i) => {
            if (b.type === "h2") return <h2 key={i} className="text-2xl md:text-3xl font-black text-white mt-8 mb-2">{b.text}</h2>;
            if (b.type === "h3") return <h3 key={i} className="text-xl font-bold text-white mt-6 mb-1">{b.text}</h3>;
            if (b.type === "p") return <p key={i}>{b.text}</p>;
            if (b.type === "ul") return (
              <ul key={i} className="list-disc pl-6 space-y-1.5">
                {(b.items ?? []).map((it, j) => <li key={j}>{it}</li>)}
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
                href={b.href ?? "/signup"}
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
      </article>
    </MarketingShell>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
