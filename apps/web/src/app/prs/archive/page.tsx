'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '../../../components/page-shell';
import { TablePagination } from '../../../components/table-pagination';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@procurement/ui';
import { apiFetch } from '../../../lib/api';
import type { PrRecord } from '../../../lib/types';

type ApiCaseRecord = {
  id: string;
  prNumber: string;
  status: PrRecord['status'];
  subject: string;
  requesterName: string;
  priority: PrRecord['priority'];
  createdAt: string;
  updatedAt: string;
  assignedBuyer?: { name: string } | null;
  quotes?: Array<{ id: string }>;
};

type ApiMe = {
  id: string;
  role: 'ADMIN' | 'BUYER';
};

function ArchivePageContent() {
  const router = useRouter();
  const [records, setRecords] = useState<PrRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<ApiMe | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
        const path =
          me.role === 'ADMIN' ? '/cases' : `/cases?buyerId=${encodeURIComponent(me.id)}`;
        const data = await apiFetch<ApiCaseRecord[]>(path);
        if (!active) {
          return;
        }
        setRecords(
          data
            .filter((record) => ['CLOSED', 'CLOSED_PAID'].includes(record.status))
            .map((record) => ({
              id: record.prNumber,
              status: record.status,
              summary: record.subject,
              created: new Date(record.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }),
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
            })),
        );
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

  const rows = useMemo(
    () =>
      records.map((record) => ({
        pr: record.id,
        status: record.status,
        buyer: record.buyer,
        created: record.created,
        updated: record.updated,
      })),
    [records],
  );
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, rows],
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, pageSize, rows.length]);

  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold text-heading">Archive</h2>
          <p className="mt-2 text-sm text-muted">
            Closed PRs are stored here. Buyers can review them, and admins can still make changes.
          </p>
        </div>
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-heading">Closed requests</h3>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {paginatedRows.map((row) => (
                  <TableRow
                    key={row.pr}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/prs/${row.pr}`)}
                  >
                    <TableCell>{row.pr}</TableCell>
                    <TableCell>
                      <Badge variant="case" status={row.status} />
                    </TableCell>
                    <TableCell>{row.buyer}</TableCell>
                    <TableCell>{row.created}</TableCell>
                    <TableCell>{row.updated}</TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={rows.length}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

export default function ArchivePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <ArchivePageContent />
    </Suspense>
  );
}
