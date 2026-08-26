"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { SPRING } from "./springs";

/**
 * DEMO BUILD — the page swap.
 *
 * `mode="wait"` rather than a crossfade: the two ledgers are full of numbers in
 * the same positions, and overlapping them mid-fade produces a frame of
 * superimposed figures that reads as a rendering bug. The outgoing page leaves
 * first, and the incoming one is only ever seen alone.
 *
 * Keyed on the pathname, so a `router.refresh()` from a save — which keeps the
 * path — updates in place without the whole screen flying about.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.99 }}
        transition={{ ...SPRING, duration: 0.22 }}
        className="min-w-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
