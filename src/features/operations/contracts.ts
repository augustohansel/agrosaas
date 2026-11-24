import type { JobKind, JobState, LocalDate, Timestamp, UUID } from '../../shared/contracts/scalars';

/** public.work_orders */
export interface WorkOrdersRow {
  id: UUID;
  farm_id: UUID;
  cycle_id: UUID;
  machine_id: UUID;
  operator_id: UUID;
  kind: JobKind;
  planned_on: LocalDate;
  area_ha: number;
  status: JobState;
  finished_at: Timestamp | null;
  worked_hours: number | null;
  start_meter: number | null;
  prior_finish_meter: number | null;
  machine_cost: number | null;
  input_cost: number | null;
}

/** public.order_inputs */
export interface OrderInputsRow {
  farm_id: UUID;
  order_id: UUID;
  lot_id: UUID;
  dose_per_ha: number;
}

/** public.field_operations */
export interface FieldOperationsRow {
  id: UUID;
  farm_id: UUID;
  plot_id: UUID | null;
  operation: string;
  machine: string;
  starts_at: Timestamp;
  progress: number;
  service_hours: number | null;
  input_name: string | null;
  input_unit: string | null;
  available: number | null;
  required_qty: number | null;
  updated_at: Timestamp;
  order_id: UUID | null;
}
