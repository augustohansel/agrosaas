import type { LocalDate, MeterKind, UUID } from '../../shared/contracts/scalars';

/** public.machines */
export interface MachinesRow {
  id: UUID;
  farm_id: UUID;
  name: string;
  kind: string;
  meter_unit: MeterKind;
  meter: number;
  hourly_rate: number;
}

/** public.maintenance */
export interface MaintenanceRow {
  id: UUID;
  farm_id: UUID;
  machine_id: UUID;
  kind: string;
  description: string;
  due_on: LocalDate | null;
  due_meter: number | null;
  completed_on: LocalDate | null;
  cost: number;
}
