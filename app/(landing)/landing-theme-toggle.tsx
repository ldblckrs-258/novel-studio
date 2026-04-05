"use client";

import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

function getSnapshot() {
  const stored = localStorage.getItem("theme");
  return (
    stored === "dark" ||
    (!stored && matchMedia("(prefers-color-scheme:dark)").matches)
  );
}

function subscribe(cb: () => void) {
  // Re-check when storage changes (cross-tab) or color scheme changes
  window.addEventListener("storage", cb);
  const mql = matchMedia("(prefers-color-scheme:dark)");
  mql.addEventListener("change", cb);
  return () => {
    window.removeEventListener("storage", cb);
    mql.removeEventListener("change", cb);
  };
}

export function LandingThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      title="Chế độ sáng/tối"
      aria-label={dark ? "Bật chế độ sáng" : "Bật chế độ tối"}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
