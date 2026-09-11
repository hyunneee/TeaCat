import { http } from '@/shared/api';
import type {
  ExcelAnalysis,
  PersistedAreaList,
  PersistedSeatList,
  StadiumCreateResponse,
  StadiumDetail,
  StadiumInfoDraft,
  StadiumList,
  StadiumLayoutCreateResponse,
  StadiumLayoutDetail,
  StadiumLayoutList,
  StadiumLayoutUpdateRequest,
  StadiumUpdateRequest,
} from '../model/stadium.types';

export interface StadiumLayoutCreatePayload {
  analysisId?: string;
  name: string;
  isDefault: boolean;
  saveMode: 'DRAFT' | 'PUBLISH';
  sourceSheet?: string;
  layoutWidth: number;
  layoutHeight: number;
  areas: unknown[];
  layoutElements: unknown[];
}

export const stadiumApi = {
  list: () => http.get<StadiumList>('/stadiums'),

  detail: (stadiumId: number) => http.get<StadiumDetail>(`/stadiums/${stadiumId}`),

  create: (info: StadiumInfoDraft) =>
    http.post<StadiumCreateResponse>('/admin/stadiums', {
      name: info.name.trim(),
      address: info.address.trim(),
      phone: info.phone.trim() || null,
      maxCapacity: Number(info.maxCapacity),
    }),

  update: (stadiumId: number, body: StadiumUpdateRequest) =>
    http.patch<void>(`/admin/stadiums/${stadiumId}`, body),

  delete: (stadiumId: number) => http.delete<void>(`/admin/stadiums/${stadiumId}`),

  analyzeExcel: (stadiumId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.post<ExcelAnalysis>(`/admin/stadiums/${stadiumId}/layout-imports/excel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  createLayout: (stadiumId: number, payload: StadiumLayoutCreatePayload) =>
    http.post<StadiumLayoutCreateResponse>(`/admin/stadiums/${stadiumId}/layouts`, payload),

  copyLayout: (layoutId: number, name: string) =>
    http.post<StadiumLayoutCreateResponse>(`/admin/stadium-layouts/${layoutId}/copies`, {
      name: name.trim(),
      isDefault: false,
      saveMode: 'PUBLISH',
    }),

  layouts: (stadiumId: number) => http.get<StadiumLayoutList>(`/stadiums/${stadiumId}/layouts`),

  layoutDetail: (layoutId: number) => http.get<StadiumLayoutDetail>(`/stadium-layouts/${layoutId}`),

  updateLayout: (layoutId: number, body: StadiumLayoutUpdateRequest) =>
    http.patch<void>(`/admin/stadium-layouts/${layoutId}`, body),

  deleteLayout: (layoutId: number) => http.delete<void>(`/admin/stadium-layouts/${layoutId}`),

  layoutAreas: (layoutId: number) =>
    http.get<PersistedAreaList>(`/stadium-layouts/${layoutId}/areas`),

  areaSeats: (areaId: number) => http.get<PersistedSeatList>(`/areas/${areaId}/seats`),
};

export const stadiumKeys = {
  all: ['stadium'] as const,
  list: () => [...stadiumKeys.all, 'list'] as const,
  detail: (stadiumId: number) => [...stadiumKeys.all, stadiumId, 'detail'] as const,
  layouts: (stadiumId: number) => [...stadiumKeys.all, stadiumId, 'layouts'] as const,
  layoutDetail: (layoutId: number) => [...stadiumKeys.all, 'layout', layoutId] as const,
  layoutPreview: (layoutId: number) => [...stadiumKeys.all, 'layout', layoutId, 'preview'] as const,
};
