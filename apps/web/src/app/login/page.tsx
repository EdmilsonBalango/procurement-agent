'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, CardContent, CardHeader } from '@procurement/ui';
import { apiFetch } from '../../lib/api';

type HealthStatus = 'checking' | 'up' | 'down';

type HealthResponse = {
  api: 'up';
  database: 'up' | 'down';
};

function StatusBadge({ label, status }: { label: string; status: HealthStatus }) {
  const className =
    status === 'up'
      ? 'border-emerald-100 bg-emerald-50/70 text-emerald-700'
      : status === 'down'
        ? 'border-rose-100 bg-rose-50/70 text-rose-700'
        : 'border-amber-100 bg-amber-50/70 text-amber-700';

  const value = status === 'checking' ? 'Checking' : status === 'up' ? 'Online' : 'Offline';

  return (
    <div className="flex items-center justify-end gap-2 text-[11px] text-slate-500">
      <span>{label}</span>
      <Badge className={`px-2 py-0.5 text-[10px] font-medium ${className}`}>{value}</Badge>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('edmilsonbalango34@gmail.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<HealthStatus>('checking');
  const [databaseStatus, setDatabaseStatus] = useState<HealthStatus>('checking');

  useEffect(() => {
    let active = true;

    const checkHealth = async () => {
      try {
        const response = await apiFetch<HealthResponse>('/health');
        if (!active) {
          return;
        }
        setApiStatus(response.api === 'up' ? 'up' : 'down');
        setDatabaseStatus(response.database === 'up' ? 'up' : 'down');
      } catch (err) {
        const message = err instanceof Error ? err.message.toLowerCase() : '';
        if (!active) {
          return;
        }
        if (message.includes('database')) {
          setApiStatus('up');
          setDatabaseStatus('down');
          return;
        }
        setApiStatus('down');
        setDatabaseStatus('down');
      }
    };

    void checkHealth();
    const interval = window.setInterval(checkHealth, 10000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

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
    <div className="relative flex min-h-screen items-center justify-center bg-background px-6">
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
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="motion-spinner h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-600" />
                  Signing in...
                </span>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="pointer-events-none fixed bottom-4 right-4 space-y-1.5 text-right opacity-80 sm:bottom-5 sm:right-5">
        <StatusBadge label="API" status={apiStatus} />
        <StatusBadge label="DB" status={databaseStatus} />
      </div>
    </div>
  );
}
