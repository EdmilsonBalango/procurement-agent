'use client';

import { useState } from 'react';
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
  if (!document) return null;

  const isPDF = document.type === 'pdf' || document.name.endsWith('.pdf');
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].some(ext =>
    document.name.toLowerCase().endsWith(ext)
  );
  const isDocument = ['docx', 'doc', 'xlsx', 'xls'].some(ext =>
    document.name.toLowerCase().endsWith(ext)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-6xl overflow-hidden bg-white bg-opacity-95">
        <DialogTitle>
          <VisuallyHidden>Document Viewer</VisuallyHidden>
        </DialogTitle>
        <div className="flex flex-col gap-4 h-full">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-heading">{document.name}</h2>
            <DialogClose asChild>
              <button className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </DialogClose>
          </div>

          <div className="flex min-h-[calc(95vh-200px)] items-center justify-center overflow-auto bg-slate-50 rounded-lg">
            {isPDF && document.url ? (
              <iframe
                src={`${document.url}#toolbar=0`}
                className="h-full w-full"
                title="PDF Viewer"
              />
            ) : isImage && document.url ? (
              <img
                src={document.url}
                alt={document.name}
                className="max-h-full max-w-full object-contain"
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
                    Download the file to view it.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <Button variant="primary" size="sm" className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </Button>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">Close</Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
