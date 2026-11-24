import type { Json, Timestamp, UUID } from '../../shared/contracts/scalars';

/** public.profiles */
export interface ProfilesRow {
  id: UUID;
  full_name: string | null;
  created_at: Timestamp;
}

/** public.farms */
export interface FarmsRow {
  id: UUID;
  name: string;
  created_at: Timestamp;
  latitude: number | null;
  longitude: number | null;
  created_by: UUID | null;
}

/** public.farm_members */
export interface FarmMembersRow {
  farm_id: UUID;
  user_id: UUID;
  role: string;
}

/** public.plots */
export interface PlotsRow {
  id: UUID;
  farm_id: UUID;
  name: string;
  color: string | null;
  coordinates: Json;
  created_at: Timestamp;
}
