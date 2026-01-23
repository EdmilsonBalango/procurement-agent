import { PageShell } from '../../components/page-shell';
import { Badge, Button, Card, CardContent, CardHeader, Table, TableCell, TableHead, TableHeader, TableRow } from '@procurement/ui';

const suppliers = [
  { name: 'Supplier 1', categories: 'IT, SaaS', status: 'Active' },
  { name: 'Supplier 2', categories: 'Facilities', status: 'Active' },
  { name: 'Supplier 3', categories: 'Marketing', status: 'Inactive' },
];

export default function SuppliersPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-heading">Suppliers</h2>
            <p className="mt-2 text-sm text-muted">Manage supplier roster and contact info.</p>
          </div>
          <Button variant="secondary" size="sm">Add supplier</Button>
        </div>
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-heading">Registered suppliers</h3>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Categories</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.name}>
                    <TableCell>{supplier.name}</TableCell>
                    <TableCell>{supplier.categories}</TableCell>
                    <TableCell>
                      <Badge>{supplier.status}</Badge>
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
