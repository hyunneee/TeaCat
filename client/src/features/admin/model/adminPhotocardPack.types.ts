export type AdminPhotocardPackStatus =
  | 'OPENABLE'
  | 'SCHEDULED'
  | 'PREPARING'
  | 'CONSUMED'
  | 'INVALIDATED';

export interface AdminPhotocardPack {
  packId: number;
  source: string;
  title: string | null;
  openAt: string | null;
  status: AdminPhotocardPackStatus;
  consumedAt: string | null;
  invalidatedAt: string | null;
  invalidatedReason: string | null;
  invalidatedBy: number | null;
}
