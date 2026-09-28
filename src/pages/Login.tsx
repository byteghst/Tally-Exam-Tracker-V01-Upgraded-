import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { GlassCard } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TallyMark } from '@/components/ui/TallyMark';
import { useAuthStore } from '@/store/authStore';

export function Login() {
  const { session, initializing, signIn, signUp } = useAuthStore();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (initializing) return null;
  if (session) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === 'signIn') {
        const res = await signIn(email.trim(), password);
        if (res.error) setError(res.error);
      } else {
        const res = await signUp(email.trim(), password);
        if (res.error) setError(res.error);
        else if (res.needsEmailConfirm) {
          setNotice('Account created — check your email to confirm, then sign in.');
          setMode('signIn');
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-app-gradient" />
      <GlassCard className="w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {/* Brand colors: bars #0F1216 (light bg #F2F3F6 in dark mode), diagonal stroke #284EFE (set inside TallyMark) */}
          <TallyMark className="h-10 w-10 text-[#0F1216] dark:text-[#F2F3F6]" />
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Tally</h1>
          <p className="font-serif text-lg italic leading-snug text-ink-muted">
            {mode === 'signIn' ? 'Sign in to sync across your devices.' : 'Create an account to get started.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          {notice && <p className="text-sm text-accent">{notice}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setError(null);
            setNotice(null);
          }}
          className="mt-4 w-full text-center text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </GlassCard>
    </div>
  );
}
