import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import { Badge, Button, Modal, Textarea } from '@/shared/components/ui';
import { formatDateTime, formatPrice } from '@/shared/lib';
import {
  CHAIN_STATUS_LABEL,
  CHAIN_STATUS_TONE,
  DECISION_TONE,
  decisionLabel,
  RULE_DESCRIPTION,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  SOURCE_LABEL,
  evidenceEntries,
  evidenceLabel,
  formatEvidenceValue,
  remainingUntil,
  ruleLabel,
} from '../model/adminTradeReview.model';
import type { TradeReviewDetail, TradeReviewPartyDetail } from '../model/adminTradeReview.types';

/**
 * 심사 상세 · 승인 · 거절.
 *
 * 서버를 모릅니다 — 요청은 전부 콜백으로 위로 올립니다 (CLAUDE.md 4-3).
 * 거절은 **되돌릴 수 없는 동작**이라 붉은 버튼이고(4-7), 사유가 없으면 잠깁니다 — 서버도 400 으로 막지만
 * 눌렀을 때 실패하는 버튼을 보여주지 않으려고 화면에서도 잠급니다. 최종 확인은 페이지의 ConfirmModal 이 받습니다.
 */
export interface AdminTradeReviewDetailModalProps {
  detail: TradeReviewDetail | undefined;
  isLoading: boolean;
  approving: boolean;
  rejecting: boolean;
  onClose: () => void;
  onApprove: (note: string) => void;
  /** 사유는 비어 있지 않은 문자열로만 올라옵니다 */
  onReject: (note: string) => void;
}

const NOTE_MAX = 1000;

