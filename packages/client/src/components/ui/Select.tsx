import type { SelectHTMLAttributes } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  placeholder?: string;
  error?: string;
}

export function Select({
  label,
  options,
  placeholder,
  error,
  className = '',
  id,
  ...props
}: SelectProps) {
  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`
          w-full px-3 py-2
          bg-surface-elevated border border-border rounded-lg
          text-text-primary
          focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-rose-500 focus:ring-rose-500/50 focus:border-rose-500' : ''}
          ${className}
        `}
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
