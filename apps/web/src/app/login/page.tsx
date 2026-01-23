'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader } from '@procurement/ui';
import { apiFetch } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@local');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<{ requiresMfa: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (response.requiresMfa) {
        router.push(`/mfa?email=${encodeURIComponent(email)}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl font-semibold text-heading">Sign in</h1>
          <p className="mt-2 text-sm text-muted">
            Use your procurement account to access the PR workflow.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase text-slate-400">Email</label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-slate-400">Password</label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button full disabled={loading} type="submit">
              {loading ? 'Signing in...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
