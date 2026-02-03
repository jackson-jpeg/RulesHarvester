import { useState } from 'react';

interface DiffViewerProps {
  oldText?: string;
  newText?: string;
  added: number;
  removed: number;
  diffSummary: string;
}

/**
 * Visual diff viewer for displaying text changes
 * Shows a summary bar with +added/-removed counts and expandable side-by-side view
 */
export function DiffViewer({
  oldText,
  newText,
  added,
  removed,
  diffSummary,
}: DiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate line-by-line diff if both texts are provided
  const computeLineDiff = () => {
    if (!oldText || !newText) return null;

    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    // Simple diff: mark lines as added, removed, or unchanged
    // This is a basic implementation; for production, consider using a diff library
    const diff: Array<{
      type: 'added' | 'removed' | 'unchanged';
      oldLine?: string;
      newLine?: string;
      lineNumber: number;
    }> = [];

    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined) {
        diff.push({ type: 'added', newLine, lineNumber: i + 1 });
      } else if (newLine === undefined) {
        diff.push({ type: 'removed', oldLine, lineNumber: i + 1 });
      } else if (oldLine !== newLine) {
        // Changed line - show as removed then added
        diff.push({ type: 'removed', oldLine, lineNumber: i + 1 });
        diff.push({ type: 'added', newLine, lineNumber: i + 1 });
      } else {
        diff.push({ type: 'unchanged', oldLine, newLine, lineNumber: i + 1 });
      }
    }

    return diff;
  };

  const lineDiff = computeLineDiff();

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Summary bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-surface-elevated cursor-pointer hover:bg-surface"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          {/* Change indicators */}
          <div className="flex items-center gap-2">
            {added > 0 && (
              <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {added} added
              </span>
            )}
            {removed > 0 && (
              <span className="flex items-center gap-1 text-rose-400 text-sm font-medium">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 12H4"
                  />
                </svg>
                {removed} removed
              </span>
            )}
          </div>

          {/* Summary */}
          <p className="text-sm text-text-secondary truncate max-w-md">
            {diffSummary}
          </p>
        </div>

        {/* Expand/collapse button */}
        {(oldText || newText) && (
          <button
            className="p-1 rounded hover:bg-surface text-text-secondary"
            aria-label={isExpanded ? 'Collapse diff' : 'Expand diff'}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded diff view */}
      {isExpanded && lineDiff && (
        <div className="max-h-96 overflow-auto">
          <div className="font-mono text-xs">
            {lineDiff.map((line, index) => (
              <div
                key={index}
                className={`flex ${
                  line.type === 'added'
                    ? 'bg-emerald-500/10'
                    : line.type === 'removed'
                    ? 'bg-rose-500/10'
                    : ''
                }`}
              >
                {/* Line number */}
                <div className="w-12 px-2 py-1 text-right text-text-muted border-r border-border select-none">
                  {line.lineNumber}
                </div>

                {/* Change indicator */}
                <div className="w-6 px-1 py-1 text-center border-r border-border select-none">
                  {line.type === 'added' && (
                    <span className="text-emerald-400">+</span>
                  )}
                  {line.type === 'removed' && (
                    <span className="text-rose-400">-</span>
                  )}
                </div>

                {/* Line content */}
                <div
                  className={`flex-1 px-2 py-1 whitespace-pre-wrap break-all ${
                    line.type === 'added'
                      ? 'text-emerald-300'
                      : line.type === 'removed'
                      ? 'text-rose-300'
                      : 'text-text-primary'
                  }`}
                >
                  {line.type === 'added'
                    ? line.newLine
                    : line.type === 'removed'
                    ? line.oldLine
                    : line.oldLine}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback when no detailed diff available */}
      {isExpanded && !lineDiff && (
        <div className="p-4 text-sm text-text-secondary">
          <p>Detailed diff not available. Changes detected:</p>
          <ul className="mt-2 list-disc list-inside">
            {added > 0 && <li>{added} line(s) added</li>}
            {removed > 0 && <li>{removed} line(s) removed</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