export function AdminTradeReviewDetailModal({
  detail,
  isLoading,
  approving,
  rejecting,
  onClose,
  onApprove,
  onReject,
}: AdminTradeReviewDetailModalProps) {
  const [note, setNote] = useState('');

  // 다른 심사를 열면 사유 입력을 비웁니다. 결정이 끝난 건은 기록된 사유를 보여줍니다
  useEffect(() => {
    setNote(detail?.decisionNote ?? '');
  }, [detail?.summary.reviewId, detail?.decisionNote]);

  const summary = detail?.summary;
  const decided = Boolean(summary?.decision);
  /** 정산을 실제로 멈춘 심사인가. 아니면 거래는 이미 정산됐고 결정은 판정 기록(학습 라벨)일 뿐이다 */
  const held = summary?.held ?? false;
  const trimmed = note.trim();

  return (
    <Modal
      open
      onClose={onClose}
      variant="center"
      width="wide"
      title={summary ? `심사 #${summary.reviewId} · ${summary.designName}` : '거래 심사'}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-ink-muted text-xs">
            {summary && !decided && held && remainingUntil(summary.autoApproveAt)}
            {summary && !decided && !held && '정산은 그대로 진행돼요. 판정은 기록으로만 남아요.'}
            {summary && decided && summary.decision && (
              <span className="flex items-center gap-1.5">
                <Badge tone={DECISION_TONE[summary.decision]}>{decisionLabel(summary.decision, held)}</Badge>
                {summary.decidedAt && formatDateTime(summary.decidedAt)}
                {summary.autoApproved ? ' · 시한 경과 자동 승인' : detail?.decidedBy ? ` · 관리자 #${detail.decidedBy}` : ''}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              닫기
            </Button>
            {!decided && summary && (
              <>
                <Button
                  variant="danger"
                  leftIcon={<ShieldAlert size={16} />}
                  disabled={!trimmed}
                  loading={rejecting}
                  onClick={() => onReject(trimmed)}
                >
                  {held ? '거절' : '부정으로 판정'}
                </Button>
                <Button
                  variant="secondary"
                  leftIcon={<CheckCircle2 size={16} />}
                  loading={approving}
                  onClick={() => onApprove(trimmed)}
                >
                  {held ? '승인 · 정산 재개' : '정상으로 판정'}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {isLoading || !detail || !summary ? (
        <p className="text-ink-muted text-sm">불러오는 중…</p>
      ) : (
        <div className="space-y-5">
          {/* 한 줄 요약 */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={SEVERITY_TONE[summary.maxSeverity]}>무게 {SEVERITY_LABEL[summary.maxSeverity]}</Badge>
            {!summary.flagged && <Badge tone="quiet">기준 미달</Badge>}
            <Badge tone={held ? 'warning' : 'quiet'}>{held ? '정산 보류' : '정산 진행'}</Badge>
            <Badge tone={CHAIN_STATUS_TONE[summary.tradeStatus]}>{CHAIN_STATUS_LABEL[summary.tradeStatus]}</Badge>
            <Badge tone="quiet">{SOURCE_LABEL[summary.source]}</Badge>
            <span className="text-ink font-medium tabular-nums">{formatPrice(summary.price)}</span>
            <span className="text-ink-muted text-xs">
              거래 #{summary.tradeId} · 카드 #{summary.photocardId} · {formatDateTime(summary.createdAt)}
            </span>
          </div>

          {/* 걸린 규칙과 근거 */}
          <section>
            <h3 className="text-ink mb-2 text-sm font-semibold">걸린 규칙</h3>
            <ul className="space-y-2">
              {detail.signals.map((signal, i) => (
                <li key={`${signal.rule}-${i}`} className="surface-2 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Badge tone={SEVERITY_TONE[signal.severity]}>{SEVERITY_LABEL[signal.severity]}</Badge>
                    <span className="text-ink text-sm font-medium">{ruleLabel(signal.rule)}</span>
                    <span className="text-ink-subtle text-xs">{signal.rule}</span>
                  </div>
                  {RULE_DESCRIPTION[signal.rule] && (
                    <p className="text-ink-muted mt-1 text-xs leading-relaxed">{RULE_DESCRIPTION[signal.rule]}</p>
                  )}
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                    {evidenceEntries(signal.evidence).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <dt className="text-ink-muted truncate">{evidenceLabel(key)}</dt>
                        <dd className="text-ink shrink-0 tabular-nums">{formatEvidenceValue(key, value)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </section>

          {/* 판매자 · 구매자 비교 */}
          <section>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-ink text-sm font-semibold">판매자 · 구매자</h3>
              <MatchBadge label="IP" value={detail.sameIp} />
              <MatchBadge label="브라우저" value={detail.sameUserAgent} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <PartyCard title="판매자" party={detail.seller} />
              <PartyCard title="구매자" party={detail.buyer} />
            </div>
          </section>

          {/* 입찰 타임라인 (경매만) */}
          {detail.bids.length > 0 && (
            <section>
              <h3 className="text-ink mb-2 text-sm font-semibold">입찰 이력</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-line text-ink-muted border-b text-left">
                      <th className="px-2 py-1.5 font-medium">시각</th>
                      <th className="px-2 py-1.5 font-medium">입찰자</th>
                      <th className="px-2 py-1.5 font-medium">금액</th>
                      <th className="px-2 py-1.5 font-medium">판매자 단말과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.bids.map((bid) => (
                      <tr key={bid.bidId} className="border-line/60 border-b last:border-0">
                        <td className="text-ink-muted px-2 py-1.5 tabular-nums">{formatDateTime(bid.createdAt)}</td>
                        <td className="text-ink px-2 py-1.5">
                          {bid.bidderNickname}
                          {bid.bidderId === summary.buyer.userId && (
                            <Badge tone="accent" className="ml-1.5">
                              구매자
                            </Badge>
                          )}
                        </td>
                        <td className="text-ink px-2 py-1.5 tabular-nums">{formatPrice(bid.amount)}</td>
                        <td className="px-2 py-1.5">
                          {bid.sameDeviceAsSeller ? (
                            <Badge tone="danger">같은 브라우저</Badge>
                          ) : bid.sameIpAsSeller ? (
                            <Badge tone="warning">같은 IP</Badge>
                          ) : bid.sameIpAsSeller === null ? (
                            <span className="text-ink-subtle">단말 정보 없음</span>
                          ) : (
                            <span className="text-ink-subtle">다름</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 같은 도안 최근 거래 */}
          <section>
            <h3 className="text-ink mb-2 text-sm font-semibold">같은 도안 최근 거래</h3>
            {detail.recentDesignTrades.length === 0 ? (
              <p className="text-ink-muted text-xs">완료된 거래가 아직 없어요. 시세 규칙은 표본이 모이면 동작해요.</p>
            ) : (
              <ul className="flex flex-wrap gap-2 text-xs">
                {detail.recentDesignTrades.map((trade) => (
                  <li
                    key={trade.tradeId}
                    className={
                      trade.involvesParties
                        ? 'border-line rounded-lg border px-2 py-1 font-medium'
                        : 'border-line/60 text-ink-muted rounded-lg border px-2 py-1'
                    }
                    title={trade.involvesParties ? '이 심사의 판매자 또는 구매자가 낀 거래' : undefined}
                  >
                    {formatPrice(trade.price)} · {formatDateTime(trade.completedAt)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* AI 보고서 — 아직 없으면 그 사실만 */}
          <section>
            <h3 className="text-ink mb-2 text-sm font-semibold">AI 분석</h3>
            {detail.analysis && typeof detail.analysis.headline === 'string' ? (
              <div className="surface-2 rounded-xl p-3 text-sm">
                <p className="text-ink font-medium">{detail.analysis.headline}</p>
                {Array.isArray(detail.analysis.findings) && (
                  <ul className="text-ink-muted mt-2 list-disc space-y-1 pl-4 text-xs">
                    {(detail.analysis.findings as unknown[]).map((f, i) => (
                      <li key={i}>{String(f)}</li>
                    ))}
                  </ul>
                )}
                {Array.isArray(detail.analysis.benignExplanations) && (
                  <>
                    <p className="text-ink mt-2 text-xs font-medium">정상일 가능성</p>
                    <ul className="text-ink-muted mt-1 list-disc space-y-1 pl-4 text-xs">
                      {(detail.analysis.benignExplanations as unknown[]).map((f, i) => (
                        <li key={i}>{String(f)}</li>
                      ))}
                    </ul>
                  </>
                )}
                {detail.analysisModel && (
                  <p className="text-ink-subtle mt-2 text-xs">{detail.analysisModel}</p>
                )}
              </div>
            ) : (
              <p className="text-ink-muted text-xs">
                {summary.analysisStatus === 'PENDING'
                  ? '분석 대기 중이에요. 규칙 근거만으로도 결정할 수 있어요.'
                  : '분석이 없어요. 규칙 근거만으로 결정해요.'}
              </p>
            )}
          </section>

          {/* 결정 사유 */}
          <Textarea
            label={decided ? '결정 사유' : '사유'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              held
                ? '거절이면 필수, 승인이면 선택이에요. 확인한 내용을 적어주세요.'
                : '부정이면 필수, 정상이면 선택이에요. 확인한 내용을 적어주세요.'
            }
            rows={3}
            maxLength={NOTE_MAX}
            showCount
            disabled={decided}
            hint={
              decided
                ? '결정이 끝난 심사예요. 다시 바꿀 수 없어요.'
                : held
                  ? '거절하면 묶인 캣머니가 풀리고 거래는 실패로 끝나요. 승인하면 다음 주기에 체인 전송이 이어져요.'
                  : '거래는 이미 정산됐어요. 판정은 돈을 움직이지 않고 기록으로 남아 나중에 규칙을 조정하는 데 써요.'
            }
          />
        </div>
      )}
    </Modal>
  );
}

function MatchBadge({ label, value }: { label: string; value: boolean | null }) {
  if (value === null) return <Badge tone="quiet">{label} 정보 없음</Badge>;
  return value ? <Badge tone="danger">{label} 일치</Badge> : <Badge tone="neutral">{label} 다름</Badge>;
}

function PartyCard({ title, party }: { title: string; party: TradeReviewPartyDetail }) {
  return (
    <div className="surface-2 rounded-xl p-3 text-xs">
      <p className="text-ink-muted mb-1 font-medium">{title}</p>
      <p className="text-ink text-sm font-semibold">
        {party.nickname} <span className="text-ink-subtle font-normal">#{party.userId}</span>
      </p>
      <dl className="mt-1.5 space-y-0.5">
        <Row label="이메일" value={party.email} />
        <Row label="가입" value={formatDateTime(party.createdAt)} />
        <Row label="요청 IP" value={party.ip ?? '정보 없음'} />
        <Row
          label="최근 90일 심사 등장"
          value={`${party.reviewAppearances90d}회`}
          strong={party.reviewAppearances90d >= 2}
        />
      </dl>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={strong ? 'text-ink font-semibold' : 'text-ink'}>{value}</dd>
    </div>
  );
}
