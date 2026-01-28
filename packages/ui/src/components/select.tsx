import { cn } from '../utils';

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = ({ label, options, className, ...props }: SelectProps) => (
  <div className="flex flex-col gap-2">
    {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
    <div className="relative">
      <select
        className={cn(
          'w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 placeholder-slate-400 transition-all duration-200 hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            style={{
              backgroundColor: '#ffffff',
              color: '#1e293b',
              padding: '8px',
            }}
          >
            {option.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 top-1/2 h-2 w-2 -translate-y-1 border-r border-b border-slate-500 rotate-45" />
    </div>
  </div>
);
