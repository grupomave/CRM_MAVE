"use client";

import { useSyncExternalStore } from "react";

// Media query reativa. No servidor (e na hidratação) assume `serverDefault`.
export function useMediaQuery(query: string, serverDefault = true) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverDefault,
  );
}
