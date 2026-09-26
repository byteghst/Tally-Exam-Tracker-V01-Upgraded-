import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-center">
      <p className="font-display text-3xl font-semibold text-ink">Page not found</p>
      <p className="text-ink-muted">Navigation should never trap you — head back to the dashboard.</p>
      <Link to="/dashboard" className="text-accent">
        Go to Dashboard
      </Link>
    </div>
  );
}
