import { readRows } from "../../shared/erpData";
import type { CostBasis } from "../../shared/contracts/scalars";
import type { BillsRow, TransactionsRow } from "./contracts";

export const basisNames: Record<CostBasis, string> = {
  direct: "Despesa direta", inventory: "Compra de insumos", equipment: "Maquinário",
  sale: "Venda da produção", other: "Outros",
};

export async function loadFinance(ids: string[], signal: AbortSignal) {
  const [bills, transactions, economics, cycles, seasons, receipts, loads, maintenance] = await Promise.all([
    readRows("bills", ids, signal), readRows("transactions", ids, signal),
    readRows("cycle_economics", ids, signal), readRows("crop_cycles", ids, signal), readRows("seasons", ids, signal),
    readRows("stock_moves", ids, signal, { event: "receipt" }), readRows("harvest_loads", ids, signal),
    readRows("maintenance", ids, signal),
  ]);
  bills.sort((a, b) => a.due_on.localeCompare(b.due_on));
  transactions.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  return { bills, transactions, economics, cycles, seasons, receipts, loads, maintenance };
}
export type FinanceData = Awaited<ReturnType<typeof loadFinance>>;

export function cashByMonth(transactions: TransactionsRow[], bills: BillsRow[]) {
  const months = new Map<string, { income: number; expense: number; payable: number; receivable: number }>();
  function month(date: string) {
    const key = date.slice(0, 7);
    const row = months.get(key) ?? { income: 0, expense: 0, payable: 0, receivable: 0 };
    months.set(key, row);
    return row;
  }
  for (const tx of transactions) {
    if (tx.type === "income" || tx.type === "expense") month(tx.transaction_date)[tx.type] += Number(tx.amount);
  }
  for (const bill of bills) {
    if (!bill.settled_on) month(bill.due_on)[bill.kind] += Number(bill.amount);
  }
  return [...months].sort(([a], [b]) => b.localeCompare(a));
}
