import { http } from '@/shared/api';
import type {
  ExcelAnalysis,
  PersistedAreaList,
  PersistedSeatList,
  StadiumCreateResponse,
  StadiumInfoDraft,
  StadiumList,
  StadiumLayoutCreateResponse,
  StadiumLayoutDetail,
  StadiumLayoutList,
} from '../model/stadium.types';

export interface StadiumLayoutCreatePayload {
  analysisId?: string;
  name: string;
  isDefault: boolean;
  sourceSheet?: string;
  layoutWidth: number;
  layoutHeight: number;
  areas: unknown[];
  layoutElements: unknown[];
}

export const stadiumApi = {
  list: () => http.get<StadiumList>('/stadiums'),

  create: (info: StadiumInfoDraft) =>
    http.post<StadiumCreateResponse>('/admin/stadiums', {
      name: info.name.trim(),
      address: info.address.trim(),
      phone: info.phone.trim() || null,
    }),

  analyzeExcel: (stadiumId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return http.post<ExcelAnalysis>(
      `/admin/stadiums/${stadiumId}/layout-imports/excel`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },

  createLayout: (stadiumId: number, payload: StadiumLayoutCreatePayload) =>
    http.post<StadiumLayoutCreateResponse>(`/admin/stadiums/${stadiumId}/layouts`, payload),

  copyLayout: (layoutId: number, name: string) =>
    http.post<StadiumLayoutCreateResponse>(`/admin/stadium-layouts/${layoutId}/copies`, {
      name: name.trim(),
      isDefault: false,
    }),

  layouts: (stadiumId: number) => http.get<StadiumLayoutList>(`/stadiums/${stadiumId}/layouts`),

  layoutDetail: (layoutId: number) => http.get<StadiumLayoutDetail>(`/stadium-layouts/${layoutId}`),

  layoutAreas: (layoutId: number) =>
    http.get<PersistedAreaList>(`/stadium-layouts/${layoutId}/areas`),

  areaSeats: (areaId: number) => http.get<PersistedSeatList>(`/areas/${areaId}/seats`),
};

export const stadiumKeys = {
  all: ['stadium'] as const,
  list: () => [...stadiumKeys.all, 'list'] as const,
  layouts: (stadiumId: number) => [...stadiumKeys.all, stadiumId, 'layouts'] as const,
};
