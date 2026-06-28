/**
 * Arthvion brand mark — a navy "A" whose crossbar is an electric-blue upward
 * arrow, with a rising data-point line. Hand-built vector so it scales from a
 * 16px favicon to a hero lockup and works as a single-color mark.
 *
 * Variants:
 *  - "color"  → navy A + blue arrow + white data dots. For light backgrounds.
 *  - "onDark" → white A + bright-blue arrow (no dots). For the blue brand chips
 *               and the dark login panel, where a navy A would disappear.
 */

// Outer "A" triangle with an apex counter (evenodd punches the hole).
const A_PATH = "M13,89 L50,11 L87,89 Z M40.5,63 L50,41 L59.5,63 Z";
// Diagonal arrow rising left→right; tail sits inside the A, tip pokes past the
// right leg so it reads as both the A's crossbar and an upward trend.
const ARROW_PATH = "M28,79 L66,39 L62,36 L86,28 L79,52 L75,48 L38,88 Z";

interface LogoProps {
  size?: number;
  variant?: "color" | "onDark";
  title?: string;
}

export function Logo({ size = 24, variant = "color", title = "Arthvion" }: LogoProps) {
  const onDark = variant === "onDark";
  const aFill = onDark ? "#FFFFFF" : "#0B1F44";
  const arrowFill = onDark ? "#3B8AFF" : "#1A6DF0";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label={title}
      style={{ flexShrink: 0, display: "block" }}
    >
      <path d={A_PATH} fill={aFill} fillRule="evenodd" />
      <path d={ARROW_PATH} fill={arrowFill} />
      {!onDark && (
        <g>
          <polyline
            points="33,82 49,66 64,50"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="33" cy="82" r="4" fill="#FFFFFF" />
          <circle cx="49" cy="66" r="4" fill="#FFFFFF" />
          <circle cx="64" cy="50" r="4" fill="#FFFFFF" />
        </g>
      )}
    </svg>
  );
}
