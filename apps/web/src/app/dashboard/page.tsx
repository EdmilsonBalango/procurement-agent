'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '../../components/page-shell';
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

export default function DashboardPage() {
  const router = useRouter();
  const [billing, setBilling] = useState('monthly');
  const [records, setRecords] = useState<PrRecord[]>([]);
  const [currentUser, setCurrentUser] = useState<ApiMe | null>(null);

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
        const mapped = data.map((record) => ({
          id: record.prNumber,
          status:
            (record.quotes?.length ?? 0) > 0 &&
            ['NEW', 'ASSIGNED', 'WAITING_QUOTES'].includes(record.status)
              ? 'READY_FOR_REVIEW'
              : record.status,
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

  const stageData = useMemo(() => {
    const stageConfig: Array<{ label: string; status: PrRecord['status'] }> = [
      { label: 'New', status: 'NEW' },
      { label: 'Assigned', status: 'ASSIGNED' },
      { label: 'Waiting Quotes', status: 'WAITING_QUOTES' },
      { label: 'Ready for Review', status: 'READY_FOR_REVIEW' },
      { label: 'Ready to Send', status: 'READY_TO_SEND' },
      { label: 'Closed & Paid', status: 'CLOSED_PAID' },
    ];
    return stageConfig.map((stage) => ({
      label: stage.label,
      status: stage.status,
      count: records.filter((record) => record.status === stage.status).length,
    }));
  }, [records]);

  const openCount = useMemo(
    () => records.filter((record) => !['CLOSED', 'CLOSED_PAID', 'SENT'].includes(record.status))
      .length,
    [records],
  );

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
          {[
            { label: 'Open PRs', value: String(openCount), change: 'Live count' },
            { label: 'Avg. cycle time', value: '4.1 days', change: '-8% improvement' },
            { label: 'SLA compliance', value: '93%', change: '2 breaches this week' },
          ].map((kpi) => (
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
            <div className="grid gap-4 md:grid-cols-5">
              {stageData.map((stage, index) => {
                const colors = [
                  { bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700', badgeBg: 'bg-green-500' },
                  { bgColor: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-700', badgeBg: 'bg-purple-500' },
                  { bgColor: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-700', badgeBg: 'bg-amber-500' },
                  { bgColor: 'bg-orange-50', borderColor: 'border-orange-200', textColor: 'text-orange-700', badgeBg: 'bg-orange-500' },
                  { bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700', badgeBg: 'bg-blue-500' },
                  { bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', textColor: 'text-emerald-700', badgeBg: 'bg-emerald-500' },
                ];
                const color = colors[index % colors.length]!;
                return (
                  <div
                    key={stage.label}
                    className={`motion-alert cursor-pointer rounded-lg border ${color.borderColor} ${color.bgColor} p-4 dark:border-slate-800 dark:bg-slate-900`}
                    onClick={() => router.push(`/prs/inbox?status=${stage.status}`)}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${color.badgeBg}`}></div>
                      <p className="text-xs uppercase font-semibold text-slate-600 dark:text-slate-400">
                        {stage.label}
                      </p>
                    </div>
                    <p className={`mt-2 text-2xl font-semibold ${color.textColor} dark:text-slate-100`}>
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
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {records.slice(0, 3).map((row) => {
                  const statusColorMap = {
                    'NEW': { bgColor: 'bg-green-100', textColor: 'text-green-700', label: 'New' },
                    'ASSIGNED': { bgColor: 'bg-purple-100', textColor: 'text-purple-700', label: 'Assigned' },
                    'WAITING_QUOTES': { bgColor: 'bg-amber-100', textColor: 'text-amber-700', label: 'Waiting Quotes' },
                    'READY_FOR_REVIEW': { bgColor: 'bg-orange-100', textColor: 'text-orange-700', label: 'Ready for Review' },
                    'READY_TO_SEND': { bgColor: 'bg-blue-100', textColor: 'text-blue-700', label: 'Ready to Send' },
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
                      <TableCell>{row.updated}</TableCell>
                    </TableRow>
                  );
                })}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
