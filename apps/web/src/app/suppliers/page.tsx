'use client';

import { useCallback, useEffect, useState, type ChangeEvent, type MouseEvent } from 'react';
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
import { apiFetch } from '../../lib/api';
import { Pencil, Trash2 } from 'lucide-react';

type UiSupplier = {
  id: string;
  name: string;
  categories: string;
  status: 'Active' | 'Inactive';
  email: string;
  phonePrimary: string;
  phoneSecondary: string;
  location: string;
};

type ApiSupplier = {
  id: string;
  name: string;
  email: string;
  categories: string;
  isActive: boolean;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  location?: string | null;
};

const toUiSupplier = (supplier: ApiSupplier): UiSupplier => ({
  id: supplier.id,
  name: supplier.name,
  categories: supplier.categories,
  status: supplier.isActive ? 'Active' : 'Inactive',
  email: supplier.email,
  phonePrimary: supplier.phonePrimary ?? '',
  phoneSecondary: supplier.phoneSecondary ?? '',
  location: supplier.location ?? '',
});

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<UiSupplier[]>([]);
  const [activeSupplier, setActiveSupplier] = useState<UiSupplier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<UiSupplier | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState<UiSupplier | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phonePrimary: '',
    phoneSecondary: '',
    location: '',
    categories: [] as string[],
  });
  const [categoryInput, setCategoryInput] = useState('');

  const refreshSuppliers = useCallback(async () => {
    const data = await apiFetch<ApiSupplier[]>('/suppliers');
    setSuppliers(data.map(toUiSupplier));
  }, []);

  const parseCategories = (value: string) => {
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(value) as string[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // fall through
    }
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  };

  const addCategory = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    setFormState((prev) => {
      if (prev.categories.includes(trimmed)) {
        return prev;
      }
      return { ...prev, categories: [...prev.categories, trimmed] };
    });
    setCategoryInput('');
  };

  const removeCategory = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      categories: prev.categories.filter((entry) => entry !== value),
    }));
  };

  const startCreate = () => {
    setActiveSupplier(null);
    setFormState({
      name: '',
      email: '',
      phonePrimary: '',
      phoneSecondary: '',
      location: '',
      categories: [],
    });
    setCategoryInput('');
  };

  const startEdit = (supplier: UiSupplier) => {
    setActiveSupplier(supplier);
    setFormState({
      name: supplier.name,
      email: supplier.email,
      phonePrimary: supplier.phonePrimary,
      phoneSecondary: supplier.phoneSecondary,
      location: supplier.location,
      categories: parseCategories(supplier.categories),
    });
    setCategoryInput('');
  };

  const deleteSupplier = async (supplier: UiSupplier) => {
    try {
      await apiFetch(`/suppliers/${supplier.id}`, { method: 'DELETE' });
      setSuppliers((prev) => prev.filter((entry) => entry.id !== supplier.id));
      setDetailSupplier((prev) => (prev?.id === supplier.id ? null : prev));
      await refreshSuppliers();
    } catch {
      // ignore
    }
  };

  const confirmDelete = (supplier: UiSupplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!supplierToDelete) {
      return;
    }
    await deleteSupplier(supplierToDelete);
    setDeleteDialogOpen(false);
    setSupplierToDelete(null);
  };

  const openDetails = (supplier: UiSupplier) => {
    setDetailSupplier(supplier);
    setDetailDialogOpen(true);
  };

  const saveSupplier = async () => {
    const payload = {
      name: formState.name,
      email: formState.email,
      categories: JSON.stringify(formState.categories),
      isActive: true,
      phonePrimary: formState.phonePrimary,
      phoneSecondary: formState.phoneSecondary,
      location: formState.location,
    };
    try {
      if (activeSupplier) {
        const updated = await apiFetch<ApiSupplier>(`/suppliers/${activeSupplier.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setSuppliers((prev) =>
          prev.map((entry) =>
            entry.id === activeSupplier.id
              ? {
                  ...entry,
                  name: updated.name ?? payload.name,
                  email: updated.email ?? payload.email,
                  categories: updated.categories ?? payload.categories,
                  phonePrimary: updated.phonePrimary ?? payload.phonePrimary ?? '',
                  phoneSecondary: updated.phoneSecondary ?? payload.phoneSecondary ?? '',
                  location: updated.location ?? payload.location ?? '',
                }
              : entry,
          ),
        );
        await refreshSuppliers();
        setActiveSupplier(null);
      } else {
        const created = await apiFetch<ApiSupplier>('/suppliers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSuppliers((prev) => [
          {
            id: created.id,
            name: created.name ?? payload.name,
            categories: created.categories ?? payload.categories,
            status: created.isActive ? 'Active' : 'Inactive',
            email: created.email ?? payload.email,
            phonePrimary: created.phonePrimary ?? payload.phonePrimary ?? '',
            phoneSecondary: created.phoneSecondary ?? payload.phoneSecondary ?? '',
            location: created.location ?? payload.location ?? '',
          },
          ...prev,
        ]);
        await refreshSuppliers();
        setFormState({
          name: '',
          email: '',
          phonePrimary: '',
          phoneSecondary: '',
          location: '',
          categories: [],
        });
        setCategoryInput('');
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const fetchSuppliers = () =>
      refreshSuppliers().catch(() => undefined);

    fetchSuppliers();
    const interval = window.setInterval(fetchSuppliers, 20000);
    return () => {
      window.clearInterval(interval);
    };
  }, [refreshSuppliers]);

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
            <DialogContent className="motion-modal w-full max-w-3xl">
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
                <div className="text-sm font-medium text-slate-700 md:col-span-2">
                  Categories
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formState.categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => removeCategory(category)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                      >
                        {category} ✕
                      </button>
                    ))}
                  </div>
                  <input
                    value={categoryInput}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setCategoryInput(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addCategory(categoryInput);
                      }
                    }}
                    className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    placeholder="Type a category and press Enter"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <DialogClose asChild>
                  <Button full onClick={saveSupplier}>
                    {activeSupplier ? 'Save changes' : 'Register supplier'}
                  </Button>
                </DialogClose>
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
                  <TableHead>Email</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {suppliers.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => openDetails(supplier)}
                  >
                    <TableCell>{supplier.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {parseCategories(supplier.categories).map((category) => (
                          <span
                            key={category}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{supplier.email}</TableCell>
                    <TableCell onClick={(event: MouseEvent<HTMLTableCellElement>) => event.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Dialog onOpenChange={(open) => !open && setActiveSupplier(null)}>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                event.stopPropagation();
                                startEdit(supplier);
                              }}
                              aria-label="Edit supplier"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                        <DialogContent
                          className="motion-modal w-full max-w-3xl"
                          onClick={(event: MouseEvent<HTMLDivElement>) => event.stopPropagation()}
                        >
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
                                placeholder="+258 82 123 4567"
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
                                placeholder="+258 82 123 4567"
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
                            <div className="text-sm font-medium text-slate-700 md:col-span-2">
                              Categories
                              <div className="mt-2 flex flex-wrap gap-2">
                                {formState.categories.map((category) => (
                                  <button
                                    key={category}
                                    type="button"
                                    onClick={() => removeCategory(category)}
                                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
                                  >
                                    {category} ✕
                                  </button>
                                ))}
                              </div>
                              <input
                                value={categoryInput}
                                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                  setCategoryInput(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    addCategory(categoryInput);
                                  }
                                }}
                                className="mt-3 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                                placeholder="Type a category and press Enter"
                              />
                            </div>
                          </div>
                          <div className="mt-6 flex gap-3">
                            <DialogClose asChild>
                              <Button full onClick={saveSupplier}>Save changes</Button>
                            </DialogClose>
                            <DialogClose asChild>
                              <Button full variant="secondary">Cancel</Button>
                            </DialogClose>
                          </div>
                        </DialogContent>
                        </Dialog>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(event: MouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            confirmDelete(supplier);
                          }}
                          aria-label="Delete supplier"
                          className="text-red-400 hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="motion-modal w-full max-w-md">
            <DialogTitle>
              <VisuallyHidden>Confirm delete supplier</VisuallyHidden>
            </DialogTitle>
            <h3 className="text-lg font-semibold text-heading">Delete supplier</h3>
            <p className="mt-2 text-sm text-muted">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-700">
                {supplierToDelete?.name ?? 'this supplier'}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" full onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button full onClick={handleDelete}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="motion-modal w-full max-w-2xl">
            <DialogTitle>
              <VisuallyHidden>Supplier details</VisuallyHidden>
            </DialogTitle>
            <h3 className="text-lg font-semibold text-heading">Supplier details</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</p>
                <p className="mt-1 text-sm text-slate-800">{detailSupplier?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
                <p className="mt-1 text-sm text-slate-800">{detailSupplier?.email ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary phone</p>
                <p className="mt-1 text-sm text-slate-800">{detailSupplier?.phonePrimary || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Secondary phone</p>
                <p className="mt-1 text-sm text-slate-800">{detailSupplier?.phoneSecondary || '—'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
                <p className="mt-1 text-sm text-slate-800">{detailSupplier?.location || '—'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Categories</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(detailSupplier ? parseCategories(detailSupplier.categories) : []).map((category) => (
                    <span
                      key={category}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      {category}
                    </span>
                  ))}
                  {detailSupplier && parseCategories(detailSupplier.categories).length === 0 ? (
                    <span className="text-sm text-slate-500">—</span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button variant="secondary" onClick={() => setDetailDialogOpen(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageShell>
  );
}
