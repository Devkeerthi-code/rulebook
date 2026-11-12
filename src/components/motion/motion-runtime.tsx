"use client";

import { useEffect } from "react";
import { prefersReducedMotion, Spring, springToLinear } from "./spring";

/**
 * Page-wide motion, wired once by event delegation so individual components stay simple:
 * - [data-spring] buttons squash on press and overshoot on release (k=600, c=22),
 * - [data-sticker] badges slap in with an underdamped spring when they enter the viewport (k=420, c=16),
 * - --ease-spring becomes a real spring curve for CSS transitions (heading reveals).
 */
export function MotionRuntime() {
  useEffect(() => {
    const easing = springToLinear({ k: 170, c: 19 });
    if (CSS.supports("transition-timing-function", easing)) document.documentElement.style.setProperty("--ease-spring", easing);

    const presses = new WeakMap<HTMLElement, Spring>();
    const press = (el: HTMLElement | null, down: boolean) => {
      if (!el || (el as HTMLButtonElement).disabled) return;
      el.classList.toggle("is-pressed", down);
      let spring = presses.get(el);
      if (!spring) {
        spring = new Spring({ value: 1, k: 600, c: 22, onUpdate: (v) => el.style.setProperty("--press", v.toFixed(4)) });
        presses.set(el, spring);
      }
      spring.to(down ? 0.94 : 1);
    };
    const target = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>("[data-spring]") : null);
    const releaseAll = () => document.querySelectorAll<HTMLElement>("[data-spring].is-pressed").forEach((b) => press(b, false));
    const onDown = (e: PointerEvent) => press(target(e), true);
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === " " || e.key === "Enter") && !e.repeat) press(target(e), true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") releaseAll();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", releaseAll);
    document.addEventListener("pointercancel", releaseAll);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    const pop = (node: HTMLElement, delay: number) => {
      if (prefersReducedMotion()) {
        node.style.setProperty("--pop", "1");
        return;
      }
      window.setTimeout(() => {
        new Spring({ value: 0, k: 420, c: 16, onUpdate: (v) => node.style.setProperty("--pop", Math.max(0, v).toFixed(4)) }).to(1, 2);
      }, delay);
    };
    const seen = new WeakSet<Element>();
    const stickers = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, i) => {
          if (!entry.isIntersecting) return;
          stickers.unobserve(entry.target);
          pop(entry.target as HTMLElement, i * 90);
        });
      },
      { threshold: 0.6 },
    );
    const watch = (root: ParentNode) =>
      root.querySelectorAll("[data-sticker]").forEach((s) => {
        if (seen.has(s)) return;
        seen.add(s);
        stickers.observe(s);
      });
    watch(document);
    const mutations = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && (n.matches("[data-sticker]") ? watch(n.parentElement ?? n) : watch(n)));
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", releaseAll);
      document.removeEventListener("pointercancel", releaseAll);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      stickers.disconnect();
      mutations.disconnect();
    };
  }, []);
  return null;
}
