'use client';

import { useRouter } from 'next/navigation';
import { PageShell } from '../../../components/page-shell';
import { Badge, Button, Card, CardContent, CardHeader, Table, TableCell, TableHead, TableHeader, TableRow } from '@procurement/ui';
import { prRecords } from '../../../lib/mock-data';

const rows = prRecords.map((pr) => ({
  pr: pr.id,
  status: pr.status,
  buyer: pr.buyer,
  quotes: pr.quotes,
}));

export default function AllPrsPage() {
  const router = useRouter();
  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-heading">All PRs</h2>
            <p className="mt-2 text-sm text-muted">Filter, assign, and track every procurement request.</p>
          </div>
          <Button variant="secondary" size="sm">Download CSV</Button>
        </div>
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-heading">Active requests</h3>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Quotes</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {rows.map((row) => (
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
                    <TableCell>{row.quotes}</TableCell>
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
