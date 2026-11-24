import type { LocalDate, Timestamp, UUID } from '../../shared/contracts/scalars';

/** public.seasons */
export interface SeasonsRow {
  id: UUID;
  farm_id: UUID;
  name: string;
  starts_on: LocalDate;
  ends_on: LocalDate;
  active: boolean;
}

/** public.crop_cycles */
export interface CropCyclesRow {
  id: UUID;
  farm_id: UUID;
  season_id: UUID;
  plot_id: UUID;
  crop: string;
  stage: string;
  area_ha: number;
  bag_kg: number;
  forecast_sc_ha: number;
  price_per_bag: number;
  budget_cost: number;
}

/** public.stage_history */
export interface StageHistoryRow {
  id: UUID;
  farm_id: UUID;
  cycle_id: UUID;
  stage: string;
  observed_at: Timestamp;
  recorded_by: UUID | null;
}
