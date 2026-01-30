import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export function Input({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3 py-2
          bg-surface-elevated border border-border rounded-lg
          text-text-primary placeholder-text-muted
          focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-rose-500 focus:ring-rose-500/50 focus:border-rose-500' : ''}
          ${className}
        `}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-sm text-text-muted">
          {helperText}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({
  label,
  error,
  className = '',
  id,
  ...props
}: TextareaProps) {
  const textareaId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`
          w-full px-3 py-2
          bg-surface-elevated border border-border rounded-lg
          text-text-primary placeholder-text-muted
          focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500
          disabled:opacity-50 disabled:cursor-not-allowed
          resize-y min-h-[100px]
          ${error ? 'border-rose-500 focus:ring-rose-500/50 focus:border-rose-500' : ''}
          ${className}
        `}
        aria-invalid={error ? 'true' : 'false'}
        {...props}
      />
      {error && (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
