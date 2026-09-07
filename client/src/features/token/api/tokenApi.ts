import { http } from '@/shared/api';
import type { TokenBalance } from '../model/token.types';

export const tokenApi = {
  balance: () => http.get<TokenBalance>('/users/me/balance'),
};

export const tokenKeys = {
  all: ['token'] as const,
  balance: () => [...tokenKeys.all, 'balance'] as const,
};
