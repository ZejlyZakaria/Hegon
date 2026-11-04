"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** One initial reveal per section. Hidden responsive trees and off-rail images never block it. */
export function SectionImageReveal({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"pending" | "instant" | "ready">("pending");

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    let disposed = false;
    let started = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanups: (() => void)[] = [];
    const finish = (instant: boolean) => {
      if (!disposed) setPhase(instant ? "instant" : "ready");
      if (timer) clearTimeout(timer);
    };
    const prepare = () => {
      const bounds = node.getBoundingClientRect();
      if (bounds.top > window.innerHeight + 200 || bounds.bottom < -200) return;
      const images = [...node.querySelectorAll<HTMLImageElement>("img")].filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.right > bounds.left && rect.left < bounds.right;
      });
      // Also warm the next horizontal viewport. No detached duplicate requests/srcset guessing.
      node.querySelectorAll<HTMLImageElement>("img").forEach(img => {
        const rect = img.getBoundingClientRect();
        if (rect.width && rect.height && rect.right > bounds.left && rect.left < bounds.right + bounds.width) img.loading = "eager";
      });
      if (started) return;
      started = true;
      const cached = images.every(img => img.complete);
      timer = setTimeout(() => finish(false), 2500);
      void Promise.all(images.map(img => new Promise<void>(resolve => {
        const done = () => {
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          // Decode the selected native picture candidate, never a second URL.
          void img.decode().catch(() => {}).then(resolve);
        };
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        cleanups.push(() => { img.removeEventListener("load", done); img.removeEventListener("error", done); });
        if (img.complete) done();
      }))).then(() => finish(cached));
    };
    const visible = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) prepare();
    }, { rootMargin: "200px 0px" });
    visible.observe(node);
    const bounds = node.getBoundingClientRect();
    if (bounds.top < window.innerHeight + 200 && bounds.bottom > -200) prepare();
    // Resizing/paging only preloads ahead; it never hides an already revealed section.
    node.addEventListener("scroll", prepare, true);
    window.addEventListener("resize", prepare);
    return () => {
      disposed = true;
      visible.disconnect();
      if (timer) clearTimeout(timer);
      cleanups.forEach(cleanup => cleanup());
      node.removeEventListener("scroll", prepare, true);
      window.removeEventListener("resize", prepare);
    };
  }, []);

  const pending = phase === "pending";
  return <div ref={root} className="relative" data-image-reveal={phase} aria-busy={pending}>
    <div inert={pending} aria-hidden={pending || undefined} className={phase === "ready" ? "transition-opacity duration-150 motion-reduce:transition-none" : undefined} style={{ opacity: pending ? 0 : 1 }}>{children}</div>
    {pending && <div aria-hidden="true" className="pointer-events-none absolute inset-0">{fallback}</div>}
  </div>;
}
