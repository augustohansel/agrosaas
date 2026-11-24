import type { InputFamily, LocalDate, StockEvent, Timestamp, UUID } from '../../shared/contracts/scalars';

/** public.inputs */
export interface InputsRow {
  id: UUID;
  farm_id: UUID;
  name: string;
  family: InputFamily;
  unit: string;
  minimum: number;
  quantity: number;
  carrying_value: number;
  avg_cost: number | null;
}

/** public.input_lots */
export interface InputLotsRow {
  id: UUID;
  farm_id: UUID;
  input_id: UUID;
  code: string;
  expires_on: LocalDate | null;
  quantity: number;
}

/** public.stock_moves */
export interface StockMovesRow {
  id: UUID;
  farm_id: UUID;
  lot_id: UUID;
  event: StockEvent;
  qty: number;
  unit_cost: number;
  extended_cost: number;
  document: string | null;
  order_id: UUID | null;
  machine_id: UUID | null;
  cycle_id: UUID | null;
  meter_reading: number | null;
  prior_meter: number | null;
  recorded_at: Timestamp;
  created_by: UUID;
}
/** public.lot_demand · demanda aberta até os próximos sete dias. */
export interface LotDemandRow {
  farm_id: UUID | null;
  lot_id: UUID | null;
  input_id: UUID | null;
  first_operation: string | null;
  required_qty: number | null;
  available_qty: number | null;
  shortage_qty: number | null;
}
