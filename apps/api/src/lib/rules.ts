import dayjs from 'dayjs';

export const MFA_VALIDITY_DAYS = 3;

export function isMfaRequired(lastMfaAt?: Date | null) {
  if (!lastMfaAt) {
    return true;
  }
  return dayjs().diff(dayjs(lastMfaAt), 'day') >= MFA_VALIDITY_DAYS;
}

export function canMoveToReadyForReview({
  quotesCount,
  hasException,
}: {
  quotesCount: number;
  hasException: boolean;
}) {
  return quotesCount >= 1 || hasException;
}

export function selectBuyerRoundRobin(
  workloads: { buyerId: string; count: number }[],
) {
  if (workloads.length === 0) {
    return null;
  }
  const sorted = [...workloads].sort((a, b) => a.count - b.count);
  return sorted[0]?.buyerId ?? null;
}
