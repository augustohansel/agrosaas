import type { LocalDate, UUID } from '../../shared/contracts/scalars';

/** public.farm_alerts */
export interface FarmAlertsRow {
  farm_id: UUID | null;
  kind: string | null;
  source_id: UUID | null;
  label: string | null;
  due_on: LocalDate | null;
}
