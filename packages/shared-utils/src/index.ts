export interface WeightedItem {
  id: string;
  weight: number;
  progress: number;
}

export function normalizeWeights<T extends { id: string; durationDays: number }>(
  items: T[],
): Array<T & { weight: number }> {
  if (items.length === 0) return [];
  const durations = items.map((item) =>
    Number.isFinite(item.durationDays) ? Math.max(0, item.durationDays) : 0,
  );
  const total = durations.reduce((sum, value) => sum + value, 0);
  const basis = total > 0 ? durations : items.map(() => 1);
  const basisTotal = basis.reduce((sum, value) => sum + value, 0);
  const exact = basis.map((value) => (value / basisTotal) * 100);
  const floors = exact.map(Math.floor);
  const remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - floors[index]! }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; i < remainder; i += 1) floors[order[i]!.index]! += 1;
  return items.map((item, index) => ({ ...item, weight: floors[index]! }));
}

export function calculateWeightedProgress(items: WeightedItem[]): number {
  if (items.length === 0) return 0;
  const weightTotal = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (weightTotal === 0)
    return Math.round(
      items.reduce((sum, item) => sum + clampProgress(item.progress), 0) / items.length,
    );
  return Math.round(
    items.reduce(
      (sum, item) => sum + clampProgress(item.progress) * (Math.max(0, item.weight) / weightTotal),
      0,
    ),
  );
}

export function calculateChecklistProgress(items: Array<{ completed: boolean }>): number {
  if (items.length === 0) return 0;
  return Math.round((items.filter((item) => item.completed).length / items.length) * 100);
}
export function clampProgress(progress: number): number {
  return Math.min(100, Math.max(0, Math.round(progress)));
}
export function calculateRiskScore(probability: number, impact: number): number {
  return (
    Math.min(5, Math.max(1, Math.round(probability))) * Math.min(5, Math.max(1, Math.round(impact)))
  );
}
export function deriveProjectHealth(input: {
  overdueTaskCount: number;
  criticalIssueCount: number;
  highIssueCount: number;
  maxRiskScore: number;
}): 'NORMAL' | 'WARNING' | 'HIGH_RISK' {
  if (input.criticalIssueCount > 0 || input.maxRiskScore >= 20 || input.overdueTaskCount >= 5)
    return 'HIGH_RISK';
  if (input.highIssueCount > 0 || input.maxRiskScore >= 12 || input.overdueTaskCount > 0)
    return 'WARNING';
  return 'NORMAL';
}

export const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Shanghai';

/** Returns the current business day as a UTC-midnight Date suitable for Prisma DATE columns. */
export function businessToday(now = new Date(), timeZone = DEFAULT_BUSINESS_TIME_ZONE): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)));
}

export function addBusinessDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
}

/** Converts a date-only value to the UTC instant at which that business day starts. */
export function businessDayStartInstant(date: Date, timeZone = DEFAULT_BUSINESS_TIME_ZONE): Date {
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const candidate = new Date(target);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(candidate);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const rendered = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second),
  );
  return new Date(target + (target - rendered));
}

export function businessDayEndInstant(date: Date, timeZone = DEFAULT_BUSINESS_TIME_ZONE): Date {
  return new Date(businessDayStartInstant(addBusinessDays(date, 1), timeZone).getTime() - 1);
}
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(',')}}`;
}
