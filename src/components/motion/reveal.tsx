"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { BOUNCY, SPRING, STAGGER } from "./springs";

/**
 * DEMO BUILD — entrance animations.
 *
 * `Reveal` for a single block, `Stagger` + `StaggerItem` for a list whose rows
 * should arrive one after another. Both animate on mount rather than on scroll:
 * this app's screens are ledgers, and a row that waits for the viewport to
 * reach it means a printed page and a scrolled page disagree about what exists.
 */

export function Reveal({
  children,
  delay = 0,
  y = 14,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ ...BOUNCY, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  delay = 0,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: STAGGER, delayChildren: delay } },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** The `layout` prop is what makes a row leaving close the gap behind it. */
export function StaggerItem({
  children,
  ...props
}: HTMLMotionProps<"div">) {
  return (
    <motion.div
      layout
      variants={{
        hidden: { opacity: 0, y: 18, scale: 0.97 },
        shown: { opacity: 1, y: 0, scale: 1 },
      }}
      exit={{ opacity: 0, scale: 0.94, x: -24, transition: SPRING }}
      transition={SPRING}
      {...props}
    >
      {children}
    </motion.div>
  );
}
