import { type ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { maskUp, rise, staggerContainer } from '@/lib/motion';

/**
 * Page-level reveal building blocks. Wrap a screen in <Stagger>; everything
 * inside (Rise, Section, SplitWords, or any motion element using the shared
 * variants) animates in one after another.
 */

export function Stagger({
  children,
  className,
  stagger = 0.09,
  delay = 0.05
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  const variants = useMemo(() => staggerContainer(stagger, delay), [stagger, delay]);
  return (
    <motion.div className={className} variants={variants} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

const TAGS = { div: motion.div, p: motion.p, header: motion.header, li: motion.li } as const;

export function Rise({
  as = 'div',
  className,
  children
}: {
  as?: keyof typeof TAGS;
  className?: string;
  children: ReactNode;
}) {
  const Tag = TAGS[as] as typeof motion.div;
  return (
    <Tag variants={rise} className={className}>
      {children}
    </Tag>
  );
}

/**
 * Used to be a drawn hairline. The app no longer uses lines, so this is now an
 * empty spacer that keeps the margin its callers give it (and the `strong`
 * prop, which no longer does anything, so existing screens still compile).
 */
export function Rule({ className }: { className?: string; strong?: boolean }) {
  return <div aria-hidden className={clsx('h-0 w-full', className)} />;
}

const wordsContainer = staggerContainer(0.06, 0);

/** Headline whose words slide up one by one out of a clipped line. */
export function SplitWords({ text, className }: { text: string; className?: string }) {
  const words = text.split(' ');
  return (
    <motion.span className={className} variants={wordsContainer} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} aria-hidden>
          <span className="inline-block overflow-hidden pb-[0.15em] -mb-[0.15em] align-bottom">
            <motion.span className="inline-block" variants={maskUp}>
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </motion.span>
  );
}

/**
 * A titled block: small label, optional aside, then content. No lines. With
 * `card`, the content sits in a soft raised panel (the same look as GlassCard).
 */
export function Section({
  label,
  aside,
  children,
  className,
  card
}: {
  label: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  card?: boolean;
}) {
  return (
    <motion.section variants={rise} className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {aside}
      </div>
      <div className={clsx('mt-4', card && 'rounded-card bg-surface-raised p-5 shadow-soft')}>{children}</div>
    </motion.section>
  );
}
