import Fuse from 'fuse.js';
import { prisma } from '../index.js';

/**
 * Rule deduplication utilities to prevent duplicate rules from being created
 * Uses both normalized code matching and fuzzy name matching
 */

interface RuleForDedup {
  id: string;
  ruleCode: string;
  name: string;
  jurisdictionId: string;
}

/**
 * Normalize a rule code for comparison
 * Converts variations like "Rule 1.0", "Local Rule 1-1", "RULE 1" to a canonical form
 *
 * Examples:
 * - "Rule 1.0" -> "rule1"
 * - "Local Rule 1-1" -> "localrule11"
 * - "Civil Rule 3.1" -> "civilrule31"
 * - "FRCP 12(b)(6)" -> "frcp12b6"
 */
export function normalizeRuleCode(code: string): string {
  return (
    code
      .toLowerCase()
      // Remove all whitespace
      .replace(/\s+/g, '')
      // Remove separators (., -, _)
      .replace(/[.\-_]/g, '')
      // Remove parentheses but keep content
      .replace(/[()]/g, '')
      // Remove trailing .0 or .00 (e.g., "1.0" -> "1")
      .replace(/0+$/, '')
      // Normalize common prefixes
      .replace(/^localrule/i, 'localrule')
      .replace(/^civilrule/i, 'civilrule')
      .replace(/^criminalrule/i, 'criminalrule')
      .replace(/^appellaterule/i, 'appellaterule')
  );
}

/**
 * Check if two rule codes are effectively the same after normalization
 */
export function areRuleCodesEquivalent(code1: string, code2: string): boolean {
  return normalizeRuleCode(code1) === normalizeRuleCode(code2);
}

/**
 * Find potential duplicate rules in the database
 * Uses both exact normalized code matching and fuzzy name matching
 *
 * @param ruleCode - The rule code to check
 * @param jurisdictionId - The jurisdiction to search within
 * @param name - The rule name for fuzzy matching
 * @returns Array of potential duplicate rules, sorted by similarity
 */
export async function findPotentialDuplicates(
  ruleCode: string,
  jurisdictionId: string,
  name: string
): Promise<{
  exactMatches: RuleForDedup[];
  fuzzyMatches: RuleForDedup[];
  isDuplicate: boolean;
}> {
  // Fetch existing rules for this jurisdiction
  const existingRules = await prisma.rule.findMany({
    where: { jurisdictionId },
    select: {
      id: true,
      ruleCode: true,
      name: true,
      jurisdictionId: true,
    },
  });

  const normalizedNewCode = normalizeRuleCode(ruleCode);

  // Find exact code matches (after normalization)
  const exactMatches = existingRules.filter((rule) =>
    areRuleCodesEquivalent(rule.ruleCode, ruleCode)
  );

  // Find fuzzy name matches using Fuse.js
  const fuse = new Fuse(existingRules, {
    keys: ['name', 'ruleCode'],
    threshold: 0.4, // 0 = exact, 1 = matches anything
    includeScore: true,
  });

  const fuzzyResults = fuse.search(name);

  // Filter out exact matches from fuzzy results and sort by score
  const fuzzyMatches = fuzzyResults
    .filter(
      (result) =>
        !exactMatches.some((exact) => exact.id === result.item.id) &&
        result.score !== undefined &&
        result.score < 0.4
    )
    .map((result) => result.item);

  return {
    exactMatches,
    fuzzyMatches,
    isDuplicate: exactMatches.length > 0,
  };
}

/**
 * Check if a rule should be created or if it's a duplicate
 * Returns the existing rule ID if it's a duplicate, or null if it's new
 *
 * @param ruleCode - The rule code to check
 * @param jurisdictionId - The jurisdiction to search within
 * @param name - The rule name for fuzzy matching
 * @returns Object with isDuplicate flag and optional existingRuleId
 */
export async function checkForDuplicate(
  ruleCode: string,
  jurisdictionId: string,
  name: string
): Promise<{
  isDuplicate: boolean;
  existingRuleId?: string;
  matchType?: 'exact' | 'fuzzy';
  similarRules: RuleForDedup[];
}> {
  const { exactMatches, fuzzyMatches, isDuplicate } = await findPotentialDuplicates(
    ruleCode,
    jurisdictionId,
    name
  );

  if (exactMatches.length > 0) {
    return {
      isDuplicate: true,
      existingRuleId: exactMatches[0].id,
      matchType: 'exact',
      similarRules: [...exactMatches, ...fuzzyMatches],
    };
  }

  // For fuzzy matches, we flag but don't block
  // Let the caller decide whether to proceed
  return {
    isDuplicate: false,
    similarRules: fuzzyMatches,
  };
}

/**
 * Generate a unique rule code by appending a version suffix
 * Useful when updating a rule rather than creating a duplicate
 *
 * @param baseCode - The base rule code
 * @param jurisdictionId - The jurisdiction to check within
 * @returns A unique rule code (e.g., "Rule 1" -> "Rule 1-v2")
 */
export async function generateUniqueRuleCode(
  baseCode: string,
  jurisdictionId: string
): Promise<string> {
  const existingRules = await prisma.rule.findMany({
    where: {
      jurisdictionId,
      ruleCode: {
        startsWith: baseCode,
      },
    },
    select: { ruleCode: true },
  });

  if (existingRules.length === 0) {
    return baseCode;
  }

  // Find the highest version number
  let maxVersion = 1;
  const versionPattern = new RegExp(`^${escapeRegex(baseCode)}(?:-v(\\d+))?$`);

  for (const rule of existingRules) {
    const match = rule.ruleCode.match(versionPattern);
    if (match) {
      const version = match[1] ? parseInt(match[1], 10) : 1;
      maxVersion = Math.max(maxVersion, version);
    }
  }

  return `${baseCode}-v${maxVersion + 1}`;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
