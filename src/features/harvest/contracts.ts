import type { LocalDate, StorageKind, UUID } from '../../shared/contracts/scalars';

/** public.destinations */
export interface DestinationsRow {
  id: UUID;
  farm_id: UUID;
  name: string;
  kind: StorageKind;
}

/** public.harvest_loads */
export interface HarvestLoadsRow {
  id: UUID;
  farm_id: UUID;
  cycle_id: UUID;
  destination_id: UUID;
  ticket: string;
  received_on: LocalDate;
  gross_kg: number;
  tare_kg: number;
  moisture_pct: number;
  impurity_pct: number;
  deduction_kg: number;
  net_kg: number | null;
}

/** public.grain_dispatches */
export interface GrainDispatchesRow {
  id: UUID;
  farm_id: UUID;
  cycle_id: UUID;
  destination_id: UUID;
  document: string;
  shipped_on: LocalDate;
  kg: number;
  recipient: string;
}

/** public.grain_balances */
export interface GrainBalancesRow {
  farm_id: UUID | null;
  destination_id: UUID | null;
  cycle_id: UUID | null;
  kg: number | null;
}
