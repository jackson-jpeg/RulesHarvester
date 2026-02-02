import { useState, useCallback, useRef, useEffect, forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
  /** Debounce time in ms to prevent double-clicks (default: 300ms, 0 to disable) */
  debounceMs?: number;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-amber-500 hover:bg-amber-600 text-black font-medium focus:ring-amber-500/50',
  secondary:
    'bg-surface-elevated hover:bg-border text-text-primary border border-border focus:ring-border/50',
  ghost:
    'bg-transparent hover:bg-surface-elevated text-text-secondary hover:text-text-primary focus:ring-border/50',
  danger:
    'bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/50 focus:ring-rose-500/50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    children,
    className = '',
    disabled,
    debounceMs = 300,
    onClick,
    ...props
  },
  ref
) {
  const [isDebouncing, setIsDebouncing] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      // If debounce is disabled or already debouncing, handle accordingly
      if (debounceMs === 0) {
        onClick?.(e);
        return;
      }

      if (isDebouncing) {
        return;
      }

      setIsDebouncing(true);
      onClick?.(e);

      timeoutRef.current = setTimeout(() => {
        setIsDebouncing(false);
      }, debounceMs);
    },
    [onClick, debounceMs, isDebouncing]
  );

  return (
    <button
      ref={ref}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-lg font-medium
        transition-colors duration-150
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      disabled={disabled || isLoading || isDebouncing}
      onClick={handleClick}
      {...props}
    >
      {isLoading ? (
        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      ) : (
        leftIcon
      )}
      {children}
      {rightIcon}
    </button>
  );
});
