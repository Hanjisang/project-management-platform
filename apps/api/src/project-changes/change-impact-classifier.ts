export type ChangeImpact = {
  classification: 'DIRECT_ADJUSTMENT' | 'REQUIRES_CHANGE_REQUEST';
  changeRate: number;
  reasons: string[];
};

const DAY = 86_400_000;
export function classifyProjectChange(input: {
  baselineStart: Date;
  baselineCompletion: Date;
  proposedCompletion?: Date;
  scopeChange?: boolean;
}): ChangeImpact {
  const baselineDuration =
    (input.baselineCompletion.getTime() - input.baselineStart.getTime()) / DAY;
  if (baselineDuration <= 0) throw new Error('PROJECT_BASELINE_REQUIRED');
  const reasons: string[] = [];
  let changeRate = 0;
  if (input.proposedCompletion) {
    const proposedDuration =
      (input.proposedCompletion.getTime() - input.baselineStart.getTime()) / DAY;
    changeRate = ((proposedDuration - baselineDuration) / baselineDuration) * 100;
    if (Math.abs(changeRate) > 20) reasons.push('总体完成时间相对批准基线变化超过 ±20%');
  }
  if (input.scopeChange) reasons.push('变更涉及正式项目范围');
  return {
    classification: reasons.length ? 'REQUIRES_CHANGE_REQUEST' : 'DIRECT_ADJUSTMENT',
    changeRate: Number(changeRate.toFixed(4)),
    reasons,
  };
}
