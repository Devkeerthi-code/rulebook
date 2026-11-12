"use client";

import { useEffect, useRef } from "react";
import { Icon } from "../icons";
import { clamp, prefersReducedMotion } from "../motion/spring";
import { CoverFace, type CoverData } from "./cover";

const FRICTION = 0.94; // velocity kept per 60 Hz frame while gliding
const RUBBER = 0.35; // how much of an overscroll drag actually moves the shelf
const EDGE_K = 170;
const EDGE_C = 26;
const DRIFT = 12; // px/s idle drift
const DRAG_THRESHOLD = 6; // px before a press becomes a drag (so taps still open a cover)

/**
 * Drag/flick shelf of document covers: pointer-tracked velocity, exponential friction,
 * rubber-band edges with a spring home, covers that lean against the motion, idle drift.
 * Keyboard: arrows move one cover, Home/End jump. All motion is transform-only.
 */
export function Shelf({ covers, onOpen, label, hint }: { covers: CoverData[]; onOpen: (id: string) => void; label: string; hint?: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const nudgeRef = useRef<(dir: number) => void>(() => undefined);
  const movedRef = useRef(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    let x = 0;
    let v = 0;
    let min = 0;
    let dragging = false;
    let captured = false;
    let pos = 0;
    let lastX = 0;
    let lastT = 0;
    let samples: { dx: number; t: number }[] = [];
    let target: number | null = null;
    let raf = 0;
    let prev = 0;
    let lastInput = -1e9;
    let hover = false;
    let focused = false;
    let visible = false;
    let driftDir = -1;
    let lean = 0;

    const measure = () => {
      min = Math.min(0, viewport.clientWidth - track.scrollWidth);
    };
    const rubber = (val: number) => (val > 0 ? val * RUBBER : val < min ? min + (val - min) * RUBBER : val);
    const unrubber = (val: number) => (val > 0 ? val / RUBBER : val < min ? min + (val - min) / RUBBER : val);
    const render = () => {
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      track.style.setProperty("--lean", `${lean.toFixed(2)}deg`);
    };
    const wake = () => {
      if (!raf) {
        prev = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    function loop(now: number) {
      const dt = Math.min((now - prev) / 1000, 1 / 30);
      prev = now;
      const reduced = prefersReducedMotion();
      if (!dragging) {
        if (target !== null) {
          v += (-EDGE_K * (x - target) - EDGE_C * v) * dt;
          x += v * dt;
          if (Math.abs(x - target) < 0.3 && Math.abs(v) < 4) {
            x = target;
            v = 0;
            target = null;
          }
        } else if (x > 0 || x < min) {
          const edge = x > 0 ? 0 : min;
          v += (-EDGE_K * (x - edge) - EDGE_C * v) * dt;
          x += v * dt;
          if (Math.abs(x - edge) < 0.3 && Math.abs(v) < 4) {
            x = edge;
            v = 0;
          }
        } else if (Math.abs(v) > 4) {
          x += v * dt;
          v *= Math.pow(FRICTION, dt * 60);
        } else {
          v = 0;
          const idle = now - lastInput > 3000 && !hover && !focused && visible && !reduced;
          if (idle && min < 0) {
            x += driftDir * DRIFT * dt;
            if (x <= min) {
              x = min;
              driftDir = 1;
            }
            if (x >= 0) {
              x = 0;
              driftDir = -1;
            }
          }
        }
      }
      lean += (clamp(-v / 300, -7, 7) - lean) * Math.min(1, dt * 10);
      render();
      const resting = !dragging && target === null && v === 0 && Math.abs(lean) < 0.05 && x <= 0 && x >= min;
      const drifting = visible && !reduced && !hover && !focused && min < 0;
      raf = resting && !drifting ? 0 : requestAnimationFrame(loop);
      if (!raf) {
        lean = 0;
        render();
      }
    }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      measure();
      dragging = true;
      movedRef.current = 0;
      target = null;
      v = 0;
      captured = false;
      pos = unrubber(x);
      lastX = e.clientX;
      lastT = performance.now();
      samples = [];
      lastInput = lastT;
      wake();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      movedRef.current += Math.abs(dx);
      if (!captured && movedRef.current > DRAG_THRESHOLD) {
        captured = true;
        viewport.setPointerCapture(e.pointerId);
        viewport.classList.add("is-dragging");
      }
      pos += dx;
      x = rubber(pos);
      samples.push({ dx, t: now });
      samples = samples.filter((s) => now - s.t < 100);
      const span = samples.length > 1 ? now - samples[0]!.t : 16;
      v = (samples.reduce((a, s) => a + s.dx, 0) / Math.max(span, 16)) * 1000;
      lastX = e.clientX;
      lastT = now;
      lastInput = now;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      viewport.classList.remove("is-dragging");
      if (performance.now() - lastT > 80) v = 0;
      lastInput = performance.now();
      wake();
    };
    const nudge = (dir: number) => {
      measure();
      const first = track.firstElementChild as HTMLElement | null;
      const step = (first ? first.getBoundingClientRect().width : 200) + 24;
      target = clamp((target ?? x) - dir * step, min, 0);
      lastInput = performance.now();
      if (prefersReducedMotion()) {
        x = target;
        target = null;
        render();
        return;
      }
      wake();
    };
    nudgeRef.current = nudge;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nudge(1);
      else if (e.key === "ArrowLeft") nudge(-1);
      else if (e.key === "Home" || e.key === "End") {
        measure();
        target = e.key === "Home" ? 0 : min;
        wake();
      } else return;
      e.preventDefault();
    };
    const onFocusIn = (e: FocusEvent) => {
      focused = true;
      const cover = (e.target as Element).closest(".cover");
      if (!cover) return;
      measure();
      const vr = viewport.getBoundingClientRect();
      const cr = cover.getBoundingClientRect();
      if (cr.left < vr.left + 16) target = clamp(x + (vr.left + 24 - cr.left), min, 0);
      else if (cr.right > vr.right - 16) target = clamp(x - (cr.right - vr.right + 24), min, 0);
      wake();
    };
    const onFocusOut = () => {
      focused = false;
      wake();
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hover = true;
    };
    const onLeave = () => {
      hover = false;
      wake();
    };
    const onResize = () => {
      measure();
      wake();
    };

    viewport.addEventListener("pointerdown", onDown);
    viewport.addEventListener("pointermove", onMove);
    viewport.addEventListener("pointerup", onUp);
    viewport.addEventListener("pointercancel", onUp);
    viewport.addEventListener("keydown", onKey);
    viewport.addEventListener("focusin", onFocusIn);
    viewport.addEventListener("focusout", onFocusOut);
    viewport.addEventListener("pointerenter", onEnter);
    viewport.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", onResize);
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible) wake();
    });
    io.observe(viewport);
    measure();
    render();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      viewport.removeEventListener("pointerdown", onDown);
      viewport.removeEventListener("pointermove", onMove);
      viewport.removeEventListener("pointerup", onUp);
      viewport.removeEventListener("pointercancel", onUp);
      viewport.removeEventListener("keydown", onKey);
      viewport.removeEventListener("focusin", onFocusIn);
      viewport.removeEventListener("focusout", onFocusOut);
      viewport.removeEventListener("pointerenter", onEnter);
      viewport.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, [covers.length]);

  return (
    <div>
      <div className="shelf-wrap">
        <div
          ref={viewportRef}
          className="shelf"
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={`${label}. Drag, flick, or use the left and right arrow keys.`}
          onClickCapture={(e) => {
            // A drag that ends over a cover must not open it.
            if (movedRef.current > DRAG_THRESHOLD) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <ul ref={trackRef} className="shelf-track" role="list">
            {covers.map((cover) => (
              <li key={cover.id}>
                <button
                  type="button"
                  className={`cover${cover.inverted ? " cover--circular" : ""}`}
                  onClick={() => onOpen(cover.id)}
                  aria-label={`${cover.title}, ${cover.typeLabel}, ${cover.dateLabel}, ${cover.statusLabel ?? `${cover.pages} pages`}${cover.demo ? ", demo document" : ""}. Open.`}
                >
                  <CoverFace cover={cover} />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="shelf-plank" aria-hidden="true" />
      </div>
      <div className="wrap shelf-controls">
        <span className="hand">{hint ?? "drag it, flick it, or use the arrow keys"}</span>
        <button className="btn btn-sm" type="button" data-spring="" aria-label="Scroll shelf left" onClick={() => nudgeRef.current(-1)}>
          <Icon name="left" />
        </button>
        <button className="btn btn-sm" type="button" data-spring="" aria-label="Scroll shelf right" onClick={() => nudgeRef.current(1)}>
          <Icon name="right" />
        </button>
      </div>
    </div>
  );
}
