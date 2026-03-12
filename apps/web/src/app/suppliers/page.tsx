'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { BulkDeleteButton } from '../../components/bulk-delete-button';
import { PageShell } from '../../components/page-shell';
import { TableActionButton } from '../../components/table-action-button';
import { TablePagination } from '../../components/table-pagination';
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
  Tooltip,
  VisuallyHidden,
} from '@procurement/ui';
import { apiFetch } from '../../lib/api';
import { useNotifications } from '../providers';
import * as XLSX from 'xlsx';

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

type ImportedSupplierPayload = {
  name: string;
  email: string;
  categories: string;
  isActive: boolean;
  phonePrimary: string;
  phoneSecondary: string;
  location: string;
};

type SupplierSortKey = 'name' | 'categories' | 'email' | 'dataQuality';

export default function SuppliersPage() {
  const router = useRouter();
  const { pushToast } = useNotifications();
  const [suppliers, setSuppliers] = useState<UiSupplier[]>([]);
  const [activeSupplier, setActiveSupplier] = useState<UiSupplier | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [suppliersToDelete, setSuppliersToDelete] = useState<UiSupplier[]>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState<UiSupplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phonePrimary: '',
    phoneSecondary: '',
    location: '',
    categories: [] as string[],
  });
  const [categoryInput, setCategoryInput] = useState('');
  const [importingSuppliers, setImportingSuppliers] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SupplierSortKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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

  const getOutstandingSupplierData = (supplier: UiSupplier) => {
    const missing: string[] = [];
    if (!supplier.email.trim()) {
      missing.push('Email address');
    }
    if (!supplier.phonePrimary.trim()) {
      missing.push('Primary phone');
    }
    if (parseCategories(supplier.categories).length === 0) {
      missing.push('Categories');
    }
    return missing;
  };

  const sortedSuppliers = [...suppliers].sort((left, right) => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    const leftValue =
      sortConfig.key === 'categories'
        ? parseCategories(left.categories).join(', ')
        : sortConfig.key === 'dataQuality'
          ? getOutstandingSupplierData(left).join(', ')
          : left[sortConfig.key];
    const rightValue =
      sortConfig.key === 'categories'
        ? parseCategories(right.categories).join(', ')
        : sortConfig.key === 'dataQuality'
          ? getOutstandingSupplierData(right).join(', ')
          : right[sortConfig.key];

    return String(leftValue).localeCompare(String(rightValue)) * direction;
  });

  const toggleSort = (key: SupplierSortKey) => {
    setSortConfig((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    );
  };

  const getSortLabel = (key: SupplierSortKey) =>
    sortConfig.key === key ? (sortConfig.direction === 'asc' ? ' ^' : ' v') : '';
  const paginatedSuppliers = sortedSuppliers.slice((page - 1) * pageSize, page * pageSize);
  const pageSupplierIds = paginatedSuppliers.map((supplier) => supplier.id);
  const allPageSuppliersSelected =
    pageSupplierIds.length > 0 && pageSupplierIds.every((id) => selectedSupplierIds.includes(id));

  const extractImportedSuppliers = (rows: unknown[][]): ImportedSupplierPayload[] => {
    const seen = new Set<string>();
    const imported: ImportedSupplierPayload[] = [];

    rows.forEach((row) => {
      const cells = Array.isArray(row) ? row : [];
      const name = String(cells[1] ?? '').trim();
      const categories = String(cells[3] ?? '').trim();
      const emailCandidates = [String(cells[6] ?? '').trim(), String(cells[7] ?? '').trim()]
        .filter(Boolean);
      const email = Array.from(new Set(emailCandidates)).join(', ');
      const phonePrimary = String(cells[8] ?? '').trim();
      const phoneSecondary = String(cells[9] ?? '').trim();

      if (!name) {
        return;
      }

      const dedupeKey = [name.toLowerCase(), email.toLowerCase(), phonePrimary].join('|');
      if (seen.has(dedupeKey)) {
        return;
      }
      seen.add(dedupeKey);

      imported.push({
        name,
        email,
        categories: JSON.stringify(parseCategories(categories)),
        isActive: true,
        phonePrimary,
        phoneSecondary,
        location: '',
      });
    });

    return imported;
  };

  const importSuppliersFromFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || importingSuppliers) {
      return;
    }

    setImportingSuppliers(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('The selected file does not contain any sheets.');
      }

      const sheet = workbook.Sheets[firstSheetName];
      if (!sheet) {
        throw new Error('The selected worksheet could not be read.');
      }
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
      }) as unknown[][];
      const suppliersToImport = extractImportedSuppliers(rows);

      if (suppliersToImport.length === 0) {
        throw new Error('No supplier rows were found in the selected file.');
      }

      const results = await Promise.allSettled(
        suppliersToImport.map((supplier) =>
          apiFetch<ApiSupplier>('/suppliers', {
            method: 'POST',
            body: JSON.stringify(supplier),
          }),
        ),
      );

      const importedCount = results.filter((result) => result.status === 'fulfilled').length;
      const failedCount = results.length - importedCount;

      await refreshSuppliers();
      pushToast({
        title: 'Supplier import completed',
        message:
          failedCount === 0
            ? `${importedCount} supplier${importedCount === 1 ? '' : 's'} imported successfully.`
            : `${importedCount} imported, ${failedCount} failed.`,
        tone: failedCount === 0 ? 'success' : 'warning',
      });
    } catch (error) {
      pushToast({
        title: 'Supplier import failed',
        message: error instanceof Error ? error.message : 'Could not import suppliers from file.',
        tone: 'error',
      });
    } finally {
      setImportingSuppliers(false);
      event.target.value = '';
    }
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

  const deleteSuppliers = async (targets: UiSupplier[]) => {
    const results = await Promise.allSettled(
      targets.map((supplier) => apiFetch(`/suppliers/${supplier.id}`, { method: 'DELETE' })),
    );
    const deletedIds = targets
      .filter((_, index) => results[index]?.status === 'fulfilled')
      .map((supplier) => supplier.id);

    if (deletedIds.length > 0) {
      setSuppliers((prev) => prev.filter((entry) => !deletedIds.includes(entry.id)));
      setSelectedSupplierIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
      setDetailSupplier((prev) => (prev && deletedIds.includes(prev.id) ? null : prev));
    }

    return {
      deletedCount: deletedIds.length,
      failedCount: targets.length - deletedIds.length,
    };
  };

  const confirmDelete = (supplier: UiSupplier) => {
    setSuppliersToDelete([supplier]);
    setDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    const targets = suppliers.filter((supplier) => selectedSupplierIds.includes(supplier.id));
    if (targets.length === 0) {
      return;
    }
    setSuppliersToDelete(targets);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (suppliersToDelete.length === 0) {
      return;
    }

    try {
      setIsDeleting(true);
      const { deletedCount, failedCount } = await deleteSuppliers(suppliersToDelete);
      setDeleteDialogOpen(false);
      setSuppliersToDelete([]);
      await refreshSuppliers();
      pushToast({
        title: deletedCount === 1 ? 'Supplier deleted' : 'Suppliers deleted',
        message:
          failedCount === 0
            ? `${deletedCount} supplier${deletedCount === 1 ? '' : 's'} deleted.`
            : `${deletedCount} deleted, ${failedCount} failed.`,
        tone: failedCount === 0 ? 'success' : 'warning',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSupplierSelection = (supplierId: string) => {
    setSelectedSupplierIds((current) =>
      current.includes(supplierId)
        ? current.filter((id) => id !== supplierId)
        : [...current, supplierId],
    );
  };

  const togglePageSelection = () => {
    setSelectedSupplierIds((current) => {
      if (allPageSuppliersSelected) {
        return current.filter((id) => !pageSupplierIds.includes(id));
      }
      return Array.from(new Set([...current, ...pageSupplierIds]));
    });
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

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sortedSuppliers.length / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, pageSize, sortedSuppliers.length]);

  return (
    <PageShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-heading">Suppliers</h2>
            <p className="mt-2 text-sm text-muted">Manage supplier roster and contact info.</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={importSuppliersFromFile}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              disabled={importingSuppliers}
            >
              {importingSuppliers ? 'Importing...' : 'Import suppliers'}
            </Button>
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
                    placeholder="(+258) 123-456-789"
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
                    placeholder="(+258) 123-456-789"
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
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-heading">Registered suppliers</h3>
              {selectedSupplierIds.length > 0 ? (
                <BulkDeleteButton
                  count={selectedSupplierIds.length}
                  loading={isDeleting}
                  onClick={confirmBulkDelete}
                  disabled={isDeleting}
                />
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all suppliers on this page"
                      checked={allPageSuppliersSelected}
                      onChange={togglePageSelection}
                    />
                  </TableHead>
                  <TableHead>
                    <button type="button" className="text-left" onClick={() => toggleSort('name')}>
                      {`Name${getSortLabel('name')}`}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="text-left" onClick={() => toggleSort('categories')}>
                      {`Categories${getSortLabel('categories')}`}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="text-left" onClick={() => toggleSort('email')}>
                      {`Email${getSortLabel('email')}`}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button type="button" className="text-left" onClick={() => toggleSort('dataQuality')}>
                      {`Data quality${getSortLabel('dataQuality')}`}
                    </button>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <tbody>
                {paginatedSuppliers.map((supplier) => (
                  <TableRow
                    key={supplier.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => openDetails(supplier)}
                  >
                    <TableCell onClick={(event: MouseEvent<HTMLTableCellElement>) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select supplier ${supplier.name}`}
                        checked={selectedSupplierIds.includes(supplier.id)}
                        onChange={() => toggleSupplierSelection(supplier.id)}
                      />
                    </TableCell>
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
                    <TableCell>{supplier.email || '—'}</TableCell>
                    <TableCell>
                      {!supplier.email.trim() ? (
                        <Tooltip
                          content={`Missing: ${getOutstandingSupplierData(supplier).join(', ')}`}
                          side="top"
                          align="start"
                        >
                          <span className="inline-flex rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-rose-700">
                            
                          </span>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(event: MouseEvent<HTMLTableCellElement>) => event.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Dialog onOpenChange={(open) => !open && setActiveSupplier(null)}>
                          <DialogTrigger asChild>
                            <TableActionButton
                              action="edit"
                              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                event.stopPropagation();
                                startEdit(supplier);
                              }}
                            />
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
                        <TableActionButton
                          action="delete"
                          disabled={isDeleting}
                          onClick={(event: MouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            confirmDelete(supplier);
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </tbody>
            </Table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalItems={sortedSuppliers.length}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
            />
          </CardContent>
        </Card>
        <Dialog open={deleteDialogOpen} onOpenChange={(open) => !open && !isDeleting && setDeleteDialogOpen(false)}>
          <DialogContent className="motion-modal w-full max-w-md">
            <DialogTitle>
              <VisuallyHidden>Confirm delete supplier</VisuallyHidden>
            </DialogTitle>
            <h3 className="text-lg font-semibold text-heading">
              {suppliersToDelete.length > 1 ? 'Delete suppliers' : 'Delete supplier'}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {suppliersToDelete.length > 1 ? (
                <>
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-slate-700">
                    {suppliersToDelete.length} suppliers
                  </span>
                  ? This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete{' '}
                  <span className="font-semibold text-slate-700">
                    {suppliersToDelete[0]?.name ?? 'this supplier'}
                  </span>
                  ? This action cannot be undone.
                </>
              )}
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="secondary"
                full
                disabled={isDeleting}
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setSuppliersToDelete([]);
                }}
              >
                Cancel
              </Button>
              <Button full disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? 'Deleting...' : 'Delete'}
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
