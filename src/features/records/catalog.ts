import { jobNames, jobStates } from "../overview/data";
import { transactionCategories } from "../transactions/categories";

export type Row = Record<string, string | number | boolean | null>;
export type Table = keyof typeof groupsByTable;
export type Field = {
  key: string;
  label: string;
  type?: "date" | "number";
  optional?: boolean;
  options?: Record<string, string>;
};
const text = (key: string, label: string): Field => ({ key, label });
const num = (key: string, label: string, optional = false): Field => ({
  key,
  label,
  type: "number",
  optional,
});
const date = (key: string, label: string, optional = false): Field => ({
  key,
  label,
  type: "date",
  optional,
});
const groupsByTable = {
  seasons: "Safras",
  crop_cycles: "Ciclos de cultivo",
  stage_history: "Histórico de estágios",
  inputs: "Insumos",
  input_lots: "Lotes",
  stock_moves: "Movimentações de estoque",
  machines: "Máquinas",
  work_orders: "Ordens de serviço",
  order_inputs: "Doses por OS",
  maintenance: "Manutenções",
  destinations: "Destinos",
  harvest_loads: "Romaneios",
  grain_dispatches: "Expedições",
  bills: "Contas a pagar e receber",
};
export const names = groupsByTable;
export const groups: Record<string, Table[]> = {
  "/safras": ["seasons", "crop_cycles", "stage_history"],
  "/estoque": ["inputs", "input_lots", "stock_moves"],
  "/operacoes": [
    "work_orders",
    "order_inputs",
    "machines",
    "maintenance",
    "stock_moves",
  ],
  "/colheita": ["harvest_loads", "destinations", "grain_dispatches"],
  "/economia": ["bills"],
};
const name = text("name", "Nome");
const fields: Record<Table, Field[]> = {
  seasons: [name, date("starts_on", "Início"), date("ends_on", "Fim")],
  crop_cycles: [
    text("crop", "Cultura"),
    num("bag_kg", "Peso da saca (kg)"),
    num("forecast_sc_ha", "Previsão (sc/ha)"),
    num("price_per_bag", "Preço por saca (R$)"),
    num("budget_cost", "Orçamento (R$)"),
  ],
  stage_history: [text("stage", "Estágio observado")],
  inputs: [name, num("minimum", "Estoque mínimo")],
  input_lots: [
    text("code", "Código do lote"),
    date("expires_on", "Validade", true),
  ],
  machines: [
    name,
    text("kind", "Tipo"),
    num("hourly_rate", "Custo por hora (R$)"),
  ],
  maintenance: [
    text("description", "Descrição"),
    date("due_on", "Data prevista", true),
    num("due_meter", "Leitura prevista", true),
    num("cost", "Custo (R$)"),
    date("completed_on", "Conclusão", true),
  ],
  work_orders: [
    { key: "kind", label: "Operação", options: jobNames },
    date("planned_on", "Data planejada"),
    num("area_ha", "Área (ha)"),
  ],
  order_inputs: [num("dose_per_ha", "Dose por hectare")],
  destinations: [
    name,
    {
      key: "kind",
      label: "Tipo",
      options: {
        silo: "Silo próprio",
        cooperative: "Cooperativa",
        trader: "Trading",
      },
    },
  ],
  harvest_loads: [
    text("ticket", "Romaneio"),
    date("received_on", "Recebimento"),
    num("gross_kg", "Peso bruto (kg)"),
    num("tare_kg", "Tara (kg)"),
    num("deduction_kg", "Desconto (kg)"),
    num("moisture_pct", "Umidade (%)"),
    num("impurity_pct", "Impurezas (%)"),
  ],
  grain_dispatches: [
    text("document", "Documento"),
    text("recipient", "Destinatário"),
    date("shipped_on", "Expedição"),
    num("kg", "Peso (kg)"),
  ],
  bills: [
    text("description", "Descrição"),
    num("amount", "Valor (R$)"),
    date("due_on", "Vencimento"),
  ],
  stock_moves: [
    num("qty", "Quantidade"),
    num("unit_cost", "Custo unitário (R$)"),
    text("document", "Documento"),
  ],
};
export function editFields(table: Table, row: Row): Field[] {
  if (table === "bills") {
    const options =
      transactionCategories[row.kind === "payable" ? "expense" : "income"];
    return [
      ...fields.bills,
      {
        key: "category",
        label: "Categoria",
        options: Object.fromEntries(options.map((v) => [v, v])),
      },
    ];
  }
  if (table === "stock_moves" && row.event === "refuel")
    return fields.stock_moves.slice(0, 1);
  return fields[table];
}
export function caption(row: Row, refs: Map<string, string>): string {
  const link = (id: unknown) => refs.get(String(id));
  const event = {
    refuel: "Abastecimento",
    receipt: "Entrada",
    work_order: "Baixa de OS",
  }[String(row.event)];
  const kind = jobNames[row.kind as keyof typeof jobNames];
  const status = jobStates[row.status as keyof typeof jobStates];
  const amount =
    row.amount == null
      ? ""
      : Number(row.amount).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
  const parts = [
    row.name ||
      row.description ||
      row.ticket ||
      row.document ||
      row.code ||
      event ||
      kind ||
      row.crop ||
      row.stage ||
      (row.order_id ? "Dose por hectare" : ""),
    link(row.plot_id) || link(row.cycle_id),
    link(row.machine_id),
    link(row.input_id) || link(row.lot_id),
    link(row.order_id),
    row.qty ?? row.dose_per_ha,
    amount,
    status,
    row.planned_on ||
      row.due_on ||
      row.shipped_on ||
      String(row.recorded_at || row.observed_at || "").slice(0, 10),
  ];
  return parts.filter((v) => v !== "" && v != null).join(" · ");
}
