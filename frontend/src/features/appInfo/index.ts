/**
 * appInfo feature 의 공개 API.
 *
 * 앱 버전·업데이트 안내만 담당합니다. 화면은 `useAppVersion` 만 알면 됩니다.
 */
export { useAppVersion } from './hooks/useAppVersion';
export { appInfoApi, appInfoKeys } from './api/appInfoApi';
export { compareVersions, updateStateOf, UPDATE_STATE_LABEL } from './model/appInfo.model';
export type { AppVersionInfo, UpdateState } from './model/appInfo.types';
