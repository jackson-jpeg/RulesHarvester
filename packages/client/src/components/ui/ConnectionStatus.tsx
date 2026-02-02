import { useUIStore } from '../../store/uiStore';

interface ConnectionStatusProps {
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Reusable connection status indicator component
 * Shows SSE connection state with optional label
 */
export function ConnectionStatus({ showLabel = false, size = 'sm', className = '' }: ConnectionStatusProps) {
  const { sseConnectionStatus } = useUIStore();

  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  const statusConfig = {
    connected: {
      color: 'bg-emerald-400',
      animate: false,
      label: 'Connected',
    },
    reconnecting: {
      color: 'bg-amber-400',
      animate: true,
      label: 'Reconnecting...',
    },
    connecting: {
      color: 'bg-blue-400',
      animate: true,
      label: 'Connecting...',
    },
    disconnected: {
      color: 'bg-rose-400',
      animate: false,
      label: 'Disconnected',
    },
  };

  const config = statusConfig[sseConnectionStatus];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className={`${dotSize} rounded-full ${config.color} ${config.animate ? 'animate-pulse' : ''}`}
        title={`Connection: ${sseConnectionStatus}`}
        role="status"
        aria-label={config.label}
      />
      {showLabel && (
        <span className="text-xs text-text-secondary">{config.label}</span>
      )}
    </div>
  );
}
