export interface ExpectedIssue {
  photocardKey: string;
  keyHash: string;
  tokenId: string;
  to: string;
}

export type ReceiptIssueEvent =
  | { kind: 'ISSUED'; keyHash: string; tokenId: string; to: string }
  | { kind: 'SKIPPED'; keyHash: string };

export interface HistoricalIssue {
  keyHash: string;
  tokenId: string;
  to: string;
  txHash: string;
}

export interface IssueOutcome {
  photocardKey: string;
  tokenId: string;
  status: 'MINTED' | 'FAILED';
  failureCode: string | null;
  txHash: string | null;
}

function sameIssue(expected: ExpectedIssue, actual: { tokenId: string; to: string }): boolean {
  return expected.tokenId === actual.tokenId && expected.to.toLowerCase() === actual.to.toLowerCase();
}

export async function classifyIssueReceipt(
  expected: ExpectedIssue[],
  events: ReceiptIssueEvent[],
  findHistorical: (photocardKey: string) => Promise<HistoricalIssue | null>,
): Promise<IssueOutcome[]> {
  const byHash = new Map<string, ReceiptIssueEvent[]>();
  for (const event of events) {
    const key = event.keyHash.toLowerCase();
    byHash.set(key, [...(byHash.get(key) ?? []), event]);
  }

  const outcomes: IssueOutcome[] = [];
  for (const item of expected) {
    const matching = byHash.get(item.keyHash.toLowerCase()) ?? [];
    const issued = matching.find((event): event is Extract<ReceiptIssueEvent, { kind: 'ISSUED' }> =>
      event.kind === 'ISSUED');
    if (issued) {
      outcomes.push({
        photocardKey: item.photocardKey,
        tokenId: item.tokenId,
        status: sameIssue(item, issued) ? 'MINTED' : 'FAILED',
        failureCode: sameIssue(item, issued) ? null : 'KEY_COLLISION',
        txHash: null,
      });
      continue;
    }

    if (matching.some((event) => event.kind === 'SKIPPED')) {
      const historical = await findHistorical(item.photocardKey);
      const valid = historical !== null && sameIssue(item, historical);
      outcomes.push({
        photocardKey: item.photocardKey,
        tokenId: item.tokenId,
        status: valid ? 'MINTED' : 'FAILED',
        failureCode: valid ? null : 'KEY_COLLISION',
        txHash: historical?.txHash ?? null,
      });
      continue;
    }

    outcomes.push({
      photocardKey: item.photocardKey,
      tokenId: item.tokenId,
      status: 'FAILED',
      failureCode: 'MISSING_ISSUE_EVENT',
      txHash: null,
    });
  }
  return outcomes;
}

export async function verifyHistoricalIssue(
  expected: ExpectedIssue,
  findHistorical: (photocardKey: string) => Promise<HistoricalIssue | null>,
): Promise<IssueOutcome> {
  const historical = await findHistorical(expected.photocardKey);
  const valid = historical !== null && sameIssue(expected, historical);
  return {
    photocardKey: expected.photocardKey,
    tokenId: expected.tokenId,
    status: valid ? 'MINTED' : 'FAILED',
    failureCode: valid ? null : 'KEY_COLLISION',
    txHash: historical?.txHash ?? null,
  };
}
