"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { railGeometry } from "../lib/rail-navigation";

/** Card-aligned navigation shared by season posters and curated episode stills. */
export function useAlignedRail<T extends HTMLElement = HTMLDivElement>(count: number) {
  const ref = useRef<T>(null);
  const pending = useRef<number | null>(null);
  const geometry = useRef({ targets: [0], page: 1 });
  const [navigation, setNavigation] = useState({ canPrev: false, canNext: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setNavigation({canPrev: el.scrollLeft > 1, canNext: el.scrollLeft < (geometry.current.targets.at(-1) ?? 0) - 1});
    const measure = () => {
      const cards = Array.from(el.children) as HTMLElement[];
      if (!cards.length) return;
      const origin = cards[0].offsetLeft;
      geometry.current = railGeometry(cards.map(c => c.offsetLeft - origin), cards[0].offsetWidth, el.clientWidth, parseFloat(getComputedStyle(el).paddingLeft) || 0);
      pending.current = null;
      const nearest = geometry.current.targets.reduce((best, n) => Math.abs(n-el.scrollLeft) < Math.abs(best-el.scrollLeft) ? n : best, 0);
      el.scrollTo({left: nearest, behavior: "instant"});
      update();
    };
    const release = () => { pending.current = null; };
    const onScroll = () => { if (pending.current != null && Math.abs(el.scrollLeft-pending.current)<1) release(); update(); };
    const observer = new ResizeObserver(measure); observer.observe(el); measure();
    el.addEventListener("scroll", onScroll, {passive:true});
    el.addEventListener("pointerdown", release); el.addEventListener("wheel", release, {passive:true});
    return () => { observer.disconnect(); el.removeEventListener("scroll",onScroll);el.removeEventListener("pointerdown",release);el.removeEventListener("wheel",release); };
  }, [count]);
  const scroll = useCallback((direction: number) => {
    const el = ref.current;
    if (!el) return;
    const { targets, page } = geometry.current;
    const from = pending.current ?? el.scrollLeft;
    const index = targets.reduce((best,n,i) => Math.abs(n-from)<Math.abs(targets[best]-from) ? i : best,0);
    const target = targets[Math.max(0, Math.min(targets.length-1, index+direction*page))] ?? 0;
    pending.current = target;
    el.scrollTo({left:target,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  }, []);
  return { ref, scroll, ...navigation };
}
