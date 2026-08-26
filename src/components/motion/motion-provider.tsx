"use client";

import { MotionConfig } from "motion/react";
import { SPRING } from "./springs";

/**
 * DEMO BUILD — wraps the app in one motion configuration.
 *
 * `reducedMotion="user"` is the important half: it reads the operating system's
 * "reduce motion" setting and drops every transform animation to a plain
 * opacity crossfade. The demo is deliberately loud, and loud is exactly what
 * someone with vestibular sensitivity has asked their machine to stop doing.
 * Nothing below has to know about it.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={SPRING}>
      {children}
    </MotionConfig>
  );
}
