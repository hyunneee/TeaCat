import { EmptyState } from './EmptyState';

interface Props {
  /** 무엇이 준비 중인지 한 줄. 없으면 제목만 보여줍니다 */
  description?: string;
  /** 남은 높이를 다 쓰게 하려면 `flex-1` (세로 flex 화면에서) */
  className?: string;
}

/**
 * 1차 배포에서 열지 않는 화면.
 *
 * 기능을 지우지 않고 **입구에서만** 막습니다. 화면과 API 는 그대로 두고 이 안내로 덮으므로,
 * 2차 배포 때는 이 컴포넌트를 걷어내면 됩니다.
 *
 * 빈 목록(`EmptyState`)과 생김새를 맞춥니다 — 사용자가 보기엔 "아직 아무것도 없는 화면"
 * 이라는 점이 같고, 화면마다 다른 안내를 만들면 준비 중인 곳이 몇 군데인지 알 수 없게 됩니다.
 * 마스코트는 자는 표정(`sleep`)입니다.
 */
export function ComingSoon({ description, className }: Props) {
  return (
    <EmptyState
      mood="sleep"
      title="2차 배포 때 만나요 💗😺"
      description={description}
      className={className}
    />
  );
}
