"use client";

import { useEffect, useState } from "react";

// True after the first client paint. Defers via rAF so it never calls setState
// synchronously inside an effect (project lint rule), and gives SSR/first-render
// a stable `false` to avoid hydration mismatches on client-only data.
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return mounted;
}
