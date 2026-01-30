import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { api } from '../../api/client';
import { useUIStore } from '../../store/uiStore';
import type { RuleConflict } from '@rulesharvester/shared';

export function ConflictView() {
  const [conflicts, setConflicts] = useState<RuleConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const { addLog } = useUIStore();

  useEffect(() => {
    fetchConflicts();
  }, []);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      // For now, we'll get conflicts from rules
      // In a full implementation, there would be a dedicated conflicts endpoint
      setConflicts([]);
    } catch (error) {
      addLog('Failed to fetch conflicts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (conflictId: string, resolution: 'accept' | 'override') => {
    try {
      // Would call API to resolve conflict
      setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
      addLog(`Conflict ${resolution === 'accept' ? 'accepted' : 'overridden'}`, 'success');
    } catch (error) {
      addLog('Failed to resolve conflict', 'error');
    }
  };

  const unresolvedConflicts = conflicts.filter((c) => c.status === 'UNRESOLVED');
  const resolvedConflicts = conflicts.filter((c) => c.status !== 'UNRESOLVED');

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Conflict Resolution</h1>
        <p className="text-text-secondary">
          {unresolvedConflicts.length} unresolved conflicts
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-text-muted">Loading conflicts...</p>
          </CardContent>
        </Card>
      ) : unresolvedConflicts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-4">!</div>
            <h2 className="text-xl font-semibold mb-2">All Clear</h2>
            <p className="text-text-secondary">No unresolved conflicts detected</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {unresolvedConflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}

      {/* Resolved History */}
      {resolvedConflicts.length > 0 && (
        <Card>
          <CardHeader>Resolution History</CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resolvedConflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {conflict.ruleACode} vs {conflict.ruleBCode}
                    </p>
                    <p className="text-sm text-text-muted">{conflict.discrepancy}</p>
                  </div>
                  <Badge
                    variant={conflict.status === 'RESOLVED' ? 'success' : 'warning'}
                  >
                    {conflict.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ConflictCardProps {
  conflict: RuleConflict;
  onResolve: (id: string, resolution: 'accept' | 'override') => void;
}

function ConflictCard({ conflict, onResolve }: ConflictCardProps) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="error">Conflict</Badge>
              <span className="text-sm text-text-muted">
                {conflict.ruleACode} vs {conflict.ruleBCode}
              </span>
            </div>
            <h3 className="font-semibold">{conflict.discrepancy}</h3>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-surface-elevated rounded-lg">
            <p className="text-sm font-medium text-text-secondary mb-1">Rule A</p>
            <p className="font-mono text-sm">{conflict.ruleACode}</p>
          </div>
          <div className="p-3 bg-surface-elevated rounded-lg">
            <p className="text-sm font-medium text-text-secondary mb-1">Rule B</p>
            <p className="font-mono text-sm">{conflict.ruleBCode}</p>
          </div>
        </div>

        <div className="p-3 bg-purple-500/10 rounded-lg mb-4">
          <p className="text-sm font-medium text-purple-400 mb-1">AI Recommendation</p>
          <p className="text-sm text-text-secondary">{conflict.aiResolutionRecommendation}</p>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => onResolve(conflict.id, 'override')}
          >
            Manual Override
          </Button>
          <Button onClick={() => onResolve(conflict.id, 'accept')}>
            Accept Recommendation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
