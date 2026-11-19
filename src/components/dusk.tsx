import { useEffect, useRef } from "react";
import { DUSK, dither, NIGHT } from "@/lib/palette";
import { cn } from "@/lib/utils";

// The dusk from luannzin.com's dither strip, as a sky: dots on a grid, night at the top dithering
// down through violet, plum and ember to a gold glow on the horizon, in a 4x4 Bayer order. The
// pointer pushes dots aside and they spring back. It's art: the only colour in the interface.
const RAMP = [NIGHT, ...DUSK];
const STEP = 4; // px between dots
const DOT = 3;
const REACH = 40; // px the pointer pushes within
const PUSH = 14;

export function Dusk({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    // per dot: home x, home y, offset x, offset y; one list per colour, so fills batch
    let layers: Float32Array[] = [];
    let width = 0;
    let height = 0;
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;
    let last = 0;

    const build = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const lists: number[][] = RAMP.map(() => []);
      const cols = Math.ceil(width / STEP);
      const rows = Math.ceil(height / STEP);
      // the glow sits just under the horizon, centred, as wide as the frame
      const gx = width / 2;
      const gy = height * 1.08;
      const reach = Math.max(width, height) * 0.82;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * STEP;
          const y = r * STEP;
          const near = Math.max(0, 1 - Math.hypot(x - gx, (y - gy) * 1.7) / reach);
          const t = Math.max(near ** 1.5, 0.06 + 0.22 * (y / height) ** 2);
          const i = dither(RAMP.length, t, c, r);
          if (i > 0) lists[i].push(x, y, 0, 0);
        }
      }
      layers = lists.map((l) => Float32Array.from(l));
    };

    const draw = (now: number) => {
      // ease toward the target at the same speed whatever the refresh rate
      const k = 1 - 0.8 ** (Math.min(now - last, 64) / 16.7 || 1);
      last = now;
      ctx.fillStyle = NIGHT;
      ctx.fillRect(0, 0, width, height);
      let moving = false;
      layers.forEach((dots, i) => {
        if (!dots.length) return;
        ctx.fillStyle = RAMP[i];
        for (let d = 0; d < dots.length; d += 4) {
          let tx = 0;
          let ty = 0;
          if (pointer) {
            const dx = dots[d] - pointer.x;
            const dy = dots[d + 1] - pointer.y;
            const dist = Math.hypot(dx, dy);
            if (dist < REACH && dist > 0) {
              const f = (1 - dist / REACH) * PUSH;
              tx = (dx / dist) * f;
              ty = (dy / dist) * f;
            }
          }
          dots[d + 2] += (tx - dots[d + 2]) * k;
          dots[d + 3] += (ty - dots[d + 3]) * k;
          if (Math.abs(dots[d + 2] - tx) + Math.abs(dots[d + 3] - ty) > 0.05) moving = true;
          ctx.fillRect(dots[d] + dots[d + 2], dots[d + 1] + dots[d + 3], DOT, DOT);
        }
      });
      frame = moving ? requestAnimationFrame(draw) : 0;
    };

    const wake = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    const move = (e: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      pointer = { x: e.clientX - box.left, y: e.clientY - box.top };
      wake();
    };
    const leave = () => {
      pointer = null;
      wake();
    };

    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = 0;
      build();
      draw(performance.now());
    });
    resize.observe(canvas);
    // listen on the parent so content laid over the art still moves the dots
    const target = canvas.parentElement ?? canvas;
    if (!still) {
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerleave", leave);
    }
    return () => {
      resize.disconnect();
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={cn("relative overflow-hidden bg-[#110d24]", className)}>
      {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas isn't focusable; this one is decoration */}
      <canvas ref={ref} aria-hidden="true" className="absolute inset-0 size-full touch-pan-y" />
      {children}
    </div>
  );
}
