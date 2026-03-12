'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '../../components/page-shell';
import { TablePagination } from '../../components/table-pagination';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  SegmentedControl,
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@procurement/ui';
import { apiFetch } from '../../lib/api';
import type { PrRecord } from '../../lib/types';

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

type ApiMetricsSummary = {
  total: number;
  openCases: number;
  readyToReview: number;
  quotesPending: number;
  workflow: Array<{ status: PrRecord['status']; count: number }>;
  sla: {
    averageDaysToClose: number;
    completedCases: number;
    breachedCases: number;
    compliantCases: number;
    evaluatedCases: number;
    complianceRate: number;
  };
};

const formatDays = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return '0.0 days';
  }
  return `${value.toFixed(1)} days`;
};

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${Math.round(value)}%`;
};

export default function DashboardPage() {
  const router = useRouter();
  const [billing, setBilling] = useState('monthly');
  const [records, setRecords] = useState<PrRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<ApiMe | null>(null);
  const [metrics, setMetrics] = useState<ApiMetricsSummary | null>(null);
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
        const [data, summary] = await Promise.all([
          apiFetch<ApiCaseRecord[]>(path),
          apiFetch<ApiMetricsSummary>('/metrics/summary'),
        ]);
        if (!active) {
          return;
        }
        const mapped = data.map((record) => ({
          id: record.prNumber,
          status:
            (record.quotes?.length ?? 0) > 0 &&
            ['NEW', 'ASSIGNED', 'WAITING_QUOTES'].includes(record.status)
              ? 'READY_FOR_REVIEW'
              : record.status,
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
        setMetrics(summary);
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

  const stageData = useMemo(() => {
    const stageConfig: Array<{ label: string; status: PrRecord['status'] }> = [
      { label: 'New', status: 'NEW' },
      { label: 'Assigned', status: 'ASSIGNED' },
      { label: 'Waiting Quotes', status: 'WAITING_QUOTES' },
      { label: 'Ready for Review', status: 'READY_FOR_REVIEW' },
      { label: 'In review', status: 'IN_REVIEW' },
      { label: 'Request Invoice', status: 'REQUEST_INVOICE' },
      { label: 'Waiting for Invoice', status: 'WAITING_INVOICE' },
      { label: 'Request Receipt', status: 'REQUEST_RECEIPT' },
      { label: 'Waiting for Receipt', status: 'WAITING_RECEIPT' },
      { label: 'Closed & Paid', status: 'CLOSED_PAID' },
    ];
    return stageConfig.map((stage) => ({
      label: stage.label,
      status: stage.status,
      count: records.filter((record) => record.status === stage.status).length,
    }));
  }, [records]);
  const stageColorMap: Record<
    PrRecord['status'],
    { bgColor: string; borderColor: string; textColor: string; badgeBg: string }
  > = {
    NEW: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      badgeBg: 'bg-green-500',
    },
    MISSING_INFO: {
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      textColor: 'text-rose-700',
      badgeBg: 'bg-rose-500',
    },
    ASSIGNED: {
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      badgeBg: 'bg-purple-500',
    },
    WAITING_QUOTES: {
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      textColor: 'text-amber-700',
      badgeBg: 'bg-amber-500',
    },
    READY_FOR_REVIEW: {
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700',
      badgeBg: 'bg-orange-500',
    },
    IN_REVIEW: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      badgeBg: 'bg-blue-500',
    },
    REQUEST_INVOICE: {
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      textColor: 'text-indigo-700',
      badgeBg: 'bg-indigo-500',
    },
    WAITING_INVOICE: {
      bgColor: 'bg-cyan-50',
      borderColor: 'border-cyan-200',
      textColor: 'text-cyan-700',
      badgeBg: 'bg-cyan-500',
    },
    REQUEST_RECEIPT: {
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200',
      textColor: 'text-teal-700',
      badgeBg: 'bg-teal-500',
    },
    WAITING_RECEIPT: {
      bgColor: 'bg-lime-50',
      borderColor: 'border-lime-200',
      textColor: 'text-lime-700',
      badgeBg: 'bg-lime-500',
    },
    SENT: {
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      textColor: 'text-sky-700',
      badgeBg: 'bg-sky-500',
    },
    CLOSED: {
      bgColor: 'bg-slate-100',
      borderColor: 'border-slate-300',
      textColor: 'text-slate-700',
      badgeBg: 'bg-slate-500',
    },
    CLOSED_PAID: {
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      textColor: 'text-emerald-700',
      badgeBg: 'bg-emerald-500',
    },
    QUARANTINE: {
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      textColor: 'text-rose-700',
      badgeBg: 'bg-rose-500',
    },
  };

  const openCount = useMemo(
    () => records.filter((record) => !['CLOSED', 'CLOSED_PAID', 'SENT'].includes(record.status))
      .length,
    [records],
  );
  const kpis = useMemo(
    () => [
      {
        label: 'Open PRs',
        value: String(metrics?.openCases ?? openCount),
        change: 'Live count',
      },
      {
        label: 'Avg. cycle time',
        value: formatDays(metrics?.sla.averageDaysToClose ?? 0),
        change:
          (metrics?.sla.completedCases ?? 0) > 0
            ? `Based on ${metrics?.sla.completedCases ?? 0} completed PRs`
            : 'No completed PRs yet',
      },
      {
        label: 'SLA compliance',
        value: formatPercent(metrics?.sla.complianceRate ?? 0),
        change:
          metrics && metrics.sla.breachedCases > 0
            ? `${metrics.sla.breachedCases} breached PR${metrics.sla.breachedCases === 1 ? '' : 's'}`
            : 'No breached PRs',
      },
    ],
    [metrics, openCount],
  );
  const paginatedRecords = useMemo(
    () => records.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, records],
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, pageSize, records.length]);

  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-heading">Dashboard</h2>
            <p className="mt-2 text-sm text-muted">
              Track procurement throughput, SLA coverage, and RFQ activity in real time.
            </p>
          </div>
          <SegmentedControl
            value={billing}
            onChange={setBilling}
            options={[
              { label: 'Monthly', value: 'monthly' },
              { label: 'Annually', value: 'annually' },
            ]}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="motion-alert">
              <CardHeader>
                <p className="text-xs uppercase text-slate-400">{kpi.label}</p>
                <h3 className="mt-2 text-2xl font-semibold text-heading">{kpi.value}</h3>
                <p className="mt-2 text-xs text-muted">{kpi.change}</p>
              </CardHeader>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-heading">Workflow stage overview</h3>
                <p className="mt-1 text-sm text-muted">
                  PRs moving through each approval step.
                </p>
              </div>
              <Button variant="secondary" size="sm">
                Export report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {stageData.map((stage) => {
                const color = stageColorMap[stage.status] ?? stageColorMap.NEW;
                return (
                  <div
                    key={stage.label}
                    className={`motion-alert cursor-pointer rounded-lg border ${color.borderColor} ${color.bgColor} p-4 dark:border-slate-800 dark:bg-slate-900`}
                    onClick={() =>
                      router.push(
                        `${
                          currentUser?.role === 'ADMIN' ? '/prs/all' : '/prs/inbox'
                        }?status=${stage.status}`,
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${color.badgeBg}`}></div>
                      <p className="whitespace-nowrap text-xs uppercase font-semibold text-slate-600 dark:text-slate-400">
                        {stage.label}
                      </p>
                    </div>
                    <p className={`mt-2 whitespace-nowrap text-2xl font-semibold ${color.textColor} dark:text-slate-100`}>
                      {stage.count}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-heading">Recent activity</h3>
            <p className="mt-1 text-sm text-muted">
              Latest actions across procurement cases.
            </p>
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
                {paginatedRecords.map((row) => {
                  const statusColorMap = {
                    'NEW': { bgColor: 'bg-green-100', textColor: 'text-green-700', label: 'New' },
                    'MISSING_INFO': { bgColor: 'bg-rose-100', textColor: 'text-rose-700', label: 'Missing Info' },
                    'ASSIGNED': { bgColor: 'bg-purple-100', textColor: 'text-purple-700', label: 'Assigned' },
                    'WAITING_QUOTES': { bgColor: 'bg-amber-100', textColor: 'text-amber-700', label: 'Waiting Quotes' },
                    'READY_FOR_REVIEW': { bgColor: 'bg-orange-100', textColor: 'text-orange-700', label: 'Ready for Review' },
                    'IN_REVIEW': { bgColor: 'bg-blue-100', textColor: 'text-blue-700', label: 'In review' },
                    'REQUEST_INVOICE': { bgColor: 'bg-indigo-100', textColor: 'text-indigo-700', label: 'Request Invoice' },
                    'WAITING_INVOICE': { bgColor: 'bg-cyan-100', textColor: 'text-cyan-700', label: 'Waiting for Invoice' },
                    'REQUEST_RECEIPT': { bgColor: 'bg-teal-100', textColor: 'text-teal-700', label: 'Request Receipt' },
                    'WAITING_RECEIPT': { bgColor: 'bg-lime-100', textColor: 'text-lime-700', label: 'Waiting for Receipt' },
                    'SENT': { bgColor: 'bg-sky-100', textColor: 'text-sky-700', label: 'Sent' },
                    'CLOSED': { bgColor: 'bg-slate-200', textColor: 'text-slate-700', label: 'Closed' },
                    'CLOSED_PAID': { bgColor: 'bg-emerald-100', textColor: 'text-emerald-700', label: 'Closed & Paid' },
                  } as const;
                  type StatusColor = (typeof statusColorMap)[keyof typeof statusColorMap];
                  const statusColor =
                    statusColorMap[row.status as keyof typeof statusColorMap] ?? statusColorMap.NEW;
                  return (
                    <TableRow
                      key={row.id}
                      className="motion-alert cursor-pointer hover:bg-slate-50"
                      onClick={() => router.push(`/prs/${row.id}`)}
                    >
                      <TableCell>{row.id}</TableCell>
                      <TableCell>
                        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${statusColor.bgColor} ${statusColor.textColor}`}>
                          {statusColor.label}
                        </span>
                      </TableCell>
                      <TableCell>{row.buyer}</TableCell>
                      <TableCell>{row.created}</TableCell>
                      <TableCell>{row.updated}</TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={records.length}
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
