'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Button,
  VisuallyHidden,
} from '@procurement/ui';

interface DocumentVisualizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: {
    name: string;
    type: string;
    url?: string;
  } | null;
}

export function DocumentVisualizer({
  open,
  onOpenChange,
  document,
}: DocumentVisualizerProps) {
  const descriptionId = 'document-visualizer-description';

  const docName = document?.name ?? 'Document';
  const docType = document?.type ?? '';
  const docUrl = document?.url;

  const [isLoading, setIsLoading] = useState(false);

  const isPDF =
    docType === 'pdf' ||
    docType.toLowerCase().includes('pdf') ||
    docName.toLowerCase().endsWith('.pdf');
  const isImage =
    docType.toLowerCase().startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp'].some((ext) =>
      docName.toLowerCase().endsWith(ext),
    );
  const isDocument =
    [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(docType.toLowerCase()) ||
    ['docx', 'doc', 'xlsx', 'xls'].some((ext) =>
      docName.toLowerCase().endsWith(ext),
    );

  useEffect(() => {
    if (open && docUrl) {
      setIsLoading(true);
      return;
    }
    setIsLoading(false);
  }, [open, docUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[95vh] max-w-6xl overflow-hidden bg-white bg-opacity-95"
        aria-describedby={descriptionId}
      >
        <DialogTitle>
          <VisuallyHidden>Document Viewer</VisuallyHidden>
        </DialogTitle>
        <VisuallyHidden >
          Previewing uploaded document.
        </VisuallyHidden>
        <div className="flex flex-col gap-4 h-full">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-heading">{docName}</h2>
            <DialogClose asChild>
              <button className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </DialogClose>
          </div>

          <div className="relative flex h-[calc(95vh-200px)] items-center justify-center overflow-auto bg-slate-50 rounded-lg">
            {isLoading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Loading preview…</span>
                </div>
              </div>
            ) : null}
            {isImage && docUrl ? (
              <img
                src={docUrl}
                alt={docName}
                className="max-h-full max-w-full object-contain"
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
              />
            ) : docUrl ? (
              <iframe
                src={isPDF ? `${docUrl}#toolbar=0` : docUrl}
                className="h-full w-full bg-slate-600"
                title="Document Viewer"
                onLoad={() => setIsLoading(false)}
              />
            ) : isDocument ? (
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                <svg className="h-16 w-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-700">Document Preview</p>
                  <p className="mt-1 text-sm text-slate-500">
                    This document type cannot be previewed in the browser.
                  </p>
                  <div className="mt-4">
                    <Button size="sm">Download to view</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                <svg className="h-16 w-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-700">Preview Not Available</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {document ? 'Download the file to view it.' : 'No document selected.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            {docUrl ? (
              <a
                href={docUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex"
              >
                <Button variant="primary" size="sm" className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </Button>
              </a>
            ) : null}
            <DialogClose asChild>
              <Button variant="secondary" size="sm">Close</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
