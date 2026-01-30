import { useState } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { useRulesStore } from '../../store/rulesStore';
import { useUIStore } from '../../store/uiStore';
import { TRIGGER_TYPE_LABELS, PRIORITY_COLORS } from '@rulesharvester/shared';
import type { Deadline, DeadlinePriority, TriggerType } from '@rulesharvester/shared';

const triggerTypeOptions = Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const priorityOptions = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'FATAL', label: 'Fatal' },
];

export function VerificationView() {
  const { selectedRule, updateRule, isLoading, clearSelectedRule } = useRulesStore();
  const { setActiveTab, addLog } = useUIStore();

  const [activeTab, setTabActive] = useState<'details' | 'deadlines' | 'debate' | 'raw'>('details');
  const [editedRule, setEditedRule] = useState(selectedRule);
  const [newDeadline, setNewDeadline] = useState({
    name: '',
    daysFromTrigger: 0,
    priority: 'STANDARD' as DeadlinePriority,
    actionRequired: '',
  });

  if (!selectedRule) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Rule Selected</h2>
          <p className="text-text-secondary mb-4">Select a rule from the library to verify</p>
          <Button onClick={() => setActiveTab('library')}>Go to Library</Button>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!editedRule) return;

    try {
      await updateRule(selectedRule.id, {
        name: editedRule.name,
        triggerType: editedRule.triggerType,
        deadlines: editedRule.deadlines,
        relatedRules: editedRule.relatedRules,
        rawText: editedRule.rawText,
      });
      addLog('Rule updated successfully', 'success');
    } catch {
      addLog('Failed to update rule', 'error');
    }
  };

  const handleAddDeadline = () => {
    if (!newDeadline.name || !newDeadline.actionRequired) return;

    const deadline: Deadline = {
      id: `deadline-${Date.now()}`,
      ...newDeadline,
    };

    setEditedRule((prev) =>
      prev
        ? {
            ...prev,
            deadlines: [...(prev.deadlines as Deadline[]), deadline],
          }
        : null
    );

    setNewDeadline({
      name: '',
      daysFromTrigger: 0,
      priority: 'STANDARD',
      actionRequired: '',
    });
  };

  const handleRemoveDeadline = (id: string) => {
    setEditedRule((prev) =>
      prev
        ? {
            ...prev,
            deadlines: (prev.deadlines as Deadline[]).filter((d) => d.id !== id),
          }
        : null
    );
  };

  const riskProfile = selectedRule.riskProfile as { sanctionProbability: number; administrativeFriction: number } | undefined;
  const swarmDebate = selectedRule.swarmDebate as { consensusScore: number; debateSummary: string; agentCritiques: Array<{ persona: string; position: string; reasoning: string; confidence: number }> } | undefined;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Badge variant="info">{selectedRule.ruleCode}</Badge>
            <Badge
              variant={
                selectedRule.confidenceScore >= 80
                  ? 'success'
                  : selectedRule.confidenceScore >= 60
                  ? 'warning'
                  : 'error'
              }
            >
              {selectedRule.confidenceScore}% confidence
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">{selectedRule.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => { clearSelectedRule(); setActiveTab('library'); }}>
            Back to Library
          </Button>
          <Button onClick={handleSave} isLoading={isLoading}>
            Save Changes
          </Button>
        </div>
      </div>

      {/* Risk Summary */}
      {riskProfile && (
        <Card padding="sm">
          <CardContent className="flex items-center gap-6">
            <div>
              <p className="text-xs text-text-muted">Sanction Probability</p>
              <p className={`text-2xl font-bold ${
                riskProfile.sanctionProbability >= 70
                  ? 'text-rose-400'
                  : riskProfile.sanctionProbability >= 40
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}>
                {riskProfile.sanctionProbability}%
              </p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div>
              <p className="text-xs text-text-muted">Administrative Friction</p>
              <p className="text-2xl font-bold text-blue-400">
                {riskProfile.administrativeFriction}/10
              </p>
            </div>
            <div className="w-px h-12 bg-border" />
            <div>
              <p className="text-xs text-text-muted">Swarm Consensus</p>
              <p className="text-2xl font-bold text-purple-400">
                {swarmDebate?.consensusScore || 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['details', 'deadlines', 'debate', 'raw'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setTabActive(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && editedRule && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>Basic Information</CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Rule Code"
                value={editedRule.ruleCode}
                disabled
              />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>Extraction Details</CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-text-secondary">Source URL</p>
                <p className="text-sm font-mono break-all">
                  {selectedRule.sourceUrl || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Complexity</p>
                <p className="text-lg font-bold">{selectedRule.complexity || '-'}/10</p>
              </div>
              <div>
                <p className="text-sm text-text-secondary">Extraction Reasoning</p>
                <p className="text-sm text-text-muted">
                  {selectedRule.extractionReasoning || 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'deadlines' && editedRule && (
        <div className="space-y-6">
          {/* Existing Deadlines */}
          <Card>
            <CardHeader>Deadlines ({(editedRule.deadlines as Deadline[]).length})</CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(editedRule.deadlines as Deadline[]).map((deadline) => (
                  <div
                    key={deadline.id}
                    className="flex items-center gap-4 p-3 bg-surface-elevated rounded-lg"
                  >
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
                    <div className="flex-1">
                      <p className="font-medium">{deadline.name}</p>
                      <p className="text-sm text-text-muted">{deadline.actionRequired}</p>
                    </div>
                    <Badge variant={deadline.priority === 'FATAL' ? 'error' : deadline.priority === 'URGENT' ? 'warning' : 'default'}>
                      {deadline.priority}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDeadline(deadline.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                {(editedRule.deadlines as Deadline[]).length === 0 && (
                  <p className="text-center text-text-muted py-4">No deadlines defined</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Deadline */}
          <Card>
            <CardHeader>Add Deadline</CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <Input
                  label="Name"
                  value={newDeadline.name}
                  onChange={(e) => setNewDeadline({ ...newDeadline, name: e.target.value })}
                  placeholder="Response deadline"
                />
                <Input
                  label="Days"
                  type="number"
                  value={newDeadline.daysFromTrigger}
                  onChange={(e) => setNewDeadline({ ...newDeadline, daysFromTrigger: parseInt(e.target.value) })}
                />
                <Select
                  label="Priority"
                  options={priorityOptions}
                  value={newDeadline.priority}
                  onChange={(e) => setNewDeadline({ ...newDeadline, priority: e.target.value as DeadlinePriority })}
                />
                <div className="flex items-end">
                  <Button onClick={handleAddDeadline}>Add</Button>
                </div>
              </div>
              <div className="mt-4">
                <Input
                  label="Action Required"
                  value={newDeadline.actionRequired}
                  onChange={(e) => setNewDeadline({ ...newDeadline, actionRequired: e.target.value })}
                  placeholder="File response or motion for extension"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'debate' && swarmDebate && (
        <div className="space-y-6">
          <Card>
            <CardHeader>Debate Summary</CardHeader>
            <CardContent>
              <p className="text-text-secondary">{swarmDebate.debateSummary}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            {swarmDebate.agentCritiques.map((critique, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span>{critique.persona}</span>
                    <Badge variant={critique.confidence >= 80 ? 'success' : critique.confidence >= 60 ? 'warning' : 'error'}>
                      {critique.confidence}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="font-medium mb-2">{critique.position}</p>
                  <p className="text-sm text-text-secondary">{critique.reasoning}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'raw' && (
        <Card>
          <CardHeader>Raw Rule Text</CardHeader>
          <CardContent>
            <Textarea
              value={editedRule?.rawText || ''}
              onChange={(e) => setEditedRule(editedRule ? { ...editedRule, rawText: e.target.value } : null)}
              className="min-h-[400px] font-mono text-sm"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
