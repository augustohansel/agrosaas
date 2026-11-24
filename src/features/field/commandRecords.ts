import { readRows, brl, displayDate } from "../../shared/erpData";
import { jobNames, jobStates } from "../overview/data";

export interface CommandRecord {
  id: string; label: string; detail: string; farm: string; path: string;
}

export async function commandRecords(ids: string[], signal: AbortSignal): Promise<CommandRecord[]> {
  const [lots, inputs, orders, bills, machines] = await Promise.all([
    readRows("input_lots", ids, signal), readRows("inputs", ids, signal),
    readRows("work_orders", ids, signal), readRows("bills", ids, signal), readRows("machines", ids, signal),
  ]);
  const names = new Map(inputs.map(i => [i.id, i.name]));
  return [
    ...lots.map(l => ({ id: l.id, farm: l.farm_id, label: l.code, detail: "Lote · " + names.get(l.input_id), path: "/estoque?insumo=" + l.input_id })),
    ...inputs.map(i => ({ id: i.id, farm: i.farm_id, label: i.name, detail: "Insumo", path: "/estoque?insumo=" + i.id })),
    ...orders.map(o => ({ id: o.id, farm: o.farm_id, label: jobNames[o.kind], detail: "OS " + o.id.slice(0, 8) + " · " + jobStates[o.status] + " · " + displayDate(o.planned_on), path: "/operacoes?os=" + o.id })),
    ...machines.map(m => ({ id: m.id, farm: m.farm_id, label: m.name, detail: "Máquina · " + m.kind, path: "/operacoes?maquina=" + m.id })),
    ...bills.map(b => ({ id: b.id, farm: b.farm_id, label: b.description, detail: "Título " + (b.kind === "payable" ? "a pagar" : "a receber") + " · " + brl(b.amount), path: "/economia?titulo=" + b.id })),
  ];
}

export const normalizeSearch = (s: string) => s.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
