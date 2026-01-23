import { PageShell } from '../../../components/page-shell';
import { Badge, Card, CardContent, CardHeader, Table, TableCell, TableHead, TableHeader, TableRow } from '@procurement/ui';

const rows = [
  { pr: 'PR-2024-1001', requester: 'Alex Johnson', status: 'NEW', priority: 'HIGH' },
  { pr: 'PR-2024-1002', requester: 'Morgan Lee', status: 'MISSING_INFO', priority: 'MEDIUM' },
];

export default function InboxPage() {
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
                  <TableRow key={row.pr}>
                    <TableCell>{row.pr}</TableCell>
                    <TableCell>{row.requester}</TableCell>
                    <TableCell>
                      <Badge>{row.status}</Badge>
                    </TableCell>
                    <TableCell>{row.priority}</TableCell>
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
