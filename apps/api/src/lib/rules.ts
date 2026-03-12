export function canMoveToReadyForReview({
  quotesCount,
  hasException,
}: {
  quotesCount: number;
  hasException: boolean;
}) {
  return quotesCount >= 1 || hasException;
}

export function selectBuyerRoundRobin(workloads: Array<{ buyerId: string; count: number }>) {
  if (workloads.length === 0) {
    return null;
  }

  const sorted = [...workloads].sort((a, b) => a.count - b.count);
  return sorted[0]?.buyerId ?? null;
}
