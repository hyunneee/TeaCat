import { useEffect, useState } from 'react';
import { Camera, Hash, RotateCcw, ScanLine } from 'lucide-react';
import { Button, Card, Input, Select } from '@/shared/components/ui';
import { CameraStage } from '@/features/face';
import { useConcertDetail, useConcerts } from '@/features/concert';
import {
  CheckInResultCard,
  CheckInTicketCard,
  QrScanStage,
  useCheckIn,
  useFaceCapture,
  useQrScanner,
} from '@/features/checkin';

/**
 * 게이트 입장 확인.
 *
 * 회차를 고르고 → QR 을 찍어 표를 확인하고 → 얼굴을 대조하면 서버가 입장 처리합니다.
 *
 * 🔴 **카메라는 한 번에 하나만 켭니다.** QR 단계에서는 뒷면, 얼굴 단계에서는 앞면을
 * 쓰는데 두 스트림을 동시에 잡으면 브라우저가 거절하거나 프레임이 끊깁니다.
 *
 * 🔴 **얼굴 대조와 입장 처리는 서버가 합니다.** 이 화면은 지금 찍은 임베딩을 올리고
 * 판정을 받을 뿐입니다 — 티켓에 베껴 둔 얼굴은 여기로 내려오지 않습니다 (CLAUDE.md 7장).
 */
export function AdminCheckInPage() {
  const [concertId, setConcertId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [manualId, setManualId] = useState('');

  const { data: concerts } = useConcerts();
  const { data: concert } = useConcertDetail(concertId);

  const performanceDetailId = scheduleId ? Number(scheduleId) : null;
  const checkIn = useCheckIn(performanceDetailId);
  const face = useFaceCapture();

  /* 같은 QR 이 여러 프레임 잡히므로, 요청이 도는 동안에는 더 보내지 않습니다 */
  const qr = useQrScanner((text) => {
    if (checkIn.step !== 'scan' || checkIn.scanning) return;
    checkIn.scan({ qrToken: text });
  });

  /* 단계가 바뀌면 그 단계의 카메라만 살립니다 (위 주석) */
  useEffect(() => {
    if (checkIn.step === 'face') {
      qr.stop();
      face.start();
    } else {
      face.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 훅 객체는 렌더마다 새로 만들어집니다
  }, [checkIn.step]);

  const concertOptions = [
    { value: '', label: '공연을 고르세요' },
    ...(concerts ?? []).map((item) => ({
      value: String(item.concertId),
      label: item.title,
    })),
  ];

  const scheduleOptions = [
    { value: '', label: '회차를 고르세요' },
    ...(concert?.schedules ?? []).map((item) => ({
      value: String(item.scheduleId),
      label: `${item.performanceNum}회차`,
    })),
  ];

  const handleCapture = async () => {
    const embedding = await face.capture();
    if (embedding) checkIn.verify(embedding);
  };

  const next = () => {
    setManualId('');
    checkIn.reset();
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-ink text-lg font-bold">입장 확인</h1>
        <p className="text-ink-muted text-sm">
          티켓 QR 을 찍고 예매 당시 얼굴과 대조합니다. 통과하면 그 표는 다시 쓸 수 없습니다.
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <Select
          label="공연"
          options={concertOptions}
          value={concertId}
          onChange={(value) => {
            setConcertId(value);
            setScheduleId('');
            next();
          }}
        />
        <Select
          label="회차"
          options={scheduleOptions}
          value={scheduleId}
          onChange={(value) => {
            setScheduleId(value);
            next();
          }}
        />
        {performanceDetailId === null && (
          <p className="text-warning text-xs">검표할 회차를 먼저 고르세요.</p>
        )}
      </Card>

      {performanceDetailId !== null && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            {checkIn.step === 'scan' && (
              <>
                <QrScanStage
                  videoRef={qr.videoRef}
                  scanning={qr.scanning}
                  placeholder={qr.error ?? '카메라를 켜고 티켓 QR 을 비추세요.'}
                />

                <Button
                  variant="dark"
                  fullWidth
                  leftIcon={<ScanLine size={16} />}
                  loading={checkIn.scanning}
                  onClick={() => void qr.start()}
                  disabled={qr.scanning}
                >
                  {qr.scanning ? 'QR 을 비추세요' : 'QR 스캔 시작'}
                </Button>

                {/* QR 이 안 읽히거나 카메라가 없을 때의 길 — 서버가 ADMIN 만 받으므로
                    번호를 직접 넣어도 남의 표를 함부로 열 수는 없습니다 */}
                <div className="border-line flex items-end gap-2 border-t pt-3">
                  <Input
                    label="티켓 번호로 확인"
                    placeholder="예: 1024"
                    inputMode="numeric"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value.replace(/\D/g, ''))}
                  />
                  <Button
                    variant="soft"
                    leftIcon={<Hash size={16} />}
                    disabled={!manualId || checkIn.scanning}
                    onClick={() => checkIn.scan({ ticketId: Number(manualId) })}
                  >
                    확인
                  </Button>
                </div>
              </>
            )}

            {checkIn.step === 'face' && (
              <>
                <CameraStage
                  videoRef={face.videoRef}
                  active={face.active}
                  faces={face.faces}
                  ready={face.ready}
                  placeholder="카메라를 준비하고 있어요…"
                />
                <p className={`text-center text-sm ${face.problem ? 'text-danger' : 'text-muted'}`}>
                  {face.message}
                </p>
                <Button
                  variant="primary"
                  fullWidth
                  leftIcon={<Camera size={16} />}
                  loading={face.capturing || checkIn.verifying}
                  disabled={!face.ready}
                  onClick={() => void handleCapture()}
                >
                  얼굴 확인
                </Button>
                <Button variant="ghost" fullWidth onClick={next}>
                  취소하고 다음 사람
                </Button>
              </>
            )}

            {checkIn.step === 'done' && checkIn.result && (
              <>
                <CheckInResultCard result={checkIn.result} />
                <Button variant="dark" fullWidth leftIcon={<RotateCcw size={16} />} onClick={next}>
                  다음 사람
                </Button>
              </>
            )}
          </Card>

          <div>
            {checkIn.ticket ? (
              <CheckInTicketCard ticket={checkIn.ticket} />
            ) : (
              <Card className="text-muted py-12 text-center text-sm">
                QR 을 찍으면 예매 정보가 여기 표시됩니다.
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
