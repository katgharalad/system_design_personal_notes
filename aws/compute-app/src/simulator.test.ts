import { describe, expect, it } from 'vitest';
import { defaults, evaluate } from './simulator';

describe('compute decision rules', () => {
  it('flags ordinary Lambda for work over 15 minutes', () => {
    const result = evaluate({ ...defaults, workMinutes: 20 });
    const lambda = result.find((x) => x.name === 'Lambda Event Function')!;
    expect(lambda.cautions.join(' ')).toContain('15-minute limit');
    expect(result[0].name).not.toBe('Lambda Event Function');
  });
  it('prefers Batch for interruptible finite background work', () => {
    const result = evaluate({ ...defaults, background: true, interruptible: true, latency: 'flexible', workMinutes: 40 });
    expect(result[0].name).toBe('AWS Batch');
  });
  it('does not claim exact prices', () => {
    expect(evaluate(defaults).every((x) => x.cautions.some((c) => c.includes('not a cost quote')))).toBe(true);
  });
});
