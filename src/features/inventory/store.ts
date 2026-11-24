import { supabase } from "../../services/supabase";
import type {
  ErpRpc,
  InputFamily,
  InputsRow,
  InputLotsRow,
  LotDemandRow,
  StockMovesRow,
} from "../../shared/contracts/erp";
import { readRows, localDay } from "../../shared/erpData";

export const families: Record<InputFamily, string> = {
  seed: "Sementes",
  pesticide: "Defensivos",
  fertilizer: "Fertilizantes",
  adjuvant: "Adjuvantes",
  fuel: "Combustíveis",
};
export type Product = Pick<InputsRow, "name" | "family" | "unit" | "minimum">;
export type Lot = Pick<InputLotsRow, "input_id" | "code" | "expires_on">;
export type Receipt = ErpRpc["receive_stock"]["Args"];
export interface Inventory {
  inputs: InputsRow[];
  lots: InputLotsRow[];
  demand: LotDemandRow[];
}
interface DemoStock extends Inventory {
  moves: StockMovesRow[];
}
const demoKey = "agro:demo:almoxarifado:v1";
function demoSeed(): DemoStock {
  const examples: [string, InputFamily, string, number, number, number][] = [
    ["Semente de soja • BMX", "seed", "kg", 480, 550, 6.4],
    ["Diesel S10", "fuel", "L", 1290, 400, 6.18],
    ["Fertilizante NPK 05-20-20", "fertilizer", "kg", 3200, 800, 3.25],
    ["Óleo vegetal", "adjuvant", "L", 80, 20, 14.8],
  ];
  const inputs = examples.map(
    ([name, family, unit, qty, minimum, cost], i) => ({
      id: "sku-" + i,
      farm_id: "demo",
      name,
      family,
      unit,
      quantity: qty,
      minimum,
      avg_cost: cost,
      carrying_value: qty * cost,
    }),
  );
  const lots = inputs.map((p, i) => ({
    id: "lote-" + i,
    farm_id: "demo",
    input_id: p.id,
    code: ["SO-042", "DS-118", "NP-231", "OV-017"][i],
    expires_on: i === 1 ? null : "2028-08-31",
    quantity: p.quantity,
  }));
  const moves = inputs.map(
    (p, i): StockMovesRow => ({
      id: "entrada-" + i,
      farm_id: "demo",
      lot_id: lots[i].id,
      event: "receipt",
      qty: p.quantity,
      unit_cost: p.avg_cost,
      extended_cost: p.carrying_value,
      document: "NF " + (2401 + i),
      order_id: null,
      machine_id: null,
      cycle_id: null,
      meter_reading: null,
      prior_meter: null,
      recorded_at: new Date().toISOString(),
      created_by: "demo",
    }),
  );
  return {
    inputs,
    lots,
    moves,
    demand: [
      {
        farm_id: "demo",
        lot_id: lots[0].id,
        input_id: inputs[0].id,
        first_operation: localDay(),
        required_qty: 620,
        available_qty: 480,
        shortage_qty: 140,
      },
    ],
  };
}
export function demoStock(): DemoStock {
  const saved = sessionStorage.getItem(demoKey);
  if (saved) return JSON.parse(saved) as DemoStock;
  const data = demoSeed();
  sessionStorage.setItem(demoKey, JSON.stringify(data));
  return data;
}
function persist(data: DemoStock) {
  sessionStorage.setItem(demoKey, JSON.stringify(data));
}
export async function loadInventory(
  ids: string[],
  demo: boolean,
  signal: AbortSignal,
): Promise<Inventory> {
  if (demo) return demoStock();
  const [inputs, lots, demand] = await Promise.all([
    readRows("inputs", ids, signal),
    readRows("input_lots", ids, signal),
    readRows("lot_demand", ids, signal),
  ]);
  return { inputs, lots, demand };
}
export async function history(
  farm: string,
  lots: string[],
  demo: boolean,
  signal: AbortSignal,
) {
  if (demo)
    return demoStock()
      .moves.filter((m) => lots.includes(m.lot_id))
      .reverse();
  const moves: StockMovesRow[] = [];
  for (let from = 0; from < lots.length; from += 50) {
    moves.push(...await readRows("stock_moves", [farm], signal, { lot_id: lots.slice(from, from + 50) }));
  }
  return moves.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
}
export async function addProduct(farm: string, p: Product, demo: boolean) {
  if (!demo) {
    const { error } = await supabase
      .from("inputs")
      .insert({ ...p, farm_id: farm });
    if (error) throw error;
    return;
  }
  const data = demoStock();
  if (data.inputs.some((i) => i.name === p.name))
    throw Error("Nome de insumo já cadastrado.");
  data.inputs.push({
    ...p,
    id: crypto.randomUUID(),
    farm_id: farm,
    quantity: 0,
    carrying_value: 0,
    avg_cost: null,
  });
  persist(data);
}
export async function addLot(farm: string, lot: Lot, demo: boolean) {
  if (!demo) {
    const { error } = await supabase
      .from("input_lots")
      .insert({ ...lot, farm_id: farm });
    if (error) throw error;
    return;
  }
  const data = demoStock();
  if (data.lots.some((l) => l.input_id === lot.input_id && l.code === lot.code))
    throw Error("Código já utilizado neste insumo.");
  data.lots.push({
    ...lot,
    id: crypto.randomUUID(),
    farm_id: farm,
    quantity: 0,
  });
  persist(data);
}
export async function receive(args: Omit<Receipt, "p_request">, demo: boolean) {
  // Mantém a identidade da intenção após timeout, remount ou recarga da aba.
  const key = "agro:entrada:" + JSON.stringify(args);
  const id = sessionStorage.getItem(key) || crypto.randomUUID();
  sessionStorage.setItem(key, id);
  if (demo) {
    const data = demoStock();
    if (!data.moves.some((m) => m.id === id)) {
      const lot = data.lots.find((l) => l.id === args.p_lot)!;
      const item = data.inputs.find((i) => i.id === lot.input_id)!;
      const total = Number((args.p_qty * args.p_unit_cost).toFixed(8));
      lot.quantity = Number((lot.quantity + args.p_qty).toFixed(4));
      item.quantity = Number((item.quantity + args.p_qty).toFixed(4));
      item.carrying_value += total;
      item.avg_cost = item.carrying_value / item.quantity;
      data.moves.push({
        id,
        farm_id: "demo",
        lot_id: lot.id,
        event: "receipt",
        qty: args.p_qty,
        unit_cost: args.p_unit_cost,
        extended_cost: total,
        document: args.p_document,
        order_id: null,
        machine_id: null,
        cycle_id: null,
        meter_reading: null,
        prior_meter: null,
        created_by: "demo",
        recorded_at: new Date().toISOString(),
      });
      for (const d of data.demand.filter((d) => d.lot_id === lot.id)) {
        d.available_qty = lot.quantity;
        d.shortage_qty = Math.max(0, (d.required_qty ?? 0) - lot.quantity);
      }
      persist(data);
    }
  } else {
    const { error } = await supabase.rpc("receive_stock", {
      ...args,
      p_request: id,
    });
    if (error) {
      const { data } = await supabase
        .from("stock_moves")
        .select("lot_id,qty,unit_cost,document,event")
        .eq("farm_id", args.p_farm)
        .eq("id", id)
        .maybeSingle();
      if (
        !data ||
        data.event !== "receipt" ||
        data.lot_id !== args.p_lot ||
        Number(data.qty) !== args.p_qty ||
        Number(data.unit_cost) !== args.p_unit_cost ||
        data.document !== args.p_document
      )
        throw error;
    }
  }
  sessionStorage.removeItem(key);
}
