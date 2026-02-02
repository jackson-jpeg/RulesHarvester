import { diffWords, diffLines, Change } from 'diff';

export interface DiffResult {
  oldText: string;
  newText: string;
  changes: DiffChange[];
  summary: {
    added: number;
    removed: number;
    unchanged: number;
    hasSignificantChanges: boolean;
  };
}

export interface DiffChange {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
  lineNumber?: number;
}

/**
 * Generate a word-level diff between two texts
 */
export function generateDiff(oldText: string, newText: string): DiffResult {
  const changes = diffWords(oldText, newText);

  let added = 0;
  let removed = 0;
  let unchanged = 0;

  const mappedChanges: DiffChange[] = changes.map((change: Change) => {
    if (change.added) {
      added += change.value.length;
      return { type: 'added' as const, value: change.value };
    } else if (change.removed) {
      removed += change.value.length;
      return { type: 'removed' as const, value: change.value };
    } else {
      unchanged += change.value.length;
      return { type: 'unchanged' as const, value: change.value };
    }
  });

  // Consider changes significant if more than 5% changed
  const totalLength = Math.max(oldText.length, newText.length);
  const changePercentage = totalLength > 0 ? ((added + removed) / totalLength) * 100 : 0;
  const hasSignificantChanges = changePercentage > 5;

  return {
    oldText,
    newText,
    changes: mappedChanges,
    summary: {
      added,
      removed,
      unchanged,
      hasSignificantChanges,
    },
  };
}

/**
 * Generate a line-level diff between two texts
 */
export function generateLineDiff(oldText: string, newText: string): DiffResult {
  const changes = diffLines(oldText, newText);

  let added = 0;
  let removed = 0;
  let unchanged = 0;
  let lineNumber = 1;

  const mappedChanges: DiffChange[] = changes.map((change: Change) => {
    const result: DiffChange = {
      type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
      value: change.value,
      lineNumber,
    };

    if (change.added) {
      added += change.count || 1;
    } else if (change.removed) {
      removed += change.count || 1;
    } else {
      unchanged += change.count || 1;
      lineNumber += change.count || 1;
    }

    return result;
  });

  const totalLines = Math.max(
    oldText.split('\n').length,
    newText.split('\n').length
  );
  const changePercentage =
    totalLines > 0 ? ((added + removed) / totalLines) * 100 : 0;
  const hasSignificantChanges = changePercentage > 5;

  return {
    oldText,
    newText,
    changes: mappedChanges,
    summary: {
      added,
      removed,
      unchanged,
      hasSignificantChanges,
    },
  };
}

/**
 * Format diff for display in HTML
 */
export function formatDiffForDisplay(diff: DiffResult): string {
  return diff.changes
    .map((change) => {
      switch (change.type) {
        case 'added':
          return `<span class="diff-added">${escapeHtml(change.value)}</span>`;
        case 'removed':
          return `<span class="diff-removed">${escapeHtml(change.value)}</span>`;
        default:
          return escapeHtml(change.value);
      }
    })
    .join('');
}

/**
 * Format diff as plain text with +/- markers
 */
export function formatDiffAsText(diff: DiffResult): string {
  const lines: string[] = [];

  for (const change of diff.changes) {
    const prefix =
      change.type === 'added' ? '+' : change.type === 'removed' ? '-' : ' ';
    const changeLines = change.value.split('\n').filter(Boolean);
    for (const line of changeLines) {
      lines.push(`${prefix} ${line}`);
    }
  }

  return lines.join('\n');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get a summary of changes
 */
export function getDiffSummary(diff: DiffResult): string {
  const { added, removed, unchanged } = diff.summary;
  const total = added + removed + unchanged;

  if (total === 0) return 'No content to compare';
  if (added === 0 && removed === 0) return 'No changes detected';

  const parts: string[] = [];
  if (added > 0) parts.push(`${added} characters added`);
  if (removed > 0) parts.push(`${removed} characters removed`);

  const changePercentage = ((added + removed) / total) * 100;
  parts.push(`(${changePercentage.toFixed(1)}% changed)`);

  return parts.join(', ');
}
