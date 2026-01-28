'use client';

import { useRouter } from 'next/navigation';
import { PageShell } from '../../../components/page-shell';
import { Badge, Card, CardContent, CardHeader, Table, TableCell, TableHead, TableHeader, TableRow } from '@procurement/ui';
import { prRecords } from '../../../lib/mock-data';

const rows = prRecords.map((pr) => ({
  pr: pr.id,
  requester: pr.requester,
  status: pr.status,
  priority: pr.priority,
}));

export default function InboxPage() {
  const router = useRouter();
  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h2 className="text-2xl font-semibold text-heading">PR Inbox</h2>
          <p className="mt-2 text-sm text-muted">New submissions waiting for intake review.</p>
        </div>
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-heading">Incoming requests</h3>
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
                {rows.map((row) => (
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
