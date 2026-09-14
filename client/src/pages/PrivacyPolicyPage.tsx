import { useState } from 'react';
import { Header } from '@/shared/components/layout';
import { Button, Card, SectionTitle } from '@/shared/components/ui';
import { FEATURE } from '@/shared/constants';
import { readAnalyticsConsent, writeAnalyticsConsent, trackPageView } from '@/shared/lib';
import { startAnalytics } from '@/instrument';

/**
 * 개인정보처리방침.
 *
 * 🔴 **이 문서의 내용은 초안입니다.** 아래 [ ] 로 표시한 곳은 실제 값을 채워야 하고,
 *    공개 전에 사람이 한 번 읽어야 합니다. 법률 자문을 대신하지 않습니다.
 *
 * 로그인 없이 볼 수 있어야 합니다 — 쿠키 동의 배너에서 링크로 걸리고, 동의는 비로그인
 * 첫 방문자에게도 물어야 하기 때문입니다. 그래서 가드 밖 `PlainLayout` 에 둡니다.
 *
 * 🔴 내용을 고치면 `shared/lib/consent.ts` 의 동의 항목과 **어긋나지 않는지** 보세요.
 *    "Sentry 는 동의 없이 켠다" 는 판단이 이 문서의 3항과 짝입니다. 한쪽만 바꾸면
 *    처리방침에 없는 처리를 하는 것이 됩니다.
 */

/**
 * 처리방침 본문. 문단이 길어 컴포넌트 밖에 둡니다.
 *
 * 🔴 **얼굴 관련 문단은 `FEATURE.face` 를 따라 붙었다 빠집니다.**
 *    처리방침은 "무엇을 수집하는가" 를 고지하는 문서라, 받지 않는 정보를 받는다고
 *    적어 두면 **사실과 다른 고지**가 됩니다. 안내한 삭제 경로(설정 > 등록된 얼굴 삭제)도
 *    그 배포에는 아예 없는 화면입니다.
 *    얼굴을 되살리면(`FEATURE.face = true`) 이 문단들도 같이 돌아옵니다.
 */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '수집하는 개인정보 항목',
    body: [
      '회원가입·이용 과정에서 아래 정보를 수집합니다.',
      '• 필수: 이메일, 비밀번호, 닉네임, 휴대전화번호',
      '• 예매·결제: 주문 내역, 결제 수단, 결제 승인 정보 (카드번호는 저장하지 않으며 토스페이먼츠가 처리합니다)',
      ...(FEATURE.face ? ['• 얼굴 특징값: 본인 확인을 위한 128차원 숫자 배열'] : []),
      '• 자동 수집: 접속 IP, 브라우저·기기 정보, 방문 기록, 쿠키',
    ],
  },
  ...(FEATURE.face
    ? [
        {
          title: '얼굴 정보의 처리 (중요)',
          body: [
            '이 서비스는 암표 거래를 막기 위해 얼굴 인식을 사용합니다. 다만 얼굴 사진은 서버에 저장하지 않습니다.',
            '• 촬영한 얼굴 이미지는 이용자의 브라우저 안에서만 처리되며, 서버로 전송되지 않습니다.',
            '• 브라우저가 이미지를 128개의 숫자로 변환한 특징값만 서버로 전송·저장합니다. 이 값으로는 원래 얼굴을 복원할 수 없습니다.',
            '• 특징값은 입장 시 본인 확인 목적으로만 사용하며, 회원 탈퇴 또는 얼굴 삭제 요청 시 즉시 파기합니다.',
            '• 마이페이지 > 설정 > 등록된 얼굴 삭제에서 언제든 지울 수 있습니다.',
          ],
        },
      ]
    : []),
  {
    title: '국외 이전',
    body: [
      '서비스 운영과 개선을 위해 아래 사업자에 처리를 위탁하며, 데이터가 국외로 이전됩니다.',
      '• Sentry (Functional Software, Inc. / 미국) — 오류 발생 시 화면 주소, 브라우저 정보, 오류 내용. 서비스 장애 파악·복구 목적. 서비스 제공에 필요하여 동의 없이 처리하며, 이용자를 특정하는 정보는 전송하지 않습니다.',
      '• Google (미국) — Google Analytics 4. 방문 기록, 화면 이동, 예매 단계 진행 여부. 이용 통계 분석 목적. 동의하신 경우에만 수집합니다.',
      '• Microsoft (미국) — Clarity. 화면 조작 기록. 사용성 개선 목적. 동의하신 경우에만 수집합니다.',
      '이전 시기와 방법: 서비스 이용 시점에 네트워크를 통해 자동 전송됩니다.',
      '보유 기간: 각 사업자의 보관 정책에 따르며, 위탁 계약 종료 시 파기됩니다.',
      '동의를 거부하셔도 예매를 포함한 모든 서비스를 이용할 수 있습니다. 동의는 화면 하단 배너 또는 이 화면에서 언제든 철회할 수 있습니다.',
    ],
  },
  {
    title: '이용 목적',
    body: [
      '• 회원 식별과 본인 확인',
      '• 티켓 예매·결제·발권·취소 처리',
      ...(FEATURE.face ? ['• 입장 시 티켓 소유자 본인 확인 (암표 거래 방지)'] : []),
      '• 문의 응대와 공지 전달',
      '• 서비스 개선을 위한 이용 통계 분석 (동의한 경우)',
    ],
  },
  {
    title: '보유 및 파기',
    body: [
      '원칙적으로 회원 탈퇴 시 지체 없이 파기합니다. 다만 관계 법령이 정한 기간 동안 보관합니다.',
      '• 계약·청약철회, 대금 결제 기록: 5년 (전자상거래법)',
      '• 소비자 불만·분쟁 처리 기록: 3년 (전자상거래법)',
      '• 접속 기록: 3개월 (통신비밀보호법)',
    ],
  },
  {
    title: '이용자의 권리',
    body: [
      '이용자는 언제든 자신의 개인정보를 조회·수정·삭제하거나 처리 정지를 요청할 수 있습니다.',
      '• 조회·수정: 마이페이지',
      ...(FEATURE.face ? ['• 얼굴 정보 삭제: 마이페이지 > 설정 > 등록된 얼굴 삭제'] : []),
      '• 회원 탈퇴: 마이페이지 > 설정 > 회원 탈퇴',
      '• 그 밖의 요청: 아래 연락처',
    ],
  },
  {
    title: '쿠키',
    body: [
      '로그인 유지를 위해 필수 쿠키를 사용합니다. 이 쿠키는 거부할 수 없으며, 없으면 로그인이 유지되지 않습니다.',
      '이용 통계 분석을 위한 쿠키는 동의하신 경우에만 사용합니다.',
      '브라우저 설정에서 쿠키를 차단할 수 있으나, 그 경우 로그인이 필요한 기능을 쓸 수 없습니다.',
    ],
  },
  {
    title: '개인정보 보호책임자',
    body: [
      '개인정보 처리에 관한 문의는 아래로 연락해 주세요.',
      '• 책임자: [담당자 이름을 적어주세요]',
      '• 연락처: [이메일 주소를 적어주세요]',
      '• 서비스 내 문의: 마이페이지 > 문의하기',
    ],
  },
  {
    title: '변경 고지',
    body: [
      '이 방침이 변경되면 시행 7일 전부터 서비스 내 공지로 알립니다. 이용자에게 불리한 변경은 30일 전에 알립니다.',
      '• 시행일: [배포일을 적어주세요]',
    ],
  },
];

