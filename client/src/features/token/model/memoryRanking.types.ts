/** 짝 맞추기 랭킹 한 줄 */
export interface MemoryRankEntry {
  /** 등수 (1부터) */
  rank: number;
  nickname: string;
  /** 걸린 시간(ms). **짧을수록 위**입니다 */
  elapsedMs: number;
  moves: number;
  /** 이 줄이 나인가 — 서버가 판단해 내려줍니다 */
  me: boolean;
}

/** 오늘의 랭킹. 어제 1등을 함께 내려줍니다 */
export interface MemoryRanking {
  date: string;
  /** 1등 상금(캣머니). 다음날 자동 지급이라 받는 버튼이 없습니다 */
  prize: number;
  entries: MemoryRankEntry[];
  /** 순위표 밖일 때의 내 등수. 순위표 안에 있거나 오늘 기록이 없으면 null */
  myRank: MemoryRankEntry | null;
  yesterdayWinner: MemoryRankEntry | null;
}

/** 판을 열었을 때. **시간은 서버가 잽니다** — 이 id 를 클리어할 때 돌려줍니다 */
export interface MemoryGameStart {
  sessionId: number;
  startedAt: string;
}

/** 클리어 결과. 화면의 시계가 아니라 이 `elapsedMs` 가 순위에 들어갑니다 */
export interface MemoryGameResult {
  sessionId: number;
  elapsedMs: number;
  moves: number;
  /** 오늘 내 최고 기록 기준 등수 */
  todayRank: number | null;
  /** 이 판이 오늘 내 최고 기록인가 */
  personalBest: boolean;
}
