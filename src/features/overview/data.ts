import {
  displayDate,
  localDay,
  quantity,
  readRows,
} from "../../shared/erpData";
import type { Field } from "../field/model";
import type {
  FarmAlertsRow,
  JobKind,
  JobState,
} from "../../shared/contracts/erp";
import { demoStock } from "../inventory/store";

export interface CycleIndicator {
  id: string;
  season: string;
  plot: string;
  crop: string;
  stage: string;
  area: number;
  cost: number;
  projected: number;
  realized: number;
}
interface Alert {
  key: string;
  farm: string;
  kind: string;
  label: string;
  summary: string;
  source: string;
  input?: string;
}
interface Agenda {
  id: string;
  cycle: string;
  plot: string;
  kind: JobKind;
  status: JobState;
  ha: number;
}
export interface OverviewData {
  seasons: { id: string; name: string; active: boolean; farm: string }[];
  cycles: CycleIndicator[];
  alerts: Alert[];
  orders: Agenda[];
}
export const jobNames: Record<JobKind, string> = {
  planting: "Plantio",
  spraying: "Pulverização",
  fertilizing: "Adubação",
  harvesting: "Colheita",
};
export const jobStates: Record<JobState, string> = {
  planned: "Planejada",
  running: "Em execução",
  completed: "Concluída",
  cancelled: "Cancelada",
};
export function demoOverview(fields: Field[]): OverviewData {
  const stock = demoStock();
  const alerts: Alert[] = stock.inputs
    .filter((i) => i.quantity <= i.minimum)
    .map((i) => ({
      key: i.id,
      farm: "demo",
      kind: "stock",
      label: i.name,
      summary: "Saldo no mínimo ou abaixo",
      source: i.id,
      input: i.id,
    }));
  for (const d of stock.demand.filter((d) => Number(d.shortage_qty) > 0)) {
    const item = stock.inputs.find((i) => i.id === d.input_id)!;
    alerts.push({
      key: "d" + d.lot_id,
      farm: "demo",
      kind: "demand",
      label: item.name,
      summary:
        "Faltam " +
        quantity(d.shortage_qty!) +
        " " +
        item.unit +
        " para a operação",
      source: d.lot_id!,
      input: item.id,
    });
  }
  alerts.push({
    key: "maintenance",
    farm: "demo",
    kind: "maintenance",
    label: "Revisão do trator T-04",
    summary: "Revisão preventiva vencida em 6 h",
    source: "M-04",
  });
  const cycles = fields.map((f) => ({
    id: f.id,
    season: "s1",
    plot: f.id,
    crop: f.crop,
    stage: f.stage,
    area: f.area,
    cost: f.cost,
    projected: f.price * f.yieldSc * f.area - f.cost,
    realized: -f.cost,
  }));
  return {
    seasons: [{ id: "s1", farm: "demo", name: "Safra 2026/27", active: true }],
    cycles,
    alerts,
    orders: cycles
      .slice(0, 2)
      .map((c, i) => ({
        id: "OS-0" + (34 + i),
        cycle: c.id,
        plot: c.plot,
        kind: i ? "spraying" : "planting",
        status: i ? "planned" : "running",
        ha: c.area,
      })),
  };
}
export async function loadOverview(
  ids: string[],
  s: AbortSignal,
): Promise<OverviewData> {
  const [seasons, cycles, results, alerts, demand, orders, lots, inputs] =
    await Promise.all([
      readRows("seasons", ids, s),
      readRows("crop_cycles", ids, s),
      readRows("cycle_economics", ids, s),
      readRows("farm_alerts", ids, s),
      readRows("lot_demand", ids, s),
      readRows("work_orders", ids, s, { planned_on: localDay() }),
      readRows("input_lots", ids, s),
      readRows("inputs", ids, s),
    ]);
  const alertsFor = (a: FarmAlertsRow): Alert => ({
    key: a.kind + ":" + a.source_id,
    farm: a.farm_id!,
    kind: a.kind!,
    source: a.source_id!,
    label: a.label || "Ocorrência",
    summary:
      a.kind === "stock"
        ? "Saldo no mínimo ou abaixo"
        : a.kind === "maintenance"
          ? "Manutenção pendente"
          : "Vencimento " + (a.due_on ? displayDate(a.due_on) : "em aberto"),
    input: a.kind === "stock" ? a.source_id! : undefined,
  });
  const byId = new Map(results.map((r) => [r.cycle_id, r]));
  return {
    seasons: seasons.map((r) => ({
      id: r.id,
      name: r.name,
      farm: r.farm_id,
      active: r.active,
    })),
    cycles: cycles.map((c) => {
      const r = byId.get(c.id);
      if (!r)
        throw Error(
          "Resultado econômico indisponível para o ciclo selecionado.",
        );
      return {
        id: c.id,
        season: c.season_id,
        plot: c.plot_id,
        crop: c.crop,
        stage: c.stage,
        area: c.area_ha,
        cost: r.actual_cost ?? 0,
        projected: r.projected_margin ?? 0,
        realized: r.realized_margin ?? 0,
      };
    }),
    alerts: [
      ...alerts.map(alertsFor),
      ...demand
        .filter((d) => Number(d.shortage_qty) > 0)
        .map((d) => {
          const item = inputs.find((i) => i.id === d.input_id);
          return {
            key: "d" + d.lot_id,
            farm: d.farm_id!,
            kind: "demand",
            source: d.lot_id!,
            input: d.input_id!,
            label: item?.name || "Insumo",
            summary:
              "Lote " +
              (lots.find((l) => l.id === d.lot_id)?.code || "") +
              " · faltam " +
              quantity(d.shortage_qty!) +
              " " +
              (item?.unit || ""),
          };
        }),
    ],
    orders: orders.map((o) => ({
      id: o.id,
      cycle: o.cycle_id,
      plot: cycles.find((c) => c.id === o.cycle_id)?.plot_id || "",
      kind: o.kind,
      status: o.status,
      ha: o.area_ha,
    })),
  };
}