export function PrivacyPolicyPage() {
  const [consent, setConsent] = useState(readAnalyticsConsent);

  /* 처리방침을 읽고 나서 마음을 바꾸는 것이 자연스러운 자리라, 철회·재동의를
     여기서 바로 할 수 있게 둡니다. (배너는 한 번 정하면 다시 뜨지 않습니다) */
  const allow = () => {
    writeAnalyticsConsent(true);
    setConsent(true);
    startAnalytics();
    /* 배너와 같은 이유로 지금 화면을 한 번 보냅니다 — 라우트 구독은 **다음 이동부터**
       도는데, 그때까지 이 세션은 페이지뷰가 0 이라 유입 경로가 통째로 빕니다.
       (`CookieConsent` 의 같은 줄과 짝입니다. 한쪽만 고치지 마세요) */
    trackPageView(window.location.pathname);
  };

  /* 🔴 이미 로드된 스크립트를 걷어낼 방법은 없습니다 (Clarity 에는 stop 이 없고
     GA 도 마찬가지). 그래서 거부는 **다음 방문부터** 적용된다고 그대로 적습니다 —
     "즉시 중단됩니다" 라고 쓰면 사실이 아닙니다. */
  const deny = () => {
    writeAnalyticsConsent(false);
    setConsent(false);
  };

  return (
    <>
      <Header title="개인정보처리방침" showBack />

      <div className="space-y-6 p-4">
        <section>
          <SectionTitle description="동의하지 않아도 모든 기능을 쓸 수 있어요">
            이용 통계 수집
          </SectionTitle>
          <Card className="space-y-3">
            <p className="text-sm">
              현재 상태:{' '}
              <span className="font-bold">
                {consent === null ? '아직 선택하지 않음' : consent ? '동의함' : '거부함'}
              </span>
            </p>
            {consent === true && (
              <p className="text-muted text-xs leading-relaxed">
                거부로 바꾸면 <b>다음 방문부터</b> 수집이 멈춥니다. 이미 실행 중인 스크립트는
                이번 방문 동안 종료할 수 없습니다.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" disabled={consent === false} onClick={deny}>
                거부
              </Button>
              <Button disabled={consent === true} onClick={allow}>
                동의
              </Button>
            </div>
          </Card>
        </section>

        {/* 🔴 번호는 **그릴 때** 붙입니다. 제목에 박아 두면 얼굴 문단이 빠졌을 때
            1, 3, 4 … 로 건너뛰어 법정 고지 문서가 깨져 보입니다. */}
        {SECTIONS.map((section, index) => (
          <section key={section.title}>
            <SectionTitle>{`${index + 1}. ${section.title}`}</SectionTitle>
            <Card className="space-y-2">
              {section.body.map((line) => (
                <p key={line} className="text-muted text-sm leading-relaxed">
                  {line}
                </p>
              ))}
            </Card>
          </section>
        ))}
      </div>
    </>
  );
}

