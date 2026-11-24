import type { Plot } from "../plots/services/api";
import type { Transaction } from "../transactions/services/api";
import L from "leaflet";
import "leaflet-draw";

export const money = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
export const number = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const samples = [
  ["Talhão Coxilha", "Soja", "V6", 0.83, 65, 134, 3420],
  ["Área Várzea", "Arroz", "V4", 0.58, 142, 76, 5860],
  ["Pivô Norte", "Milho", "V8", 0.76, 108, 67, 4270],
  ["Santa Clara", "Soja", "V5", 0.85, 68, 134, 3280],
] as const;
const shapes = [
  [
    [14, 18],
    [47, 11],
    [52, 45],
    [18, 54],
    [9, 39],
  ],
  [
    [50, 10],
    [82, 7],
    [91, 29],
    [72, 43],
    [55, 44],
  ],
  [
    [54, 48],
    [74, 46],
    [93, 32],
    [89, 69],
    [64, 83],
  ],
  [
    [19, 58],
    [51, 49],
    [61, 85],
    [32, 93],
    [14, 76],
  ],
];
export const demoPlots: Plot[] = samples.map(([name], i) => ({
  id: "sample-" + i,
  name,
  farm_id: "demo",
  created_at: "2026-10-10",
  coordinates: shapes[i].map(([x, y]) => ({
    lat: -29.66 - y * 0.00021,
    lng: -53.82 + x * 0.0003,
  })),
}));
export function fieldsFrom(
  plots: Plot[],
  entries: Transaction[],
  demo: boolean,
) {
  return plots.map((plot, index) => {
    const sample =
      samples[
        (demo
          ? index
          : Array.from(plot.id).reduce((v, c) => v + c.charCodeAt(0), 0)) %
          samples.length
      ];
    const [, crop, stage, ndvi, yieldSc, price, unitCost] = sample;
    const points = (plot.coordinates as L.LatLngExpression[]).map((p) =>
      L.latLng(p),
    );
    const area = L.GeometryUtil.geodesicArea(points) / 10000;
    const history = entries.filter((entry) => entry.plot_id === plot.id);
    const cost = demo
      ? unitCost * area
      : history.reduce(
          (sum, e) => sum + (e.type === "expense" ? Number(e.amount) : 0),
          0,
        );
    return {
      ...plot,
      crop,
      stage,
      ndvi,
      yieldSc,
      price,
      area,
      cost,
      points,
      history,
      days: Math.round((1 - ndvi) * 32),
    };
  });
}
export type Field = ReturnType<typeof fieldsFrom>[number];
export const layers = [
  "Saúde • NDVI",
  "Fenologia",
  "Última aplicação",
] as const;
export function fieldColor(field: Field, layer: number) {
  if (layer === 1)
    return { V4: "#d9b068", V5: "#90ac79", V6: "#5f997e", V8: "#45796f" }[
      field.stage
    ];
  if (layer === 2) return field.days > 10 ? "#b5834c" : "#7b9f83";
  return field.ndvi < 0.65
    ? "#c1a54e"
    : field.ndvi < 0.8
      ? "#89a45b"
      : "#618b57";
}
export const tasks = [
  {
    name: "Plantio",
    machine: "Plantadeira P-04",
    start: "06:30",
    initial: 63,
    rate: 4,
    stock: "Semente certificada",
    available: 480,
    required: 620,
    unit: "kg",
    service: 84,
  },
  {
    name: "Pulverização",
    machine: "Pulverizador PR-02",
    start: "08:00",
    initial: 28,
    rate: 3,
    stock: "Água de preparo",
    available: 4800,
    required: 3200,
    unit: "L",
    service: 46,
  },
  {
    name: "Colheita",
    machine: "Colheitadeira C-01",
    start: "09:15",
    initial: 42,
    rate: 5,
    stock: "Diesel S10",
    available: 290,
    required: 210,
    unit: "L",
    service: 6,
  },
];
