import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { TallyMark } from '@/components/ui/TallyMark';
import { Rise, SplitWords, Stagger } from '@/components/motion/Reveal';
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
          setNotice('Account created. Check your email to confirm, then sign in.');
          setMode('signIn');
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-surface">
      <Stagger className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12" stagger={0.1}>
        <Rise>
          <TallyMark size={56} />
        </Rise>

        <h1 className="mt-10 font-serif text-[clamp(3.5rem,18vw,5.5rem)] leading-[0.9] tracking-tight text-ink">
          <SplitWords text={mode === 'signIn' ? 'Welcome back.' : 'Let’s begin.'} />
        </h1>

        <Rise as="p" className="mt-4 font-serif text-xl italic leading-snug text-ink-muted">
          {mode === 'signIn' ? 'Sign in to sync across your devices.' : 'Create an account to get started.'}
        </Rise>

        <Rise className="mt-8">
          <GlassCard className="p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
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
              {notice && <p className="text-sm font-medium text-forest">{notice}</p>}
              <Button type="submit" size="lg" className="w-full" loading={submitting}>
                {submitting ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
              </Button>
            </form>
          </GlassCard>

          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full text-ink-muted"
            onClick={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
              setNotice(null);
            }}
          >
            {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Button>
        </Rise>
      </Stagger>
    </div>
  );
}
