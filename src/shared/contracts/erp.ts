import type { JobState, LocalDate, UUID } from './scalars';

export type * from '../../features/identity/contracts';
export type * from '../../features/seasons/contracts';
export type * from '../../features/inventory/contracts';
export type * from '../../features/operations/contracts';
export type * from '../../features/fleet/contracts';
export type * from '../../features/harvest/contracts';
export type * from '../../features/finance/contracts';
export type * from '../../features/overview/contracts';
export type * from './scalars';

/** Chaves e nomes dos argumentos aceitos pela API rpc do Supabase. */
export interface ErpRpc {
  receive_stock: {
    Args: { p_request: UUID; p_farm: UUID; p_lot: UUID; p_qty: number; p_unit_cost: number; p_document: string };
    Returns: UUID;
  };
  refuel_machine: {
    Args: { p_request: UUID; p_farm: UUID; p_lot: UUID; p_qty: number; p_machine: UUID; p_meter: number; p_cycle?: UUID | null };
    Returns: UUID;
  };
  advance_order: {
    Args: { p_farm: UUID; p_order: UUID; p_status: JobState; p_hours?: number | null; p_end_meter?: number | null };
    Returns: void;
  };
  settle_bill: {
    Args: { p_farm: UUID; p_bill: UUID; p_date: LocalDate };
    Returns: UUID;
  };
}
