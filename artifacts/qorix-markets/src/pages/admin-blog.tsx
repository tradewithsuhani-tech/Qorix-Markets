import { useState, useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, Search, Calendar, Clock, ExternalLink, Info, Tag } from "lucide-react";
import { BLOG_POSTS } from "@/data/blog-posts";

/**
 * Lightweight admin view of the blog catalogue. The blog content is
 * currently shipped as a typed source file (`src/data/blog-posts.ts`),
 * which keeps the live trading database free of CMS schema and avoids
 * the platform-wide ban on db:push migrations.
 *
 * This page lets the operator audit the published catalogue, jump to
 * each live URL, and copy the slugs needed to extend it via PR.
 */
export default function AdminBlogPage() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return BLOG_POSTS;
    return BLOG_POSTS.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        p.slug.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        p.keywords.toLowerCase().includes(needle),
    );
  }, [q]);

  return (
    <div className="min-h-screen" style={{ background: "#050814", color: "#e2e8f0" }}>
      <header className="sticky top-0 z-30 border-b backdrop-blur-md" style={{ background: "rgba(5,8,20,0.85)", borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-3">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
            <ArrowLeft size={14} /> Admin
          </Link>
          <h1 className="text-sm font-bold text-white">Blog catalogue</h1>
          <div className="text-xs text-slate-500">{BLOG_POSTS.length} posts</div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
        <div
          className="rounded-2xl p-4 md:p-5 flex items-start gap-3"
          style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.20)" }}
        >
          <Info size={16} className="text-blue-300 mt-0.5 shrink-0" />
          <div className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Posts are stored in <code className="px-1.5 py-0.5 rounded bg-black/40 text-emerald-300">src/data/blog-posts.ts</code>{" "}
            and shipped at build time. To add or edit a post, update that file
            and redeploy. A database-backed CMS can be enabled later by adding
            a <code className="px-1.5 py-0.5 rounded bg-black/40 text-emerald-300">blog_posts</code> table — currently held back
            by the platform-wide <strong>zero schema-change</strong> rule for
            the live trading database.
          </div>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, slug, category, or keyword..."
            className="w-full rounded-xl bg-black/30 border border-white/10 pl-10 pr-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p) => (
            <div
              key={p.slug}
              className="rounded-2xl p-5 flex flex-col"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">{p.category}</span>
                <a
                  href={`/blog/${p.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-emerald-300 inline-flex items-center gap-1 text-[11px]"
                >
                  Open <ExternalLink size={11} />
                </a>
              </div>
              <h2 className="text-base font-bold text-white leading-snug mb-2">{p.title}</h2>
              <p className="text-xs text-slate-400 line-clamp-2 mb-3">{p.excerpt}</p>
              <div className="mt-auto flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                <span className="inline-flex items-center gap-1"><Calendar size={11} /> {p.publishedAt}</span>
                <span className="inline-flex items-center gap-1"><Clock size={11} /> {p.readMinutes} min</span>
                <span className="inline-flex items-center gap-1 truncate"><Tag size={11} /> {p.slug}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="md:col-span-2 text-center py-10 text-sm text-slate-500">
              No posts match that search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
