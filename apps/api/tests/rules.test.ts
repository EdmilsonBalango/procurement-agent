import { describe, expect, it } from 'vitest';
import { canMoveToReadyForReview, isMfaRequired, selectBuyerRoundRobin } from '../src/lib/rules.js';

describe('MFA rule', () => {
  it('requires MFA when lastMfaAt is null', () => {
    expect(isMfaRequired(null)).toBe(true);
  });

  it('does not require MFA within 3 days', () => {
    const recent = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);
    expect(isMfaRequired(recent)).toBe(false);
  });

  it('requires MFA after 3 days', () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 24 * 4);
    expect(isMfaRequired(old)).toBe(true);
  });
});

describe('Ready for review gate', () => {
  it('blocks when fewer than 3 quotes without exception', () => {
    expect(canMoveToReadyForReview({ quotesCount: 2, hasException: false })).toBe(false);
  });

  it('allows when exception approved', () => {
    expect(canMoveToReadyForReview({ quotesCount: 0, hasException: true })).toBe(true);
  });
});

describe('Assign workflow', () => {
  it('selects buyer with lowest workload', () => {
    const buyer = selectBuyerRoundRobin([
      { buyerId: 'buyer-a', count: 4 },
      { buyerId: 'buyer-b', count: 2 },
    ]);
    expect(buyer).toBe('buyer-b');
  });
});
