import { useMemo } from "react";
import { avatarPaths, SIZE } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const SIZES = { 32: "size-8", 48: "size-12", 64: "size-16" };

/**
 * Someone's critter. Sizes are whole multiples of its 16 pixels (32, 48, 64) so no pixel row
 * comes out thicker than the others. Decorative unless given a `label`.
 */
export function Avatar({
  seed,
  size = 32,
  label,
  className,
}: {
  seed: number;
  size?: 32 | 48 | 64;
  label?: string;
  className?: string;
}) {
  const paths = useMemo(() => avatarPaths(seed), [seed]);
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      shapeRendering="crispEdges"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      // the size and opacity classes also keep a Button from shrinking and dimming it as an icon
      className={cn("art-edge shrink-0 rounded-[8px] opacity-100", SIZES[size], className)}
    >
      {paths.map(([color, d]) => (
        <path key={color} fill={color} d={d} />
      ))}
    </svg>
  );
}
