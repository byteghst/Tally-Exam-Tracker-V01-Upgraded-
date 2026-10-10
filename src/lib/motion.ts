import type { Transition, Variants } from 'framer-motion';

/**
 * Shared motion language. Everything animates transform and opacity only
 * (never blur or filters), which keeps it smooth on mid-range phones.
 */

// Long, confident deceleration: fast start, very soft landing.
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const spring: Transition = { type: 'spring', stiffness: 320, damping: 30, mass: 0.8 };
export const springBouncy: Transition = { type: 'spring', stiffness: 520, damping: 18, mass: 0.6 };

/** Parent variant: reveals its children one after another. */
export function staggerContainer(stagger = 0.09, delay = 0.05): Variants {
  return { hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } };
}

/** Content rises into place while fading in. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_OUT } }
};

/** A hairline drawing itself from left to right. */
export const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 1.1, ease: EASE_OUT } }
};

/** Text sliding up out of a clipped line (wrap in an overflow-hidden parent). */
export const maskUp: Variants = {
  hidden: { y: '110%' },
  show: { y: '0%', transition: { duration: 0.9, ease: EASE_OUT } }
};

/** Small marks popping in with a springy overshoot; `custom` = index for a cascade. */
export const pop: Variants = {
  hidden: { scale: 0.3, opacity: 0 },
  show: (i: number = 0) => ({
    scale: 1,
    opacity: 1,
    transition: { ...springBouncy, delay: 0.3 + i * 0.06 }
  })
};
