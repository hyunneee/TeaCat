import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyIssueReceipt,
  type ExpectedIssue,
  type HistoricalIssue,
} from '../src/services/photocardIssueEvidence';

const alice = '0x1111111111111111111111111111111111111111';
const bob = '0x2222222222222222222222222222222222222222';

function expected(key: string, hash: string, tokenId: string, to = alice): ExpectedIssue {
  return { photocardKey: key, keyHash: hash, tokenId, to };
}

test('PhotocardIssued와 IssueSkipped가 섞여도 카드별로 판정한다', async () => {
  const requests = [expected('uuid-a', '0xaa', '101'), expected('uuid-b', '0xbb', '202')];
  const historical: HistoricalIssue = {
    keyHash: '0xbb', tokenId: '202', to: alice, txHash: '0xold',
  };
  const outcomes = await classifyIssueReceipt(
    requests,
    [
      { kind: 'ISSUED', keyHash: '0xaa', tokenId: '101', to: alice },
      { kind: 'SKIPPED', keyHash: '0xbb' },
    ],
    async (key) => key === 'uuid-b' ? historical : null,
  );

  assert.deepEqual(outcomes.map((item) => item.status), ['MINTED', 'MINTED']);
  assert.equal(outcomes[1]?.txHash, '0xold');
});

test('재사용 키의 과거 도안이나 수령인이 다르면 충돌이지 성공이 아니다', async () => {
  const outcomes = await classifyIssueReceipt(
    [expected('reused', '0xcc', '303', alice)],
    [{ kind: 'SKIPPED', keyHash: '0xcc' }],
    async () => ({ keyHash: '0xcc', tokenId: '999', to: bob, txHash: '0xcollision' }),
  );

  assert.equal(outcomes[0]?.status, 'FAILED');
  assert.equal(outcomes[0]?.failureCode, 'KEY_COLLISION');
});

test('성공 영수증에 카드별 이벤트가 없으면 MINTED로 올리지 않는다', async () => {
  const outcomes = await classifyIssueReceipt(
    [expected('missing', '0xdd', '404')],
    [],
    async () => null,
  );

  assert.equal(outcomes[0]?.status, 'FAILED');
  assert.equal(outcomes[0]?.failureCode, 'MISSING_ISSUE_EVENT');
});
