'use client';

import { useState, type ChangeEvent, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { PageShell } from '../../components/page-shell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  VisuallyHidden,
} from '@procurement/ui';
import { suppliers } from '../../lib/mock-data';

export default function SuppliersPage() {
  const router = useRouter();
  const [activeSupplier, setActiveSupplier] = useState<(typeof suppliers)[number] | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phonePrimary: '',
    phoneSecondary: '',
    location: '',
  });

  const startCreate = () => {
    setActiveSupplier(null);
    setFormState({
      name: '',
      email: '',
      phonePrimary: '',
      phoneSecondary: '',
      location: '',
    });
  };

  const startEdit = (supplier: (typeof suppliers)[number]) => {
    setActiveSupplier(supplier);
    setFormState({
      name: supplier.name,
      email: supplier.email,
      phonePrimary: supplier.phonePrimary,
      phoneSecondary: supplier.phoneSecondary,
      location: supplier.location,
    });
  };

  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-heading">Suppliers</h2>
            <p className="mt-2 text-sm text-muted">Manage supplier roster and contact info.</p>
          </div>
          <Dialog onOpenChange={(open) => !open && setActiveSupplier(null)}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm" onClick={startCreate}>
                Add supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="motion-modal w-full max-w-2xl">
              <DialogTitle>
                <VisuallyHidden>
                  {activeSupplier ? 'Edit supplier' : 'Register supplier'}
                </VisuallyHidden>
              </DialogTitle>
              <h3 className="text-center text-lg font-semibold text-heading">
                {activeSupplier ? 'Edit supplier' : 'Register supplier'}
              </h3>
              <p className="mt-2 text-center text-sm text-muted">
                Capture core contact details and location for this supplier.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Name
                  <input
                    value={formState.name}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setFormState((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Supplier name"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Email address
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setFormState((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="name@company.com"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Primary phone
                  <input
                    value={formState.phonePrimary}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setFormState((prev) => ({ ...prev, phonePrimary: event.target.value }))
                    }
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="(555) 555-1234"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Secondary phone
                  <input
                    value={formState.phoneSecondary}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setFormState((prev) => ({ ...prev, phoneSecondary: event.target.value }))
                    }
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="(555) 555-5678"
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Location
                  <input
                    value={formState.location}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setFormState((prev) => ({ ...prev, location: event.target.value }))
                    }
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="City, State"
                  />
                </label>
              </div>
              <div className="mt-6 flex gap-3">
                <Button full>{activeSupplier ? 'Save changes' : 'Register supplier'}</Button>
                <DialogClose asChild>
                  <Button full variant="secondary">Cancel</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {suppliers.map((supplier) => (
                  <TableRow
                    key={supplier.name}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => router.push(`/suppliers/${supplier.name}` as Route)}
                  >
                    <TableCell>{supplier.name}</TableCell>
                    <TableCell>{supplier.categories}</TableCell>
                    <TableCell>
                      <Badge>{supplier.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog onOpenChange={(open) => !open && setActiveSupplier(null)}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(event: MouseEvent<HTMLButtonElement>) => {
                              event.stopPropagation();
                              startEdit(supplier);
                            }}
                          >
                            Edit
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="motion-modal w-full max-w-2xl">
                          <DialogTitle>
                            <VisuallyHidden>Edit supplier</VisuallyHidden>
                          </DialogTitle>
                          <h3 className="text-center text-lg font-semibold text-heading">Edit supplier</h3>
                          <p className="mt-2 text-center text-sm text-muted">
                            Update the supplier contact information and location.
                          </p>
                          <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <label className="text-sm font-medium text-slate-700">
                              Name
                              <input
                                value={formState.name}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  setFormState((prev) => ({ ...prev, name: event.target.value }))
                                }
                                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                placeholder="Supplier name"
                              />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                              Email address
                              <input
                                type="email"
                                value={formState.email}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  setFormState((prev) => ({ ...prev, email: event.target.value }))
                                }
                                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                placeholder="name@company.com"
                              />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                              Primary phone
                              <input
                                value={formState.phonePrimary}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    phonePrimary: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                placeholder="(555) 555-1234"
                              />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                              Secondary phone
                              <input
                                value={formState.phoneSecondary}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    phoneSecondary: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                placeholder="(555) 555-5678"
                              />
                            </label>
                            <label className="text-sm font-medium text-slate-700 md:col-span-2">
                              Location
                              <input
                                value={formState.location}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    location: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                placeholder="City, State"
                              />
                            </label>
                          </div>
                          <div className="mt-6 flex gap-3">
                            <Button full>Save changes</Button>
                            <DialogClose asChild>
                              <Button full variant="secondary">Cancel</Button>
                            </DialogClose>
                          </div>
                        </DialogContent>
                      </Dialog>
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
