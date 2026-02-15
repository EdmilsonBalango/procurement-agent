'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageShell } from '../../../components/page-shell';
import { Badge, Button, Card, CardContent, CardHeader, Table, TableCell, TableHead, TableHeader, TableRow } from '@procurement/ui';
import { Filter } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import type { PrRecord } from '../../../lib/types';

type ApiCaseRecord = {
  id: string;
  prNumber: string;
  status: PrRecord['status'];
  subject: string;
  requesterName: string;
  priority: PrRecord['priority'];
  updatedAt: string;
  assignedBuyer?: { name: string } | null;
  quotes?: Array<{ id: string }>;
};

type ApiMe = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'BUYER';
};

function InboxPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [buyerFilter, setBuyerFilter] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<ApiMe | null>(null);
  const [records, setRecords] = useState<PrRecord[]>([]);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (!statusParam) {
      return;
    }
    const next = statusParam
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    setStatusFilter(next);
    setShowFilters(true);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const fetchCases = async () => {
      try {
        const me = currentUser ?? (await apiFetch<ApiMe>('/auth/me'));
        if (!active) {
          return;
        }
        if (!currentUser) {
          setCurrentUser(me);
        }
        const cases = await apiFetch<ApiCaseRecord[]>(
          `/cases?buyerId=${encodeURIComponent(me.id)}`,
        );
        if (!active) {
          return;
        }
        const mapped = cases.map((record) => ({
          id: record.prNumber,
          status: record.status,
          summary: record.subject,
          neededBy: 'TBD',
          requester: record.requesterName,
          buyer: record.assignedBuyer?.name ?? 'Unassigned',
          priority: record.priority,
          quotes: record.quotes?.length ?? 0,
          updated: new Date(record.updatedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
          items: [],
        }));
        setRecords(mapped);
      } catch {
        // ignore
      }
    };

    fetchCases();
    const interval = window.setInterval(fetchCases, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [currentUser]);

  const statusOptions = useMemo(
    () => Array.from(new Set(records.map((pr) => pr.status))),
    [records],
  );
  const buyerOptions = useMemo(
    () => Array.from(new Set(records.map((pr) => pr.buyer))),
    [records],
  );

  const filteredRows = useMemo(() => {
    return records
      .filter((pr) => (statusFilter.length ? statusFilter.includes(pr.status) : true))
      .filter((pr) => (buyerFilter.length ? buyerFilter.includes(pr.buyer) : true))
      .map((pr) => ({
        pr: pr.id,
        requester: pr.requester,
        status: pr.status,
        priority: pr.priority,
      }));
  }, [records, statusFilter, buyerFilter]);

  const toggleValue = (value: string, setValue: (next: string[]) => void, current: string[]) => {
    if (current.includes(value)) {
      setValue(current.filter((entry) => entry !== value));
      return;
    }
    setValue([...current, value]);
  };

  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold text-heading">PR Inbox</h2>
          <p className="mt-2 text-sm text-muted">New submissions waiting for intake review.</p>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-heading">Incoming requests</h3>
              <Button
                aria-label="Filter options"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowFilters((prev) => !prev)}
              >
                <Filter className="h-4 w-4" />
              </Button>
            </div>
            {showFilters ? (
              <Card className="mt-4 border border-slate-200 bg-slate-50/60">
                <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => toggleValue(status, setStatusFilter, statusFilter)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            statusFilter.includes(status)
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {status.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Buyer
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {buyerOptions.map((buyer) => (
                        <button
                          key={buyer}
                          type="button"
                          onClick={() => toggleValue(buyer, setBuyerFilter, buyerFilter)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            buyerFilter.includes(buyer)
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {buyer}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(statusFilter.length > 0 || buyerFilter.length > 0) && (
                    <div className="md:col-span-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setStatusFilter([]);
                          setBuyerFilter([]);
                        }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {filteredRows.map((row) => (
                  <TableRow
                    key={row.pr}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/prs/${row.pr}`)}
                  >
                    <TableCell>{row.pr}</TableCell>
                    <TableCell>{row.requester}</TableCell>
                    <TableCell>
                      <Badge variant="case" status={row.status} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="priority" status={row.priority} />
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <InboxPageContent />
    </Suspense>
  );
}
