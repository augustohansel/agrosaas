import { readRows } from "../../shared/erpData";
import type { StorageKind } from "../../shared/contracts/scalars";

export const storageLabels: Record<StorageKind, string> = {
  silo: "Silo próprio", cooperative: "Cooperativa", trader: "Trading",
};

export async function loadHarvest(ids: string[], signal: AbortSignal) {
  const [destinations, loads, dispatches, balances, cycles, seasons, economics] = await Promise.all([
    readRows("destinations", ids, signal), readRows("harvest_loads", ids, signal),
    readRows("grain_dispatches", ids, signal), readRows("grain_balances", ids, signal),
    readRows("crop_cycles", ids, signal), readRows("seasons", ids, signal), readRows("cycle_economics", ids, signal),
  ]);
  destinations.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  loads.sort((a, b) => b.received_on.localeCompare(a.received_on));
  dispatches.sort((a, b) => b.shipped_on.localeCompare(a.shipped_on));
  return { destinations, loads, dispatches, balances, cycles, seasons, economics };
}
export type HarvestData = Awaited<ReturnType<typeof loadHarvest>>;
