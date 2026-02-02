import { prisma } from '../../index.js';
import { InboxItemType, InboxStatus } from '@rulesharvester/shared';
import type { InboxItem, InboxStats } from '@rulesharvester/shared';
import { sseManager } from '../sse/sseManager.js';
import { logger } from '../../utils/logger.js';

interface CreateInboxItemData {
  type: InboxItemType;
  title: string;
  description?: string;
  jurisdictionId?: string;
  ruleId?: string;
  conflictId?: string;
  confidence?: number;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

interface InboxFilters {
  type?: InboxItemType;
  status?: InboxStatus;
}

interface PaginationOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'confidence';
  sortOrder?: 'asc' | 'desc';
}

class InboxService {
  /**
   * Create a new inbox item
   */
  async createItem(data: CreateInboxItemData): Promise<InboxItem> {
    const item = await prisma.inboxItem.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        jurisdictionId: data.jurisdictionId,
        ruleId: data.ruleId,
        conflictId: data.conflictId,
        confidence: data.confidence,
        sourceUrl: data.sourceUrl,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
      },
    });

    const result = this.mapToInboxItem(item);

    // Send SSE event
    sseManager.sendInboxItemCreated(result);
    logger.info(`Inbox: Created ${data.type} item: ${data.title}`);

    return result;
  }

  /**
   * Create a jurisdiction approval inbox item
   */
  async createJurisdictionApprovalItem(
    jurisdictionId: string,
    name: string,
    confidence: number,
    sourceUrl?: string,
    metadata?: Record<string, unknown>
  ): Promise<InboxItem> {
    return this.createItem({
      type: InboxItemType.JURISDICTION_APPROVAL,
      title: `New jurisdiction discovered: ${name}`,
      description: `A new jurisdiction has been discovered and needs approval before harvesting can begin.`,
      jurisdictionId,
      confidence,
      sourceUrl,
      metadata,
    });
  }

  /**
   * Create a rule verification inbox item
   */
  async createRuleVerificationItem(
    ruleId: string,
    ruleName: string,
    confidence: number,
    sourceUrl?: string,
    metadata?: Record<string, unknown>
  ): Promise<InboxItem> {
    return this.createItem({
      type: InboxItemType.RULE_VERIFICATION,
      title: `Rule needs verification: ${ruleName}`,
      description: `This rule was extracted with ${confidence.toFixed(0)}% confidence and requires human review.`,
      ruleId,
      confidence,
      sourceUrl,
      metadata,
    });
  }

  /**
   * Create a watchtower change inbox item
   */
  async createWatchtowerChangeItem(
    ruleId: string,
    ruleName: string,
    jurisdictionId: string,
    metadata?: Record<string, unknown>
  ): Promise<InboxItem> {
    return this.createItem({
      type: InboxItemType.WATCHTOWER_CHANGE,
      title: `Rule change detected: ${ruleName}`,
      description: `The watchtower detected changes to this rule. Please review the changes.`,
      ruleId,
      jurisdictionId,
      metadata,
    });
  }

  /**
   * Create a scraper failure inbox item
   */
  async createScraperFailureItem(
    jurisdictionId: string,
    jurisdictionName: string,
    error: string,
    metadata?: Record<string, unknown>
  ): Promise<InboxItem> {
    return this.createItem({
      type: InboxItemType.SCRAPER_FAILURE,
      title: `Scraper failed: ${jurisdictionName}`,
      description: `The scraper failed after multiple attempts and self-healing. Error: ${error}`,
      jurisdictionId,
      metadata: {
        ...metadata,
        error,
      },
    });
  }

  /**
   * Get inbox items with filtering and pagination
   */
  async getItems(
    filters: InboxFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<{
    items: InboxItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 20;
    const sortBy = pagination.sortBy || 'createdAt';
    const sortOrder = pagination.sortOrder || 'desc';

    const where: Record<string, unknown> = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    const [items, total] = await Promise.all([
      prisma.inboxItem.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.inboxItem.count({ where }),
    ]);

    return {
      items: items.map(this.mapToInboxItem),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get a single inbox item by ID
   */
  async getItem(id: string): Promise<InboxItem | null> {
    const item = await prisma.inboxItem.findUnique({
      where: { id },
    });

    return item ? this.mapToInboxItem(item) : null;
  }

  /**
   * Approve an inbox item
   */
  async approveItem(
    id: string,
    reviewedBy: string = 'system'
  ): Promise<InboxItem> {
    const item = await prisma.inboxItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new Error('Inbox item not found');
    }

    if (item.status !== InboxStatus.PENDING) {
      throw new Error('Inbox item is not pending');
    }

    const updated = await prisma.inboxItem.update({
      where: { id },
      data: {
        status: InboxStatus.REVIEWED,
        resolution: 'approved',
        reviewedAt: new Date(),
        reviewedBy,
      },
    });

    const result = this.mapToInboxItem(updated);
    sseManager.sendInboxItemUpdated(result);
    logger.info(`Inbox: Approved item ${id}`);

    return result;
  }

  /**
   * Reject an inbox item
   */
  async rejectItem(
    id: string,
    reason?: string,
    reviewedBy: string = 'system'
  ): Promise<InboxItem> {
    const item = await prisma.inboxItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new Error('Inbox item not found');
    }

    if (item.status !== InboxStatus.PENDING) {
      throw new Error('Inbox item is not pending');
    }

    const updated = await prisma.inboxItem.update({
      where: { id },
      data: {
        status: InboxStatus.REVIEWED,
        resolution: 'rejected',
        reviewedAt: new Date(),
        reviewedBy,
        metadata: {
          ...(item.metadata as Record<string, unknown> || {}),
          rejectionReason: reason,
        },
      },
    });

    const result = this.mapToInboxItem(updated);
    sseManager.sendInboxItemUpdated(result);
    logger.info(`Inbox: Rejected item ${id}: ${reason}`);

    return result;
  }

  /**
   * Defer an inbox item for later review
   */
  async deferItem(id: string, reviewedBy: string = 'system'): Promise<InboxItem> {
    const item = await prisma.inboxItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new Error('Inbox item not found');
    }

    if (item.status !== InboxStatus.PENDING) {
      throw new Error('Inbox item is not pending');
    }

    const updated = await prisma.inboxItem.update({
      where: { id },
      data: {
        status: InboxStatus.DEFERRED,
        resolution: 'deferred',
        reviewedAt: new Date(),
        reviewedBy,
      },
    });

    const result = this.mapToInboxItem(updated);
    sseManager.sendInboxItemUpdated(result);
    logger.info(`Inbox: Deferred item ${id}`);

    return result;
  }

  /**
   * Bulk approve multiple inbox items
   */
  async bulkApprove(
    ids: string[],
    reviewedBy: string = 'system'
  ): Promise<{ approved: number; failed: number }> {
    let approved = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        await this.approveItem(id, reviewedBy);
        approved++;
      } catch (error) {
        logger.error(`Inbox: Failed to approve ${id}`, { error: error instanceof Error ? error.message : String(error) });
        failed++;
      }
    }

    return { approved, failed };
  }

  /**
   * Bulk reject multiple inbox items
   */
  async bulkReject(
    ids: string[],
    reason?: string,
    reviewedBy: string = 'system'
  ): Promise<{ rejected: number; failed: number }> {
    let rejected = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        await this.rejectItem(id, reason, reviewedBy);
        rejected++;
      } catch (error) {
        logger.error(`Inbox: Failed to reject ${id}`, { error: error instanceof Error ? error.message : String(error) });
        failed++;
      }
    }

    return { rejected, failed };
  }

  /**
   * Get inbox statistics
   */
  async getStats(): Promise<InboxStats> {
    const [total, pending, reviewed, deferred, byType] = await Promise.all([
      prisma.inboxItem.count(),
      prisma.inboxItem.count({ where: { status: InboxStatus.PENDING } }),
      prisma.inboxItem.count({ where: { status: InboxStatus.REVIEWED } }),
      prisma.inboxItem.count({ where: { status: InboxStatus.DEFERRED } }),
      Promise.all([
        prisma.inboxItem.count({
          where: { type: InboxItemType.JURISDICTION_APPROVAL, status: InboxStatus.PENDING },
        }),
        prisma.inboxItem.count({
          where: { type: InboxItemType.RULE_VERIFICATION, status: InboxStatus.PENDING },
        }),
        prisma.inboxItem.count({
          where: { type: InboxItemType.WATCHTOWER_CHANGE, status: InboxStatus.PENDING },
        }),
        prisma.inboxItem.count({
          where: { type: InboxItemType.SCRAPER_FAILURE, status: InboxStatus.PENDING },
        }),
      ]),
    ]);

    return {
      total,
      pending,
      reviewed,
      deferred,
      byType: {
        [InboxItemType.JURISDICTION_APPROVAL]: byType[0],
        [InboxItemType.RULE_VERIFICATION]: byType[1],
        [InboxItemType.WATCHTOWER_CHANGE]: byType[2],
        [InboxItemType.SCRAPER_FAILURE]: byType[3],
      },
    };
  }

  /**
   * Check if an inbox item already exists for a given entity
   */
  async existsForEntity(
    type: InboxItemType,
    entityId: string,
    status: InboxStatus = InboxStatus.PENDING
  ): Promise<boolean> {
    const field =
      type === InboxItemType.JURISDICTION_APPROVAL || type === InboxItemType.SCRAPER_FAILURE
        ? 'jurisdictionId'
        : type === InboxItemType.RULE_VERIFICATION || type === InboxItemType.WATCHTOWER_CHANGE
          ? 'ruleId'
          : null;

    if (!field) return false;

    const existing = await prisma.inboxItem.findFirst({
      where: {
        type,
        [field]: entityId,
        status,
      },
    });

    return existing !== null;
  }

  /**
   * Map Prisma result to InboxItem type
   */
  private mapToInboxItem(item: {
    id: string;
    type: string;
    status: string;
    title: string;
    description: string | null;
    jurisdictionId: string | null;
    ruleId: string | null;
    conflictId: string | null;
    confidence: number | null;
    sourceUrl: string | null;
    metadata: unknown;
    createdAt: Date;
    reviewedAt: Date | null;
    reviewedBy: string | null;
    resolution: string | null;
  }): InboxItem {
    return {
      id: item.id,
      type: item.type as InboxItemType,
      status: item.status as InboxStatus,
      title: item.title,
      description: item.description ?? undefined,
      jurisdictionId: item.jurisdictionId ?? undefined,
      ruleId: item.ruleId ?? undefined,
      conflictId: item.conflictId ?? undefined,
      confidence: item.confidence ?? undefined,
      sourceUrl: item.sourceUrl ?? undefined,
      metadata: (item.metadata as Record<string, unknown>) || undefined,
      createdAt: item.createdAt,
      reviewedAt: item.reviewedAt ?? undefined,
      reviewedBy: item.reviewedBy ?? undefined,
      resolution: item.resolution as 'approved' | 'rejected' | 'deferred' | undefined,
    };
  }
}

export const inboxService = new InboxService();
