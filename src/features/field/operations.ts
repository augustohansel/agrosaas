import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

export interface Operation {
  farm_id: string;
  order_id?: string | null;
  id: string;
  plot_id: string | null;
  operation: string;
  machine: string;
  starts_at: string;
  progress: number;
  service_hours: number | null;
  input_name: string | null;
  input_unit: string | null;
  available: number | null;
  required_qty: number | null;
  updated_at: string;
}
export function operationAlerts(op: Operation) {
  const alerts: string[] = [];
  if (
    op.available != null &&
    op.required_qty != null &&
    op.required_qty > op.available
  )
    alerts.push(
      (op.input_name || "Insumo") +
        " · faltam " +
        (op.required_qty - op.available).toLocaleString("pt-BR") +
        " " +
        (op.input_unit || "un."),
    );
  if (op.service_hours != null && op.service_hours <= 10)
    alerts.push(
      op.machine +
        (op.service_hours <= 0
          ? " · revisão vencida"
          : " · revisão em " + op.service_hours + " h"),
    );
  return alerts;
}
export function useOperations(farmIds: string[]) {
  const ids = farmIds.join(",");
  const [ops, setOps] = useState<Operation[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">(
    "loading",
  );
  useEffect(() => {
    if (!ids) {
      setState("ready");
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const now = new Date();
        const start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        const end = new Date(start);
        end.setDate(start.getDate() + 1);
        const { data, error } = await supabase
          .from("field_operations")
          .select("*")
          .in("farm_id", ids.split(","))
          .lt("starts_at", end.toISOString())
          .or("progress.lt.100,updated_at.gte." + start.toISOString())
          .order("starts_at")
          .abortSignal(controller.signal);
        if (error) throw error;
        if (!controller.signal.aborted) {
          setOps(data as Operation[]);
          setState("ready");
        }
      } catch {
        if (!controller.signal.aborted) {
          setOps([]);
          setState("offline");
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(load, 30000);
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [ids]);
  return { ops, state };
}
