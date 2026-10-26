import { supabase } from '../../../services/supabase';

export interface Plot {
  id: string;
  farm_id: string;
  name: string;
  coordinates: any; // Mapeia o JSONB do seu banco
  created_at: string;
}

export type CreatePlotDTO = Omit<Plot, 'id' | 'created_at'>;
export type UpdatePlotDTO = Partial<CreatePlotDTO>;

export async function getPlots(farmId: string, allFarmIds: string[] = []) {
  let query = supabase.from('plots').select('*').order('name');
  
  if (farmId === 'all') {
    query = query.in('farm_id', allFarmIds);
  } else {
    query = query.eq('farm_id', farmId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Plot[];
}

export async function createPlot(plot: CreatePlotDTO) {
  const { data, error } = await supabase
    .from('plots')
    .insert([plot])
    .select();

  if (error) throw error;
  return data?.[0] as Plot;
}

export async function updatePlot(id: string, plot: UpdatePlotDTO) {
  const { data, error } = await supabase
    .from('plots')
    .update(plot)
    .eq('id', id)
    .select();

  if (error) throw error;
  return data?.[0] as Plot;
}

export async function deletePlot(id: string) {
  const { error } = await supabase
    .from('plots')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}