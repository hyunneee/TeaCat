/** 서버가 알려주는 배포 정보 */
export interface AppVersionInfo {
  /** 최신 배포 버전 (예: '1.2.0') */
  latest: string;
  /**
   * 이 버전 미만이면 반드시 업데이트해야 합니다.
   * (좌석·결제 규격이 바뀐 경우 옛 앱이 잘못된 요청을 보냅니다)
   */
  minimum: string;
  /** 배포 시각 */
  releasedAt: string;
  /** 릴리스 노트 한 줄 */
  notes?: string;
}

export type UpdateState =
  /** 최신 */
  | 'CURRENT'
  /** 새 버전이 있음 (선택 업데이트) */
  | 'OUTDATED'
  /** 반드시 업데이트해야 함 */
  | 'REQUIRED'
  /** 서버에 물어보지 못했음 */
  | 'UNKNOWN';
