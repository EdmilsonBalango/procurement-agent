import * as React from 'react';
import { cn } from '../utils';

interface SegmentedOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SegmentedControl = ({ options, value, onChange, className }: SegmentedControlProps) => (
  <div
    className={cn(
      'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 p-1',
      className,
    )}
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={cn(
          'rounded-full px-4 py-1.5 text-sm font-medium text-slate-600',
          value === option.value && 'bg-white text-slate-900 shadow-sm',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);
