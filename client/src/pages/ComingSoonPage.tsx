import { Header } from '@/shared/components/layout';
import { ComingSoon } from '@/shared/components/common';

interface Props {
  /** 헤더에 그대로 나갑니다 — 원래 화면과 같은 제목을 씁니다 */
  title: string;
  /** 뒤로가기 화살표. 하단 탭으로 들어오는 화면은 끕니다 */
  showBack?: boolean;
  /** 한 줄 설명. 없으면 제목만 보여줍니다 */
  description?: string;
}

/**
 * 1차 배포에서 열지 않는 화면의 자리.
 *
 * 원래 화면 파일은 **그대로 둡니다.** 라우터에서 이 페이지로 바꿔 끼우기만 하므로,
 * 2차 배포 때는 `router.tsx` 에서 한 줄씩 되돌리면 끝입니다.
 *
 * 원래 화면을 그대로 두고 안에서 early return 하지 않는 이유: 훅은 조건부로 건너뛸 수 없어
 * 목록·잔액 조회가 그대로 나갑니다. 보여주지도 않을 화면 때문에 요청을 태울 이유가 없습니다.
 *
 * 제목은 원래 화면과 같게 둡니다 — 사용자는 "잘못 들어왔나" 가 아니라
 * "여기는 아직 준비 중" 으로 읽어야 합니다.
 */
export function ComingSoonPage({ title, showBack = true, description }: Props) {
  return (
    <>
      <Header title={title} showBack={showBack} />
      <ComingSoon description={description} />
    </>
  );
}
