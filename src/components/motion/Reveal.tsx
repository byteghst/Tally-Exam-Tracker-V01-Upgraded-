import { type ReactNode, useMemo } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { drawX, maskUp, rise, staggerContainer } from '@/lib/motion';

/**
 * Page-level reveal building blocks. Wrap a screen in <Stagger>; everything
 * inside (Rise, Section, Rule, SplitWords, or any motion element using the
 * shared variants) animates in one after another.
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

/** A hairline that draws itself in. `strong` = ink-coloured masthead rule. */
export function Rule({ className, strong }: { className?: string; strong?: boolean }) {
  return (
    <motion.div
      aria-hidden
      variants={drawX}
      className={clsx('h-px w-full origin-left', strong ? 'bg-ink' : 'bg-border', className)}
    />
  );
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

/** A flat titled block: hairline on top, small label, optional aside, then content. */
export function Section({
  label,
  aside,
  children,
  className
}: {
  label: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section variants={rise} className={className}>
      <Rule />
      <div className="mt-4 flex items-baseline justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </motion.section>
  );
}
