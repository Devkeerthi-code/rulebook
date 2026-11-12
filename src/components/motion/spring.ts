/** Damped spring, integrated with semi-implicit Euler at fixed 240 Hz substeps so it's stable at any frame rate. */

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface SpringOptions {
  value?: number;
  /** Stiffness. */
  k?: number;
  /** Damping. */
  c?: number;
  m?: number;
  onUpdate?: (value: number) => void;
  onRest?: (value: number) => void;
}

export class Spring {
  value: number;
  target: number;
  velocity = 0;
  private readonly k: number;
  private readonly c: number;
  private readonly m: number;
  private readonly onUpdate?: (value: number) => void;
  private readonly onRest?: (value: number) => void;
  private raf = 0;
  private last = 0;

  constructor({ value = 0, k = 170, c = 26, m = 1, onUpdate, onRest }: SpringOptions) {
    this.value = value;
    this.target = value;
    this.k = k;
    this.c = c;
    this.m = m;
    this.onUpdate = onUpdate;
    this.onRest = onRest;
  }

  to(target: number, velocity?: number): void {
    this.target = target;
    if (velocity !== undefined) this.velocity = velocity;
    if (prefersReducedMotion()) return this.set(target);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  set(value: number): void {
    this.stop();
    this.value = this.target = value;
    this.velocity = 0;
    this.onUpdate?.(value);
    this.onRest?.(value);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number): void => {
    let dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;
    while (dt > 0) {
      const h = Math.min(1 / 240, dt);
      const force = -this.k * (this.value - this.target) - this.c * this.velocity;
      this.velocity += (force / this.m) * h;
      this.value += this.velocity * h;
      dt -= h;
    }
    this.onUpdate?.(this.value);
    if (Math.abs(this.velocity) < 0.002 && Math.abs(this.value - this.target) < 0.0005) {
      this.raf = 0;
      this.value = this.target;
      this.onUpdate?.(this.value);
      this.onRest?.(this.value);
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}

/** Sample a spring's step response into a CSS linear() easing, so plain CSS transitions move like springs. */
export function springToLinear({ k, c, m = 1, duration = 0.9, samples = 48 }: { k: number; c: number; m?: number; duration?: number; samples?: number }): string {
  let x = 0;
  let v = 0;
  const points: number[] = [];
  const dt = duration / samples;
  for (let i = 0; i <= samples; i++) {
    points.push(Number(x.toFixed(4)));
    for (let s = 0; s < 8; s++) {
      const h = dt / 8;
      v += ((-k * (x - 1) - c * v) / m) * h;
      x += v * h;
    }
  }
  points[points.length - 1] = 1;
  return `linear(${points.join(", ")})`;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
