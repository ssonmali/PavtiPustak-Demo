"use client";

import * as React from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

/**
 * DEMO BUILD — a money figure that counts to its value.
 *
 * Takes a formatter rather than a number of decimals, because the app's figures
 * are formatted three different ways — Indian grouping, Marathi numerals, a
 * plain tally — and a counter that renders `181071` on the way to `₹1,80,071`
 * changes width on every frame and jitters the layout it sits in.
 *
 * Re-running on `value` means the same figure animates *between* states, not
 * just up from zero: switch the period filter and the total travels to its new
 * number, which is the moment the animation actually earns its place.
 *
 * It starts at the real figure, not at zero. The server has no client to
 * animate on, so a counter seeded at zero renders `₹0` into the HTML — and a
 * receipt book whose total reads zero until JavaScript arrives is worse than
 * one that never animated at all. The drop to zero happens on mount, after
 * hydration, where it is the first frame of the count rather than the page.
 */
export function CountUp({
  value,
  format,
  className,
  duration = 1.1,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  /** Seconds. Long enough to read as counting, short enough not to be waited on. */
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const count = useMotionValue(value);
  const text = useTransform(count, (n) => format(Math.round(n)));
  /** Only the first run sweeps up from zero; later ones travel from where they are. */
  const counted = React.useRef(false);

  React.useEffect(() => {
    if (reduced) {
      count.jump(value);
      return;
    }
    // jump(), not set(): this is a seek to the start of the animation, and
    // set() would spend a frame rendering zero as though it were the figure.
    if (!counted.current) {
      counted.current = true;
      count.jump(0);
    }

    const controls = animate(count, value, {
      duration,
      // Fast at first and settling slowly: the last few hundred rupees ticking
      // into place is the part that reads as a total being tallied.
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [value, duration, reduced, count]);

  return (
    <motion.span className={className} suppressHydrationWarning>
      {text}
    </motion.span>
  );
}
