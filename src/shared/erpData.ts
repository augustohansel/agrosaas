import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import type {
  InputsRow,
  InputLotsRow,
  StockMovesRow,
  LotDemandRow,
  SeasonsRow,
  StageHistoryRow,
  CropCyclesRow,
  CycleEconomicsRow,
  FarmAlertsRow,
  WorkOrdersRow,
  MachinesRow,
  OrderInputsRow,
  BillsRow,
  TransactionsRow,
  MaintenanceRow,
  DestinationsRow,
  HarvestLoadsRow,
  GrainDispatchesRow,
  GrainBalancesRow,
} from "./contracts/erp";

interface Tables {
  inputs: InputsRow;
  input_lots: InputLotsRow;
  stock_moves: StockMovesRow;
  lot_demand: LotDemandRow;
  seasons: SeasonsRow;
  stage_history: StageHistoryRow;
  cycle_economics: CycleEconomicsRow;
  farm_alerts: FarmAlertsRow;
  work_orders: WorkOrdersRow;
  machines: MachinesRow;
  order_inputs: OrderInputsRow;
  bills: BillsRow;
  transactions: TransactionsRow;
  maintenance: MaintenanceRow;
  crop_cycles: CropCyclesRow;
  destinations: DestinationsRow;
  harvest_loads: HarvestLoadsRow;
  grain_dispatches: GrainDispatchesRow;
  grain_balances: GrainBalancesRow;
}
const orderKey = {
  grain_balances: "destination_id",
  lot_demand: "lot_id",
  order_inputs: "order_id",
  cycle_economics: "cycle_id",
  farm_alerts: "source_id",
};
export async function readRows<K extends keyof Tables>(
  table: K,
  ids: string[],
  signal: AbortSignal,
  filters: Partial<Record<keyof Tables[K], string | string[]>> = {},
): Promise<Tables[K][]> {
  if (!ids.length) return [];
  const rows: Tables[K][] = [];
  const key =
    table in orderKey ? orderKey[table as keyof typeof orderKey] : "id";
  for (let offset = 0; ; ) {
    let query = supabase.from(table).select("*", { count: "exact" }).in("farm_id", ids).order(key);
    if (table === "farm_alerts") query = query.order("kind");
    if (table === "order_inputs") query = query.order("lot_id");
    if (table === "grain_balances") query = query.order("cycle_id");
    for (const [column, value] of Object.entries(filters))
      query = Array.isArray(value) ? query.in(column, value) : query.eq(column, value);
    const { data, error, count } = await query
      .range(offset, offset + 499)
      .abortSignal(signal);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as Tables[K][]));
    offset += data.length;
    if (count !== null ? offset >= count : data.length < 500) break;
  }
  return rows;
}
export function issueMessage(error: unknown) {
  const e = error as { code?: string; message?: string };
  if (e.code === "PGRST205" || e.code === "42P01" || e.code === "PGRST202")
    return "Estrutura do ERP indisponível nesta base. Confira as migrations no ambiente de homologação.";
  if (e.code === "23505")
    return "Já existe um cadastro com esta identificação.";
  if (e.code === "42501")
    return "Seu perfil não tem permissão para esta operação.";
  return e.message || "Falha de conexão. Tente novamente.";
}
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [result, setResult] = useState<{ data?: T; error?: string }>({});
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult({});
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ error: issueMessage(error) });
      });
    return () => controller.abort();
  }, [load, version]);
  return { ...result, reload: () => setVersion((n) => n + 1) };
}
export function localDay(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}
export const quantity = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const displayDate = (v: string) => v.split("-").reverse().join("/");
