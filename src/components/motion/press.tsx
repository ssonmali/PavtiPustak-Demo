"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { SNAPPY } from "./springs";

/**
 * DEMO BUILD — something that answers a finger.
 *
 * The lift is small and the press is smaller. A card that jumps 8px under the
 * cursor is a card whose text moves while you are reading it; the point is only
 * that the thing under your finger acknowledges being under your finger.
 *
 * `whileHover` is skipped on touch by Motion itself, so a phone gets the press
 * and none of the hover.
 */
export function Press({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.008 }}
      whileTap={{ scale: 0.985, y: 0 }}
      transition={SNAPPY}
      {...props}
    >
      {children}
    </motion.div>
  );
}
