import { JobStatus, JurisdictionStatus, LogType } from '@rulesharvester/shared';
import { JOB_STATUS_CONFIG, JURISDICTION_STATUS_CONFIG } from '@rulesharvester/shared';

/**
 * Get color classes for job status
 */
export function getJobStatusColor(status: JobStatus | string): { color: string; bgColor: string; label: string } {
  const config = JOB_STATUS_CONFIG[status as keyof typeof JOB_STATUS_CONFIG];
  return config || { color: 'text-slate-400', bgColor: 'bg-slate-500/20', label: status };
}

/**
 * Get color classes for jurisdiction status
 */
export function getJurisdictionStatusColor(status: JurisdictionStatus | string): { color: string; bgColor: string; label: string } {
  const config = JURISDICTION_STATUS_CONFIG[status as keyof typeof JURISDICTION_STATUS_CONFIG];
  return config || { color: 'text-slate-400', bgColor: 'bg-slate-500/20', label: status };
}

/**
 * Get color class for log type
 */
export function getLogTypeColor(type: LogType | string): string {
  switch (type) {
    case LogType.ERROR:
      return 'text-rose-400';
    case LogType.SUCCESS:
      return 'text-emerald-400';
    case LogType.WARN:
      return 'text-amber-400';
    case LogType.AI:
      return 'text-purple-400';
    case LogType.INFO:
    default:
      return 'text-blue-400';
  }
}

/**
 * Get icon for log type
 */
export function getLogTypeIcon(type: LogType | string): string {
  switch (type) {
    case LogType.ERROR:
      return '✕';
    case LogType.SUCCESS:
      return '✓';
    case LogType.WARN:
      return '⚠';
    case LogType.AI:
      return '◈';
    case LogType.INFO:
    default:
      return '●';
  }
}

/**
 * Get confidence level badge variant
 */
export function getConfidenceBadgeVariant(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'error';
}

/**
 * Get risk level color class
 */
export function getRiskColor(probability: number): string {
  if (probability >= 70) return 'text-rose-400';
  if (probability >= 40) return 'text-amber-400';
  return 'text-emerald-400';
}
