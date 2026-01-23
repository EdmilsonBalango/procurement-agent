import { PageShell } from '../../../components/page-shell';
import { Badge, Button, Card, CardContent, CardHeader, Table, TableCell, TableHead, TableHeader, TableRow } from '@procurement/ui';

const rows = [
  { pr: 'PR-2024-1004', status: 'ASSIGNED', buyer: 'Buyer 1', quotes: 2 },
  { pr: 'PR-2024-1005', status: 'WAITING_QUOTES', buyer: 'Buyer 2', quotes: 1 },
  { pr: 'PR-2024-1006', status: 'READY_FOR_REVIEW', buyer: 'Buyer 1', quotes: 3 },
];

export default function AllPrsPage() {
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
                  <TableRow key={row.pr}>
                    <TableCell>{row.pr}</TableCell>
                    <TableCell>
                      <Badge>{row.status}</Badge>
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
