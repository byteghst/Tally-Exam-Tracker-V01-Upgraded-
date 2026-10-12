import { Link } from 'react-router-dom';
import { Rise, Stagger } from '@/components/motion/Reveal';

export function NotFound() {
  return (
    <Stagger className="flex min-h-[70vh] flex-col justify-center py-8">
      <Rise>
        <p className="eyebrow">Error 404</p>
        <p className="mt-3 font-serif text-[clamp(5rem,28vw,9rem)] leading-[0.85] tracking-tight text-ink">Lost.</p>
        <p className="mt-4 max-w-xs text-ink-muted">That page doesn't exist. Head back to where things are.</p>
        <Link to="/dashboard" className="mt-6 inline-block text-sm font-semibold text-accent underline-offset-4 hover:underline">
          Go to Dashboard
        </Link>
      </Rise>
    </Stagger>
  );
}
