import { describe, expect, it } from 'vitest';
import { emptyState, validState } from './db';

describe('study backup validation', () => {
  it('accepts a saved study record', () => {
    expect(validState({ ...emptyState(), notes: { workload: 'Measure p95' }, attempts: { C01: { answer: 'Measure load', selfScore: 2, at: '2026-10-27T00:00:00Z' } } })).toBe(true);
  });
  it('rejects malformed imported records', () => {
    expect(validState({ ...emptyState(), notes: { workload: { text: 'wrong shape' } } })).toBe(false);
    expect(validState({ ...emptyState(), attempts: { C01: { answer: 'a', selfScore: 9, at: 'today' } } })).toBe(false);
  });
});
