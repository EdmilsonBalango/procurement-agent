'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BulkDeleteButton } from '../../../components/bulk-delete-button';
import { PageShell } from '../../../components/page-shell';
import { TableActionButton } from '../../../components/table-action-button';
import { TablePagination } from '../../../components/table-pagination';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogTitle,
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  VisuallyHidden,
} from '@procurement/ui';
import { Filter } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { getCaseStatusLabel } from '../../../lib/case-status';
import type { PrRecord } from '../../../lib/types';
import { useNotifications } from '../../providers';

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
  name: string;
  email: string;
  role: 'ADMIN' | 'BUYER';
};

type AllPrRecord = PrRecord & {
  caseId: string;
};

type PrDeleteTarget = {
  caseId: string;
  prNumber: string;
};

function AllPrsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useNotifications();
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [buyerFilter, setBuyerFilter] = useState<string[]>([]);
  const [records, setRecords] = useState<AllPrRecord[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedPrIds, setSelectedPrIds] = useState<string[]>([]);
  const [prsToDelete, setPrsToDelete] = useState<PrDeleteTarget[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

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
        const me = await apiFetch<ApiMe>('/auth/me');
        if (!active) {
          return;
        }
        if (me.role !== 'ADMIN') {
          setIsAdmin(false);
          router.replace('/prs/inbox');
          return;
        }
        setIsAdmin(true);
        const records = await apiFetch<ApiCaseRecord[]>('/cases');
        if (!active) {
          return;
        }
        const mapped: AllPrRecord[] = records.map((record) => ({
          caseId: record.id,
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
  }, [router]);

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
        caseId: pr.caseId,
        pr: pr.id,
        status: pr.status,
        buyer: pr.buyer,
        quotes: pr.quotes,
        created: pr.created,
      }));
  }, [records, statusFilter, buyerFilter]);
  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  );
  const paginatedPrIds = paginatedRows.map((row) => row.caseId);
  const allPagePrsSelected =
    paginatedPrIds.length > 0 && paginatedPrIds.every((id) => selectedPrIds.includes(id));

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [filteredRows.length, page, pageSize]);

  const toggleValue = (value: string, setValue: (next: string[]) => void, current: string[]) => {
    if (current.includes(value)) {
      setValue(current.filter((entry) => entry !== value));
      return;
    }
    setValue([...current, value]);
  };

  const handleDelete = async () => {
    if (prsToDelete.length === 0) {
      return;
    }

    try {
      setIsDeleting(true);
      const results = await Promise.allSettled(
        prsToDelete.map((pr) => apiFetch(`/cases/${pr.caseId}`, { method: 'DELETE' })),
      );
      const deletedIds = prsToDelete
        .filter((_, index) => results[index]?.status === 'fulfilled')
        .map((pr) => pr.caseId);
      const deletedCount = deletedIds.length;
      const failedCount = prsToDelete.length - deletedCount;

      setRecords((current) => current.filter((record) => !deletedIds.includes(record.caseId)));
      setSelectedPrIds((current) => current.filter((id) => !deletedIds.includes(id)));
      setPrsToDelete([]);
      pushToast({
        title: deletedCount === 1 ? 'PR deleted' : 'PRs deleted',
        message:
          failedCount === 0
            ? `${deletedCount} PR${deletedCount === 1 ? '' : 's'} moved to quarantine.`
            : `${deletedCount} moved to quarantine, ${failedCount} failed.`,
        tone: failedCount === 0 ? 'success' : 'warning',
      });
    } catch {
      pushToast({
        title: 'Unable to delete PR',
        message: 'The selected PRs could not be moved to quarantine.',
        tone: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePrSelection = (caseId: string) => {
    setSelectedPrIds((current) =>
      current.includes(caseId)
        ? current.filter((id) => id !== caseId)
        : [...current, caseId],
    );
  };

  const togglePageSelection = () => {
    setSelectedPrIds((current) => {
      if (allPagePrsSelected) {
        return current.filter((id) => !paginatedPrIds.includes(id));
      }
      return Array.from(new Set([...current, ...paginatedPrIds]));
    });
  };

  const confirmDelete = (targets: PrDeleteTarget[]) => {
    setPrsToDelete(targets);
  };

  if (isAdmin === false) {
    return null;
  }

  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-heading">All PRs</h2>
            <p className="mt-2 text-sm text-muted">Filter, assign, and track every procurement request.</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-heading">Active requests</h3>
              <div className="flex items-center gap-3">
                {selectedPrIds.length > 0 ? (
                  <BulkDeleteButton
                    count={selectedPrIds.length}
                    loading={isDeleting}
                    disabled={isDeleting}
                    onClick={() => {
                      const targets = records
                        .filter((record) => selectedPrIds.includes(record.caseId))
                        .map((record) => ({ caseId: record.caseId, prNumber: record.id }));
                      confirmDelete(targets);
                    }}
                  />
                ) : null}
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
                          {getCaseStatusLabel(status)}
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
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all PRs on this page"
                      checked={allPagePrsSelected}
                      onChange={togglePageSelection}
                    />
                  </TableHead>
                  <TableHead>PR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Quotes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {paginatedRows.map((row) => (
                  <TableRow
                    key={row.pr}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/prs/${row.pr}`)}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select PR ${row.pr}`}
                        checked={selectedPrIds.includes(row.caseId)}
                        onChange={() => togglePrSelection(row.caseId)}
                      />
                    </TableCell>
                    <TableCell>{row.pr}</TableCell>
                    <TableCell>
                      <Badge variant="case" status={row.status} />
                    </TableCell>
                    <TableCell>{row.buyer}</TableCell>
                    <TableCell>{row.quotes}</TableCell>
                    <TableCell>{row.created}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <TableActionButton
                          action="delete"
                          disabled={isDeleting}
                          onClick={(event) => {
                            event.stopPropagation();
                            confirmDelete([{ caseId: row.caseId, prNumber: row.pr }]);
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={filteredRows.length}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </CardContent>
        </Card>
        <Dialog
          open={prsToDelete.length > 0}
          onOpenChange={(open) => !open && !isDeleting && setPrsToDelete([])}
        >
          <DialogContent className="motion-modal w-full max-w-md">
            <DialogTitle>
              <VisuallyHidden>Confirm delete PR</VisuallyHidden>
            </DialogTitle>
            <h3 className="text-lg font-semibold text-heading">
              {prsToDelete.length > 1 ? 'Delete PRs' : 'Delete PR'}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {prsToDelete.length > 1 ? (
                <>
                  Delete{' '}
                  <span className="font-semibold text-slate-700">
                    {prsToDelete.length} PRs
                  </span>
                  ? They will be moved to quarantine and hidden from the application.
                </>
              ) : (
                <>
                  Delete{' '}
                  <span className="font-semibold text-slate-700">
                    {prsToDelete[0]?.prNumber ?? 'this PR'}
                  </span>
                  ? It will be moved to quarantine and hidden from the application.
                </>
              )}
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                full
                disabled={isDeleting}
                onClick={() => setPrsToDelete([])}
              >
                Cancel
              </Button>
              <Button full disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageShell>
  );
}

export default function AllPrsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AllPrsPageContent />
    </Suspense>
  );
}
