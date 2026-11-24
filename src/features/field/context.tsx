import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFarm } from "../../contexts/FarmContext";
import { getPlots, type Plot } from "../plots/services/api";
import {
  getTransactions,
  type Transaction,
} from "../transactions/services/api";
import { demoPlots, fieldsFrom, type Field } from "./model";
import { useOperations } from "./operations";

type Data = {
  demo: boolean;
  fields: Field[];
  expense: number;
  loading: boolean;
  error: boolean;
  retry: () => void;
  fleet: ReturnType<typeof useOperations>;
};
const Context = createContext<Data | null>(null);
export function FieldProvider({
  demo = false,
  children,
}: {
  demo?: boolean;
  children: ReactNode;
}) {
  const { farms, activeFarmId } = useFarm();
  const fleet = useOperations(
    demo || !activeFarmId
      ? []
      : activeFarmId === "all"
        ? farms.map((f) => f.id)
        : [activeFarmId],
  );
  const [data, setData] = useState<{ plots: Plot[]; entries: Transaction[] }>({
    plots: [],
    entries: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [revision, reload] = useState(0);
  useEffect(() => {
    if (demo || !activeFarmId) return;
    let current = true;
    setLoading(true);
    setError(false);
    const ids = farms.map((f) => f.id);
    Promise.all([
      getPlots(activeFarmId, ids),
      getTransactions(activeFarmId, undefined, ids),
    ])
      .then(([plots, entries]) => {
        if (current) setData({ plots, entries });
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [demo, activeFarmId, farms, revision]);
  const fields = useMemo(
    () => fieldsFrom(demo ? demoPlots : data.plots, data.entries, demo),
    [data, demo],
  );
  const expense = demo
    ? fields.reduce((a, f) => a + f.cost, 0)
    : data.entries.reduce(
        (a, e) => a + (e.type === "expense" ? Number(e.amount) : 0),
        0,
      );
  return (
    <Context.Provider
      value={{
        demo,
        fields,
        expense,
        loading,
        error,
        fleet,
        retry: () => reload((v) => v + 1),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useFields() {
  const data = useContext(Context);
  if (!data) throw new Error("Contexto de talhões indisponível.");
  return data;
}
