"use client";

import { useSyncExternalStore } from "react";

type Mode = "light" | "dark" | "system";

function read(): Mode {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function apply(mode: Mode) {
  const root = document.documentElement;
  try {
    if (mode === "system") {
      delete root.dataset.theme;
      localStorage.removeItem("rb-theme");
    } else {
      root.dataset.theme = mode;
      localStorage.setItem("rb-theme", mode);
    }
  } catch {
    if (mode !== "system") root.dataset.theme = mode;
  }
  listeners.forEach((l) => l());
}

/** Light is the default (PDFs are paper); dark follows the OS unless chosen here. */
export function ThemeToggle() {
  const mode = useSyncExternalStore(subscribe, read, () => "system" as Mode);
  return (
    <div className="theme-toggle" role="group" aria-label="Colour theme">
      {(["light", "dark", "system"] as const).map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => apply(m)}>
          {m === "system" ? "Auto" : m[0]!.toUpperCase() + m.slice(1)}
        </button>
      ))}
    </div>
  );
}
