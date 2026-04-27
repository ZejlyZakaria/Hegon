"use client";

import { useEffect } from "react";
import { useCommandCenter } from "../store";
import { CommandCenter } from "./CommandCenter";

export function CommandCenterProvider() {
  const toggle = useCommandCenter((s) => s.toggle);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggle]);

  return <CommandCenter />;
}
