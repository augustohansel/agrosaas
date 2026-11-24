import type { BillKind, CostBasis, LocalDate, Timestamp, UUID } from '../../shared/contracts/scalars';

/** public.bills */
export interface BillsRow {
  id: UUID;
  farm_id: UUID;
  cycle_id: UUID | null;
  kind: BillKind;
  basis: CostBasis;
  category: string | null;
  description: string;
  amount: number;
  due_on: LocalDate;
  settled_on: LocalDate | null;
  transaction_id: UUID | null;
  receipt_id: UUID | null;
  harvest_id: UUID | null;
  maintenance_id: UUID | null;
}

/** public.transactions */
export interface TransactionsRow {
  id: UUID;
  farm_id: UUID;
  amount: number;
  category: string;
  description: string | null;
  transaction_date: LocalDate;
  created_by: UUID;
  created_at: Timestamp;
  type: string | null;
  plot_id: UUID | null;
  cycle_id: UUID | null;
  cost_basis: CostBasis | null;
}

/** public.cycle_economics */
export interface CycleEconomicsRow {
  farm_id: UUID | null;
  season_id: UUID | null;
  plot_id: UUID | null;
  cycle_id: UUID | null;
  area_ha: number | null;
  harvested_kg: number | null;
  actual_sc_ha: number | null;
  actual_cost: number | null;
  cost_per_ha: number | null;
  projected_margin: number | null;
  realized_margin: number | null;
  received_revenue: number | null;
}
