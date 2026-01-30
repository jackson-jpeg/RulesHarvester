import { useEffect } from 'react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Spinner';
import { useRulesStore } from '../../store/rulesStore';
import { useUIStore } from '../../store/uiStore';
import { TRIGGER_TYPE_LABELS } from '@rulesharvester/shared';
import type { RuleTemplate } from '@rulesharvester/shared';

const triggerTypeOptions = Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
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
  const { setActiveTab } = useUIStore();

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

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
  onClick: () => void;
}

function RuleCard({ rule, onClick }: RuleCardProps) {
  const triggerLabel = TRIGGER_TYPE_LABELS[rule.triggerType] || rule.triggerType;

  return (
    <Card hover onClick={onClick} className="cursor-pointer">
      <CardContent>
        <div className="flex items-start justify-between mb-2">
          <Badge variant="info">{rule.ruleCode}</Badge>
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
