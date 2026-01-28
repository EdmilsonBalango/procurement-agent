'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, CardContent, CardHeader } from '@procurement/ui';
import { apiFetch } from '../../lib/api';

export default function MfaPage() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && email) {
      apiFetch<{ code: string | null }>(`/auth/mfa/dev-code?email=${encodeURIComponent(email)}`)
        .then((response) => setDevCode(response.code))
        .catch(() => setDevCode(null));
    }
  }, [email]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiFetch('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      router.push('/dashboard');
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
          <h1 className="text-xl font-semibold text-heading">Verify your login</h1>
          <p className="mt-2 text-sm text-muted">
            We emailed a 6-digit verification code to {email || 'your email address'}.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase text-slate-400">MFA Code</label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tracking-[0.3em]"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={6}
                required
              />
            </div>
            {devCode && (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Dev view code: <span className="font-semibold">{devCode}</span>
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button full disabled={loading} type="submit">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="motion-spinner h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-600" />
                  Verifying...
                </span>
              ) : (
                'Verify'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
