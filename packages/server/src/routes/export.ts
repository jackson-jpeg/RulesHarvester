import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { prisma } from '../index.js';
import { convertToCSV, convertToYAML } from '../utils/formatters.js';
import type { ExportData, JurisdictionExport } from '../utils/formatters.js';

const router = Router();

type ExportFormat = 'json' | 'csv' | 'yaml';

interface ExportQuery {
  format?: ExportFormat;
  jurisdictions?: string; // comma-separated IDs
  includeMetadata?: string;
  includeRaw?: string;
}

// GET /api/export - Export rules data
router.get('/', async (req: Request<unknown, unknown, unknown, ExportQuery>, res: Response) => {
  try {
    const {
      format = 'json',
      jurisdictions: jurisdictionFilter,
      includeMetadata = 'true',
      includeRaw = 'false',
    } = req.query;

    const includeMetadataBool = includeMetadata === 'true';
    const includeRawBool = includeRaw === 'true';
    const jurisdictionIds = jurisdictionFilter ? jurisdictionFilter.split(',') : undefined;

    // Build where clause for rules
    const whereClause = jurisdictionIds
      ? { jurisdictionId: { in: jurisdictionIds } }
      : {};

    // Fetch rules with pagination for memory efficiency
    const BATCH_SIZE = 100;
    let allRules: Array<{
      id: string;
      ruleCode: string;
      name: string;
      triggerType: string;
      deadlines: unknown;
      relatedRules: unknown;
      confidenceScore: number;
      complexity: number | null;
      riskProfile: unknown;
      swarmDebate: unknown;
      sourceUrl: string | null;
      rawText: string | null;
      jurisdictionId: string;
    }> = [];

    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await prisma.rule.findMany({
        where: whereClause,
        select: {
          id: true,
          ruleCode: true,
          name: true,
          triggerType: true,
          deadlines: true,
          relatedRules: true,
          confidenceScore: true,
          complexity: true,
          riskProfile: includeMetadataBool,
          swarmDebate: includeMetadataBool,
          sourceUrl: true,
          rawText: includeRawBool,
          jurisdictionId: true,
        },
        skip,
        take: BATCH_SIZE,
        orderBy: { createdAt: 'desc' },
      });

      allRules = allRules.concat(batch);
      skip += BATCH_SIZE;
      hasMore = batch.length === BATCH_SIZE;
    }

    // Get unique jurisdiction IDs from rules
    const uniqueJurisdictionIds = [...new Set(allRules.map(r => r.jurisdictionId))];

    // Fetch jurisdictions
    const jurisdictionsData = await prisma.jurisdiction.findMany({
      where: { id: { in: uniqueJurisdictionIds } },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        dna: includeMetadataBool,
      },
    });

    // Group rules by jurisdiction
    const rulesByJurisdiction = allRules.reduce<Record<string, typeof allRules>>((acc, rule) => {
      if (!acc[rule.jurisdictionId]) {
        acc[rule.jurisdictionId] = [];
      }
      acc[rule.jurisdictionId].push(rule);
      return acc;
    }, {});

    // Build export data
    const jurisdictionExports: JurisdictionExport[] = jurisdictionsData.map(j => ({
      id: j.id,
      code: j.code,
      name: j.name,
      type: j.type,
      ...(includeMetadataBool && j.dna ? { dna: j.dna } : {}),
      rule_sets: (rulesByJurisdiction[j.id] || []).map(r => ({
        rule_code: r.ruleCode,
        name: r.name,
        trigger_type: r.triggerType,
        deadlines: r.deadlines,
        related_rules: r.relatedRules,
        confidence_score: r.confidenceScore,
        complexity: r.complexity || undefined,
        ...(includeMetadataBool && r.riskProfile ? { risk_profile: r.riskProfile } : {}),
        ...(includeMetadataBool && r.swarmDebate ? { swarm_debate: r.swarmDebate } : {}),
        source_url: r.sourceUrl,
        ...(includeRawBool ? { raw_text: r.rawText } : {}),
      })),
    }));

    // Calculate SHA-256 integrity hash of full content
    const dataForHash = JSON.stringify(jurisdictionExports);
    const integrityHash = createHash('sha256').update(dataForHash).digest('hex');

    const exportData: ExportData = {
      system_metadata: {
        version: '2.0.0',
        engine: 'RulesHarvester',
        ai_model: 'claude-sonnet-4-20250514',
        export_date: new Date().toISOString(),
        integrity_hash: integrityHash,
        node_count: allRules.length,
        jurisdiction_count: jurisdictionExports.length,
      },
      jurisdictions: jurisdictionExports,
    };

    // Log export to system log
    await prisma.systemLog.create({
      data: {
        type: 'INFO',
        message: `Export generated: ${allRules.length} rules, ${jurisdictionExports.length} jurisdictions, format: ${format}`,
        metadata: {
          format,
          ruleCount: allRules.length,
          jurisdictionCount: jurisdictionExports.length,
          integrityHash,
          includeMetadata: includeMetadataBool,
          includeRaw: includeRawBool,
          timestamp: new Date().toISOString(),
        },
      },
    });

    // Format and respond based on requested format
    switch (format) {
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="rulesharvester-export-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(convertToCSV(exportData));
        break;

      case 'yaml':
        res.setHeader('Content-Type', 'text/yaml');
        res.setHeader('Content-Disposition', `attachment; filename="rulesharvester-export-${new Date().toISOString().split('T')[0]}.yaml"`);
        res.send(convertToYAML(exportData));
        break;

      default:
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="rulesharvester-export-${new Date().toISOString().split('T')[0]}.json"`);
        // Use streaming for large exports
        if (allRules.length > 500) {
          res.write(JSON.stringify(exportData, null, 2));
          res.end();
        } else {
          res.json({ success: true, data: exportData });
        }
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
});

export { router as exportRouter };
