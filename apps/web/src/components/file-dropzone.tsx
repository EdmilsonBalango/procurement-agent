'use client';

import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

type FileDropzoneProps = {
  label?: string;
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  accept?: string;
};

export const FileDropzone = ({
  label,
  onFileSelected,
  disabled,
  accept,
}: FileDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    onFileSelected(files[0]!);
  };

  return (
    <div
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm ${
        isDragging
          ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) {
          setIsDragging(true);
        }
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (!disabled) {
          handleFiles(event.dataTransfer.files);
        }
      }}
    >
      <UploadCloud className="h-5 w-5" />
      <p className="text-center">
        {label ?? 'Drag and drop a file here, or click to upload'}
      </p>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(event) => handleFiles(event.target.files)}
        disabled={disabled}
      />
    </div>
  );
};
