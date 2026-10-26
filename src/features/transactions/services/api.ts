import { supabase } from '../../../services/supabase';

export interface Transaction {
  id: string;
  farm_id: string;
  plot_id?: string | null;
  amount: number;
  category: string;
  description: string;
  transaction_date: string;
  created_by: string;
  type: 'income' | 'expense';
  created_at?: string;
  plots?: { name: string } | null; 
}

export type CreateTransactionDTO = Omit<Transaction, 'id' | 'created_by'>;
export type UpdateTransactionDTO = Partial<CreateTransactionDTO>;

export async function createTransaction(transaction: CreateTransactionDTO) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  
  if (!userId) throw new Error("Utilizador não logado");

  const { data, error } = await supabase
    .from('transactions')
    .insert([{ 
      ...transaction,
      created_by: userId
    }])
    .select()
    .single();

  if (error) throw error;
  return data as Transaction;
}

export async function getTransactions(farmId: string, category?: string, allFarmIds: string[] = []) {
  let query = supabase
    .from('transactions')
    .select('*, plots(name)')
    .order('transaction_date', { ascending: false });

  if (farmId === 'all') {
    query = query.in('farm_id', allFarmIds);
  } else {
    query = query.eq('farm_id', farmId);
  }

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return data as Transaction[];
}

export async function updateTransaction(id: string, transaction: UpdateTransactionDTO) {
  const { data, error } = await supabase
    .from('transactions')
    .update(transaction)
    .eq('id', id)
    .select(); 

  if (error) throw error;
  
  return data && data.length > 0 ? data[0] : null;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
}