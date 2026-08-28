import { mock } from '../router';
import { iso, now } from '../db';

/**
 * 배포 정보 목업.
 *
 * 실서버는 배포 파이프라인이 이 값을 갱신합니다.
 * 지금은 "최신"으로 응답해 앱 정보 화면이 정상 경로를 보여주게 합니다.
 * 업데이트 안내 화면을 확인하려면 latest 를 올려보세요 (예: '9.9.9').
 */
mock('GET', '/app/version', () => ({
  latest: '0.1.0',
  minimum: '0.1.0',
  releasedAt: iso(now() - 2 * 24 * 3600_000),
  notes: '좌석 색상 구분, 포토카드 전체화면 보기가 추가되었습니다.',
}));
