import { useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Badge, Button, Modal, Textarea } from '@/shared/components/ui';
import { CONTENT_MAX_LENGTH, STATUS_LABEL, STATUS_TONE, TYPE_LABEL } from '@/features/inquiry';
import type { Inquiry } from '@/features/inquiry';

/**
 * 문의 답변 · 해결 처리.
 *
 * 서버를 모릅니다 — 요청은 전부 콜백으로 위로 올립니다 (CLAUDE.md 4-3).
 * 해결 처리는 **답변을 등록한 뒤에만** 됩니다. 서버도 409 로 막지만,
 * 눌렀을 때 실패하는 버튼을 보여주지 않으려고 화면에서도 잠급니다.
 */
export interface AdminInquiryAnswerModalProps {
  inquiry: Inquiry | undefined;
  isLoading: boolean;
  answering: boolean;
  resolving: boolean;
  onClose: () => void;
  onAnswer: (answer: string) => void;
  onResolve: () => void;
  onReopen: () => void;
}

export function AdminInquiryAnswerModal({
  inquiry,
  isLoading,
  answering,
  resolving,
  onClose,
  onAnswer,
  onResolve,
  onReopen,
}: AdminInquiryAnswerModalProps) {
  const [answer, setAnswer] = useState('');

  // 다른 문의를 열면 입력창을 그 문의의 답변으로 바꿔 채웁니다
  useEffect(() => {
    setAnswer(inquiry?.answer ?? '');
  }, [inquiry?.inquiryId, inquiry?.answer]);

  const isResolved = inquiry?.status === 'RESOLVED';
  const canResolve = Boolean(inquiry?.answer) && !isResolved;

  return (
    <Modal
      open
      onClose={onClose}
      variant="center"
      width="wide"
      title={isLoading || !inquiry ? '문의' : inquiry.title}
      footer={
        <div className="flex items-center justify-between gap-2">
          {isResolved ? (
            <Button
              variant="ghost"
              leftIcon={<RotateCcw size={16} />}
              loading={resolving}
              onClick={onReopen}
            >
              해결 취소
            </Button>
          ) : (
            <Button
              variant="secondary"
              leftIcon={<CheckCircle2 size={16} />}
              disabled={!canResolve}
              loading={resolving}
              onClick={onResolve}
            >
              해결 처리
            </Button>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              닫기
            </Button>
            <Button
              variant="dark"
              disabled={!answer.trim()}
              loading={answering}
              onClick={() => onAnswer(answer.trim())}
            >
              {inquiry?.answer ? '답변 수정' : '답변 등록'}
            </Button>
          </div>
        </div>
      }
    >
      {isLoading || !inquiry ? (
        <p className="text-ink-muted text-sm">불러오는 중…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge tone={STATUS_TONE[inquiry.status]}>{STATUS_LABEL[inquiry.status]}</Badge>
            <Badge tone="quiet">{TYPE_LABEL[inquiry.type]}</Badge>
            <span className="text-ink-muted text-xs">
              {inquiry.writerNickname} · {inquiry.createdAt.slice(0, 16).replace('T', ' ')}
            </span>
          </div>

          <div className="surface-2 rounded-xl p-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
            {inquiry.content}
          </div>

          <Textarea
            label="답변"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="확인한 내용과 처리 결과를 적어주세요."
            rows={8}
            maxLength={CONTENT_MAX_LENGTH}
            showCount
            hint={
              canResolve
                ? '답변이 등록돼 있어 해결 처리를 누를 수 있어요.'
                : isResolved
                  ? '해결 처리된 문의입니다. 답변을 고쳐도 상태는 그대로예요.'
                  : '답변을 먼저 등록해야 해결 처리를 누를 수 있어요.'
            }
          />
        </div>
      )}
    </Modal>
  );
}
