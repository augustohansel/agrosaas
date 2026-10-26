import { supabase } from '../../../services/supabase';

export interface Farm {
  id: string;
  name: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

export async function createFarm(name: string) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não logado");

  const { data: farm, error: farmError } = await supabase
    .from('farms')
    .insert([{ name }]) 
    .select()
    .single();

  if (farmError) throw farmError;

  const { error: memberError } = await supabase
    .from('farm_members')
    .insert([{ 
      farm_id: farm.id, 
      user_id: userId,
      role: 'owner' 
    }]);

  if (memberError) throw memberError;

  return farm as Farm;
}

export async function getMyFarms() {
  // 1. Identificar quem é o utilizador atual
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  
  if (!userId) throw new Error("Usuário não logado");

  // 2. Buscar apenas as fazendas onde este utilizador específico é membro
  const { data, error } = await supabase
    .from('farms')
    .select(`
      *,
      farm_members!inner(user_id)
    `)
    .eq('farm_members.user_id', userId); // <-- O filtro crucial adicionado aqui

  if (error) throw error;
  return data as Farm[];
}

export async function updateFarmLocation(farmId: string, latitude: number, longitude: number) {
  const { error } = await supabase
    .from('farms')
    .update({ latitude, longitude })
    .eq('id', farmId);

  if (error) throw error;
}

export async function updateFarm(farmId: string, name: string) {
  const { error } = await supabase
    .from('farms')
    .update({ name })
    .eq('id', farmId);

  if (error) throw error;
  return true;
}

export async function deleteFarm(farmId: string) {
  const { error } = await supabase
    .from('farms')
    .delete()
    .eq('id', farmId);

  if (error) throw error;
  return true;
}