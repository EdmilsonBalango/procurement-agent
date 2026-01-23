'use client';

import { useState } from 'react';
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

const stageData = [
  { label: 'New', count: 6 },
  { label: 'Assigned', count: 4 },
  { label: 'Waiting Quotes', count: 3 },
  { label: 'Ready for Review', count: 2 },
  { label: 'Ready to Send', count: 1 },
];

export default function DashboardPage() {
  const [billing, setBilling] = useState('monthly');

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
            { label: 'Open PRs', value: '42', change: '+6% vs last month' },
            { label: 'Avg. cycle time', value: '4.1 days', change: '-8% improvement' },
            { label: 'SLA compliance', value: '93%', change: '2 breaches this week' },
          ].map((kpi) => (
            <Card key={kpi.label}>
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
              {stageData.map((stage) => (
                <div key={stage.label} className="rounded-lg border border-slate-200 p-4">
                  <p className="text-xs uppercase text-slate-400">{stage.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-heading">{stage.count}</p>
                </div>
              ))}
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
                {[
                  { pr: 'PR-2024-1001', status: 'Waiting Quotes', buyer: 'Buyer 1', updated: '2h ago' },
                  { pr: 'PR-2024-1003', status: 'Ready for Review', buyer: 'Buyer 2', updated: '5h ago' },
                  { pr: 'PR-2024-1007', status: 'Assigned', buyer: 'Buyer 1', updated: '1d ago' },
                ].map((row) => (
                  <TableRow key={row.pr}>
                    <TableCell>{row.pr}</TableCell>
                    <TableCell>
                      <Badge>{row.status}</Badge>
                    </TableCell>
                    <TableCell>{row.buyer}</TableCell>
                    <TableCell>{row.updated}</TableCell>
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
