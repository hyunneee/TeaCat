import type { StadiumEditorDraftData } from './stadium.types';

const STORAGE_KEY = 'tikat:admin-stadium-layout-draft';
const STORAGE_VERSION = 1;
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface StoredStadiumEditorDraft {
  version: number;
  savedAt: number;
  data: StadiumEditorDraftData;
}

export interface StadiumDraftSaveResult {
  ok: boolean;
  message?: string;
}

export function saveStadiumEditorDraft(data: StadiumEditorDraftData): StadiumDraftSaveResult {
  try {
    const stored: StoredStadiumEditorDraft = {
      version: STORAGE_VERSION,
      savedAt: Date.now(),
      data,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: '임시저장 공간이 부족합니다. Excel 좌석 수를 줄이거나 작업을 확정해 주세요.',
    };
  }
}

export function loadStadiumEditorDraft(): StadiumEditorDraftData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredStadiumEditorDraft>;
    if (
      stored.version !== STORAGE_VERSION ||
      typeof stored.savedAt !== 'number' ||
      !stored.data ||
      Date.now() - stored.savedAt > DRAFT_MAX_AGE_MS
    ) {
      clearStadiumEditorDraft();
      return null;
    }
    if (
      stored.data.analysis &&
      (!stored.data.analysisExpiresAt || stored.data.analysisExpiresAt <= Date.now())
    ) {
      clearStadiumEditorDraft();
      return null;
    }
    return {
      ...stored.data,
      unassignedSeats: stored.data.unassignedSeats ?? [],
      layoutElements: stored.data.layoutElements.filter(
        (element) => (element as { kind?: string }).kind !== 'EXCEL_REFERENCE',
      ),
    };
  } catch {
    clearStadiumEditorDraft();
    return null;
  }
}

export function clearStadiumEditorDraft() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 브라우저가 저장소 접근을 차단한 경우에도 화면 이동 자체는 계속할 수 있어야 합니다.
  }
}
