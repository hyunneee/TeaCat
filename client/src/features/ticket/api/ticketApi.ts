import { http } from '@/shared/api';
import type { CancelResult, Ticket, TicketStatus } from '../model/ticket.types';

export const ticketApi = {
  list: (status?: TicketStatus) => http.get<Ticket[]>('/me/tickets', { params: { status } }),

  detail: (ticketId: string) => http.get<Ticket>(`/me/tickets/${ticketId}`),

  cancel: (ticketId: string) => http.post<CancelResult>(`/me/tickets/${ticketId}/cancel`),
};

export const ticketKeys = {
  all: ['ticket'] as const,
  list: (status?: TicketStatus) => [...ticketKeys.all, 'list', status ?? 'ALL'] as const,
  detail: (ticketId: string) => [...ticketKeys.all, 'detail', ticketId] as const,
};
