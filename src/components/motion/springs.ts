import type { Transition } from "motion/react";

/**
 * DEMO BUILD — the motion vocabulary.
 *
 * Four springs, used everywhere, so the whole app moves like one object rather
 * than like a dozen components that each chose their own easing. Springs rather
 * than durations throughout: a spring interrupted halfway carries its velocity
 * into the next animation, which is what makes fast tapping feel like handling
 * something rather than like cancelling a video.
 */

/** The default. Enough overshoot to be felt, not enough to wobble. */
export const SPRING: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 30,
  mass: 0.8,
};

/** Big, showy entrances — cards landing, panels arriving. */
export const BOUNCY: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 18,
  mass: 0.9,
};

/** Taps and hovers, where anything slower reads as lag. */
export const SNAPPY: Transition = {
  type: "spring",
  stiffness: 700,
  damping: 32,
  mass: 0.5,
};

/** Shared-element travel: the nav marker sliding between tabs. */
export const GLIDE: Transition = {
  type: "spring",
  stiffness: 500,
  damping: 38,
  mass: 0.6,
};

/** How long a staggered list waits between its children, in seconds. */
export const STAGGER = 0.045;
