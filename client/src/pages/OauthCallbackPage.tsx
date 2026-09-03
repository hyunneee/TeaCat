import { Loading } from '@/shared/components/common';
import { useOauthCallback } from '@/features/auth';

/**
 * SSAFY 로그인 결과를 처리하는 화면.
 *
 * 서버가 이 주소로 돌려보내고, 여기서 결과에 따라 홈 / 추가정보 / 로그인으로 보냅니다.
 * 사용자에게는 잠깐 스쳐 지나가는 화면입니다.
 */
export function OauthCallbackPage() {
  useOauthCallback();

  return <Loading label="SSAFY 계정을 확인하고 있어요" />;
}
