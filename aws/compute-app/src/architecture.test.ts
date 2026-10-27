import { describe, expect, it } from 'vitest';
import { assessArchitecture } from './architecture';

describe('architecture assessment', () => {
  it('requires both availability zones and a complete request path', () => {
    expect(assessArchitecture([{ id:'c',kind:'client' },{ id:'lb',kind:'alb' },{ id:'a',kind:'app-a' }],[{source:'c',target:'lb'},{source:'lb',target:'a'}])).toContain('Place one app task in each Availability Zone.');
  });
  it('accepts a complete two-zone sketch', () => {
    const nodes = [{id:'c',kind:'client'},{id:'lb',kind:'alb'},{id:'a',kind:'app-a'},{id:'b',kind:'app-b'},{id:'db',kind:'database'}] as const;
    const edges = [{source:'c',target:'lb'},{source:'lb',target:'a'},{source:'lb',target:'b'},{source:'a',target:'db'},{source:'b',target:'db'}];
    expect(assessArchitecture([...nodes],[...edges])).toEqual([]);
  });
});
