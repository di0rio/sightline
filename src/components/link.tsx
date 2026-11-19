import { useEffect, useRef } from "react";
import { bayer, DUSK } from "@/lib/palette";
import { linkQuality, type Stats } from "@/lib/stats";
import { cn } from "@/lib/utils";

// The link between two browsers, drawn the way Deskline draws it (src/look.rs there): 2px dusk
// dots on a 3px grid, snapped to device pixels so they stay crisp at any zoom.

type Cell = (col: number, row: number, cols: number, ms: number) => string | null;

const warm = (x: number) => DUSK[Math.min(3, Math.floor(x * 4))];

/**
 * How good a link is: the strip reaches as far as the link is good, grows denser with it, and
 * warms from violet to gold along its length. `null` while there's no link: sparse violet dots
 * drifting, so it reads as searching.
 */
export function LinkMeter({ stats, className }: { stats: Stats | null; className?: string }) {
  const q = stats && linkQuality(stats.route, stats.rttMs);
  return (
    <Dots
      className={className}
      every={q === null ? 120 : null}
      cell={(c, r, cols, ms) => {
        if (q === null) return bayer(c + Math.floor(ms / 120), r) < 0.2 ? DUSK[0] : null;
        const x = c / cols;
        return x <= q && bayer(c, r) < 0.35 + 0.65 * q ? warm(x) : null;
      }}
    />
  );
}

/** Waiting for the other side: a front sweeps across and the dusk settles in behind it. */
export function Sweep() {
  return (
    <Dots
      every={50}
      cell={(c, r, cols, ms) => {
        const x = c / cols;
        const lit = Math.max(0, Math.min(1, ((ms / 2400) % 1) * 1.3 - x));
        return bayer(c, r) < lit ? warm(x) : null;
      }}
    />
  );
}

/** A strip the size of Deskline's meter, repainted every `every` ms while motion is fine. */
function Dots({
  cell,
  every,
  className,
}: {
  cell: Cell;
  every: number | null;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  // no deps: every render repaints with the cell it was given
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paint = () => {
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      const step = Math.max(2, Math.round(3 * dpr));
      const dot = Math.max(1, Math.round(2 * dpr));
      const cols = Math.floor(canvas.width / step);
      const rows = Math.floor(canvas.height / step);
      // a still frame, a little way into the motion, when motion is off
      const ms = still ? 1800 : performance.now();
      for (let c = 0; c < cols; c++)
        for (let r = 0; r < rows; r++) {
          const color = cell(c, r, cols, ms);
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(c * step, r * step, dot, dot);
        }
    };
    paint();
    if (every === null || still) return;
    const timer = setInterval(paint, every);
    return () => clearInterval(timer);
  });

  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas isn't focusable; this one is decoration
    <canvas ref={ref} aria-hidden="true" className={cn("h-[15px] w-12 shrink-0", className)} />
  );
}
