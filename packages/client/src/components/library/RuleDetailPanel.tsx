import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { toast } from '../ui/Toast';
import { useRulesStore } from '../../store/rulesStore';
import { useUIStore } from '../../store/uiStore';
import { TRIGGER_TYPE_LABELS, LogType, DeadlinePriority } from '@rulesharvester/shared';
import type { Deadline, TriggerType, RuleTemplate } from '@rulesharvester/shared';

const triggerTypeOptions = Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => ({
  value,
  label: label as string,
}));

const priorityOptions = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'FATAL', label: 'Fatal' },
];

interface RuleDetailPanelProps {
  rule: RuleTemplate;
  onClose: () => void;
}

export function RuleDetailPanel({ rule, onClose }: RuleDetailPanelProps) {
  const { updateRule, isLoading } = useRulesStore();
  const { addLog } = useUIStore();

  const [activeTab, setActiveTab] = useState<'details' | 'deadlines' | 'debate' | 'raw'>('details');
  const [editedRule, setEditedRule] = useState<RuleTemplate>(rule);
  const [newDeadline, setNewDeadline] = useState({
    name: '',
    daysFromTrigger: 0,
    priority: DeadlinePriority.STANDARD,
    actionRequired: '',
  });

  // Update editedRule when rule prop changes
  useEffect(() => {
    setEditedRule(rule);
  }, [rule]);

  const handleSave = async () => {
    try {
      await updateRule(rule.id, {
        name: editedRule.name,
        triggerType: editedRule.triggerType,
        deadlines: editedRule.deadlines,
        relatedRules: editedRule.relatedRules,
        rawText: editedRule.rawText,
      });
      addLog('Rule updated successfully', LogType.SUCCESS);
      toast.success('Rule saved');
    } catch {
      addLog('Failed to update rule', LogType.ERROR);
      toast.error('Failed to save rule');
    }
  };

  const handleAddDeadline = () => {
    if (!newDeadline.name || !newDeadline.actionRequired) return;

    const deadline: Deadline = {
      id: `deadline-${Date.now()}`,
      ...newDeadline,
    };

    setEditedRule((prev) => ({
      ...prev,
      deadlines: [...(prev.deadlines as Deadline[]), deadline],
    }));

    setNewDeadline({
      name: '',
      daysFromTrigger: 0,
      priority: DeadlinePriority.STANDARD,
      actionRequired: '',
    });
  };

  const handleRemoveDeadline = (id: string) => {
    setEditedRule((prev) => ({
      ...prev,
      deadlines: (prev.deadlines as Deadline[]).filter((d) => d.id !== id),
    }));
  };

  const riskProfile = rule.riskProfile as
    | { sanctionProbability: number; administrativeFriction: number }
    | undefined;
  const swarmDebate = rule.swarmDebate as
    | {
        consensusScore: number;
        debateSummary: string;
        agentCritiques: Array<{
          persona: string;
          position: string;
          reasoning: string;
          confidence: number;
        }>;
      }
    | undefined;

  return (
    <div className="h-full flex flex-col bg-surface border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
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
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-elevated text-text-secondary"
            aria-label="Close panel"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <h2 className="font-semibold text-lg line-clamp-2">{rule.name}</h2>
      </div>

      {/* Risk Summary */}
      {riskProfile && (
        <div className="px-4 py-3 border-b border-border bg-surface-elevated">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-text-muted">Sanction Risk: </span>
              <span
                className={
                  riskProfile.sanctionProbability >= 70
                    ? 'text-rose-400 font-semibold'
                    : riskProfile.sanctionProbability >= 40
                    ? 'text-amber-400 font-semibold'
                    : 'text-emerald-400 font-semibold'
                }
              >
                {riskProfile.sanctionProbability}%
              </span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div>
              <span className="text-text-muted">Friction: </span>
              <span className="text-blue-400 font-semibold">{riskProfile.administrativeFriction}/10</span>
            </div>
            {swarmDebate && (
              <>
                <div className="w-px h-4 bg-border" />
                <div>
                  <span className="text-text-muted">Consensus: </span>
                  <span className="text-purple-400 font-semibold">{swarmDebate.consensusScore}%</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border" role="tablist">
        {(['details', 'deadlines', 'debate', 'raw'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-amber-400 border-b-2 border-amber-400 bg-surface-elevated'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'details' && (
          <div className="space-y-4">
            <Input label="Rule Code" value={editedRule.ruleCode} disabled />
            <Input
              label="Rule Name"
              value={editedRule.name}
              onChange={(e) => setEditedRule({ ...editedRule, name: e.target.value })}
            />
            <Select
              label="Trigger Type"
              options={triggerTypeOptions}
              value={editedRule.triggerType}
              onChange={(e) => setEditedRule({ ...editedRule, triggerType: e.target.value as TriggerType })}
            />
            <div>
              <p className="text-sm text-text-secondary mb-1">Source URL</p>
              <p className="text-sm font-mono break-all text-text-muted">{rule.sourceUrl || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary mb-1">Complexity</p>
              <p className="text-lg font-bold">{rule.complexity || '-'}/10</p>
            </div>
            {rule.extractionReasoning && (
              <div>
                <p className="text-sm text-text-secondary mb-1">Extraction Reasoning</p>
                <p className="text-sm text-text-muted">{rule.extractionReasoning}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'deadlines' && (
          <div className="space-y-4">
            {/* Existing Deadlines */}
            <div className="space-y-2">
              {(editedRule.deadlines as Deadline[]).length === 0 ? (
                <p className="text-center text-text-muted py-4">No deadlines defined</p>
              ) : (
                (editedRule.deadlines as Deadline[]).map((deadline) => (
                  <div key={deadline.id} className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg">
                    <Badge
                      variant={
                        deadline.priority === 'FATAL'
                          ? 'error'
                          : deadline.priority === 'URGENT'
                          ? 'warning'
                          : 'info'
                      }
                    >
                      {deadline.daysFromTrigger}d
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{deadline.name}</p>
                      <p className="text-xs text-text-muted truncate">{deadline.actionRequired}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveDeadline(deadline.id)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Add Deadline Form */}
            <div className="p-3 bg-surface-elevated rounded-lg space-y-3">
              <p className="text-sm font-medium">Add Deadline</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Name"
                  value={newDeadline.name}
                  onChange={(e) => setNewDeadline({ ...newDeadline, name: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Days"
                  value={newDeadline.daysFromTrigger}
                  onChange={(e) => setNewDeadline({ ...newDeadline, daysFromTrigger: parseInt(e.target.value) })}
                />
              </div>
              <Select
                options={priorityOptions}
                value={newDeadline.priority}
                onChange={(e) => setNewDeadline({ ...newDeadline, priority: e.target.value as DeadlinePriority })}
              />
              <Input
                placeholder="Action Required"
                value={newDeadline.actionRequired}
                onChange={(e) => setNewDeadline({ ...newDeadline, actionRequired: e.target.value })}
              />
              <Button size="sm" onClick={handleAddDeadline} disabled={!newDeadline.name || !newDeadline.actionRequired}>
                Add Deadline
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'debate' && (
          <div className="space-y-4">
            {swarmDebate ? (
              <>
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <p className="text-sm font-medium mb-2">Debate Summary</p>
                  <p className="text-sm text-text-secondary">{swarmDebate.debateSummary}</p>
                </div>
                <div className="space-y-3">
                  {swarmDebate.agentCritiques.map((critique, i) => (
                    <div key={i} className="p-3 bg-surface-elevated rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">{critique.persona}</span>
                        <Badge
                          variant={
                            critique.confidence >= 80 ? 'success' : critique.confidence >= 60 ? 'warning' : 'error'
                          }
                        >
                          {critique.confidence}%
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-amber-400 mb-1">{critique.position}</p>
                      <p className="text-xs text-text-secondary">{critique.reasoning}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-text-muted py-8">No debate data available for this rule</p>
            )}
          </div>
        )}

        {activeTab === 'raw' && (
          <Textarea
            value={editedRule.rawText || ''}
            onChange={(e) => setEditedRule({ ...editedRule, rawText: e.target.value })}
            className="min-h-[300px] font-mono text-sm"
          />
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border flex gap-2">
        <Button variant="ghost" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleSave} isLoading={isLoading} className="flex-1">
          Save Changes
        </Button>
      </div>
    </div>
  );
}
