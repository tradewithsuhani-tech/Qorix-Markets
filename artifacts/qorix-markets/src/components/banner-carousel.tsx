import { useEffect, useRef, useState } from "react";

export interface BannerSlide {
  src: string;
  alt: string;
  onClick?: () => void;
}

interface BannerCarouselProps {
  slides: BannerSlide[];
  intervalMs?: number;
  /** Source image aspect ratio (width / height). Defaults to 16/9. */
  aspectRatio?: number;
  /** Optional max width cap (px). */
  maxWidth?: number;
}

export function BannerCarousel({ slides, intervalMs = 4500, aspectRatio = 1672 / 941, maxWidth }: BannerCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [paused, slides.length, intervalMs]);

  const goTo = (i: number) => setIndex(((i % slides.length) + slides.length) % slides.length);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    setPaused(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };
  const onTouchEnd = () => {
    const d = touchDeltaX.current;
    if (Math.abs(d) > 40) {
      goTo(index + (d < 0 ? 1 : -1));
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
    setTimeout(() => setPaused(false), 600);
  };

  if (slides.length === 0) return null;

  return (
    <div
      className="relative w-full mx-auto select-none"
      style={{ maxWidth: maxWidth ? `${maxWidth}px` : undefined }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="relative w-full overflow-hidden rounded-2xl bg-black"
        style={{
          aspectRatio: `${aspectRatio}`,
          boxShadow: "0 12px 40px rgba(56,189,248,0.12), 0 0 0 1px rgba(56,189,248,0.16)",
        }}
      >
        <div
          className="absolute inset-0 flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${index * 100}%)`, willChange: "transform" }}
        >
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={s.onClick}
              className="shrink-0 w-full h-full block p-0 border-0 bg-transparent cursor-pointer"
              aria-label={s.alt}
              tabIndex={i === index ? 0 : -1}
            >
              <img
                src={s.src}
                alt={s.alt}
                className="w-full h-full block"
                style={{ objectFit: "contain", objectPosition: "center", background: "#000" }}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? 22 : 6,
                background: i === index ? "rgba(56,189,248,0.85)" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
