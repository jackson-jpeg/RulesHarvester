import { useState, useRef, type ReactNode, type CSSProperties } from 'react';

type TooltipPosition = 'top' | 'bottom';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: TooltipPosition;
  className?: string;
  delay?: number;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  className = '',
  delay = 200,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  };

  const tooltipStyles: CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    ...(position === 'top' ? { bottom: 'calc(100% + 8px)' } : { top: 'calc(100% + 8px)' }),
  };

  const arrowStyles: CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    ...(position === 'top'
      ? { bottom: '-6px', borderTop: '6px solid #30363d' }
      : { top: '-6px', borderBottom: '6px solid #30363d' }),
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && content && (
        <div
          style={tooltipStyles}
          className="z-50 px-3 py-2 text-sm text-text-primary bg-surface-elevated border border-border rounded-lg shadow-lg whitespace-nowrap animate-fadeIn"
          role="tooltip"
        >
          {content}
          <div style={arrowStyles} />
        </div>
      )}
    </div>
  );
}
