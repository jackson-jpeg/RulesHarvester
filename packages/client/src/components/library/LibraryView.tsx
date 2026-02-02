import { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Spinner';
import { useRulesStore } from '../../store/rulesStore';
import { useUIStore } from '../../store/uiStore';
import { api } from '../../api/client';
import { TRIGGER_TYPE_LABELS } from '@rulesharvester/shared';
import type { RuleTemplate } from '@rulesharvester/shared';

const triggerTypeOptions = Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => ({
  value,
  label: label as string,
}));

export function LibraryView() {
  const {
    rules,
    isLoading,
    pagination,
    filters,
    fetchRules,
    setFilters,
    setPage,
  } = useRulesStore();
  const { setActiveTab, addLog } = useUIStore();

  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // Clear selections when rules change
  useEffect(() => {
    setSelectedRuleIds(new Set());
  }, [rules]);

  const handleRuleClick = (rule: RuleTemplate) => {
    useRulesStore.setState({ selectedRule: rule });
    setActiveTab('verify');
  };

  const handleSearch = (search: string) => {
    setFilters({ ...filters, search });
  };

  const handleTriggerFilter = (triggerType: string) => {
    setFilters({ ...filters, triggerType: triggerType || undefined });
  };

  const toggleRuleSelection = (ruleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRuleIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  const selectAllRules = () => {
    if (selectedRuleIds.size === rules.length) {
      setSelectedRuleIds(new Set());
    } else {
      setSelectedRuleIds(new Set(rules.map((r) => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRuleIds.size === 0) return;

    if (!window.confirm(`Delete ${selectedRuleIds.size} selected rules? This cannot be undone.`)) {
      return;
    }

    setIsBulkActionLoading(true);
    try {
      await api.delete('/bulk/rules', { ruleIds: Array.from(selectedRuleIds) });
      addLog(`Deleted ${selectedRuleIds.size} rules`, 'success');
      setSelectedRuleIds(new Set());
      fetchRules();
    } catch (error) {
      addLog('Failed to delete rules', 'error');
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rule Library</h1>
          <p className="text-text-secondary">
            {pagination.total} rules extracted
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search rules..."
              value={filters.search || ''}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              options={[{ value: '', label: 'All Triggers' }, ...triggerTypeOptions]}
              value={filters.triggerType || ''}
              onChange={(e) => handleTriggerFilter(e.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            onClick={() => setFilters({})}
          >
            Clear Filters
          </Button>
        </CardContent>
      </Card>

      {/* Bulk Actions Toolbar */}
      {rules.length > 0 && (
        <Card padding="sm">
          <CardContent className="flex items-center gap-4">
            <button
              onClick={selectAllRules}
              aria-label={selectedRuleIds.size === rules.length ? 'Deselect all rules' : 'Select all rules'}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-surface ${
                selectedRuleIds.size === rules.length && rules.length > 0
                  ? 'bg-amber-500 border-amber-500'
                  : selectedRuleIds.size > 0
                  ? 'bg-amber-500/50 border-amber-500'
                  : 'border-border hover:border-text-secondary'
              }`}
            >
              {selectedRuleIds.size > 0 && (
                <svg className="w-3 h-3 text-black" viewBox="0 0 12 12">
                  <path
                    d={selectedRuleIds.size === rules.length
                      ? "M10 3L4.5 8.5L2 6"
                      : "M2 6h8"
                    }
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              )}
            </button>
            <span className="text-sm text-text-secondary">
              {selectedRuleIds.size > 0
                ? `${selectedRuleIds.size} selected`
                : 'Select all'}
            </span>

            {selectedRuleIds.size > 0 && (
              <>
                <div className="h-4 w-px bg-border" />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleBulkDelete}
                  isLoading={isBulkActionLoading}
                >
                  Delete Selected
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rules Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-text-secondary">No rules found</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => setActiveTab('crawler')}
            >
              Start Extracting Rules
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                isSelected={selectedRuleIds.has(rule.id)}
                onSelect={(e) => toggleRuleSelection(rule.id, e)}
                onClick={() => handleRuleClick(rule)}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPage(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-text-secondary">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPage(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface RuleCardProps {
  rule: RuleTemplate;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function RuleCard({ rule, isSelected, onSelect, onClick }: RuleCardProps) {
  const triggerLabel = TRIGGER_TYPE_LABELS[rule.triggerType] || rule.triggerType;

  return (
    <Card hover onClick={onClick} className={`cursor-pointer ${isSelected ? 'ring-2 ring-amber-500' : ''}`}>
      <CardContent>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onSelect}
              aria-label={isSelected ? 'Deselect rule' : 'Select rule'}
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 focus:ring-offset-surface ${
                isSelected
                  ? 'bg-amber-500 border-amber-500'
                  : 'border-border hover:border-text-secondary'
              }`}
            >
              {isSelected && (
                <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 12 12">
                  <path
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    d="M10 3L4.5 8.5L2 6"
                  />
                </svg>
              )}
            </button>
            <Badge variant="info">{rule.ruleCode}</Badge>
          </div>
          <Badge
            variant={
              rule.confidenceScore >= 80
                ? 'success'
                : rule.confidenceScore >= 60
                ? 'warning'
                : 'error'
            }
          >
            {rule.confidenceScore}%
          </Badge>
        </div>

        <h3 className="font-semibold text-text-primary mb-1 line-clamp-2">
          {rule.name}
        </h3>

        <p className="text-sm text-text-secondary mb-3">
          {triggerLabel}
        </p>

        {/* Deadlines summary */}
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{(rule.deadlines as unknown[])?.length || 0} deadlines</span>
          <span>|</span>
          <span>Complexity: {rule.complexity || '-'}/10</span>
        </div>

        {/* Risk indicator */}
        {rule.riskProfile && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-muted">Sanction Risk</span>
              <span
                className={
                  (rule.riskProfile as { sanctionProbability: number }).sanctionProbability >= 70
                    ? 'text-rose-400'
                    : (rule.riskProfile as { sanctionProbability: number }).sanctionProbability >= 40
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }
              >
                {(rule.riskProfile as { sanctionProbability: number }).sanctionProbability}%
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
