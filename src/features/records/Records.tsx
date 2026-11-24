import { useCallback, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { useFarmScope } from "../../contexts/FarmContext";
import { supabase } from "../../services/supabase";
import { issueMessage, useResource } from "../../shared/erpData";
import { Dialog } from "../field/Dialog";
import {
  caption,
  editFields,
  groups,
  names,
  type Row,
  type Table,
} from "./catalog";

const relations = {
  input_id: ["inputs", "name"],
  lot_id: ["input_lots", "code"],
  machine_id: ["machines", "name"],
  cycle_id: ["crop_cycles", "crop"],
  plot_id: ["plots", "name"],
  order_id: ["work_orders", "planned_on"],
} as const;
async function loadPage(
  table: Table,
  farmIds: string[],
  page: number,
  signal: AbortSignal,
) {
  let query = supabase
    .from(table)
    .select("*", { count: "exact" })
    .in("farm_id", farmIds);
  const dateColumn: Partial<Record<Table, string>> = {
    work_orders: "planned_on",
    bills: "due_on",
    stock_moves: "recorded_at",
    stage_history: "observed_at",
    harvest_loads: "received_on",
    grain_dispatches: "shipped_on",
    seasons: "starts_on",
  };
  const orderBy = dateColumn[table];
  if (orderBy) query = query.order(orderBy, { ascending: false });
  query =
    table === "order_inputs"
      ? query.order("order_id").order("lot_id")
      : query.order("id");
  const { data, error, count } = await query
    .range(page * 25, page * 25 + 24)
    .abortSignal(signal);
  if (error) throw error;
  const rows = (data || []) as Row[];
  const refs = new Map<string, string>();
  await Promise.all(
    Object.entries(relations).map(async ([column, [target, label]]) => {
      const ids = [
        ...new Set(
          rows
            .map((r) => r[column])
            .filter((id): id is string => typeof id === "string"),
        ),
      ];
      if (!ids.length) return;
      const result = await supabase
        .from(target)
        .select("id," + label)
        .in("farm_id", farmIds)
        .in("id", ids)
        .abortSignal(signal);
      if (result.error) throw result.error;
      for (const r of result.data as unknown as Row[])
        refs.set(String(r.id), String(r[label]));
    }),
  );
  return { rows, refs, total: count ?? rows.length };
}
type Action = "update" | "delete" | "reopen";
export default function Records() {
  const { scope, all } = useFarmScope();
  const [params] = useSearchParams();
  const requested = params.get("modulo") ?? "";
  const route = Object.hasOwn(groups, requested) ? requested : "/estoque";
  const tables = groups[route];
  return (
    <Layout>
      <div className="field-console">
        <header>
          <h1>Gerenciar registros</h1>
          {all && <p>Selecione uma fazenda para editar ou excluir registros.</p>}
          <Link to={route}>Voltar ao módulo</Link>
        </header>
        {scope ? (
          <FarmRecords
            key={scope + route}
            tables={tables}
          />
        ) : (
          <section className="panel">
            Selecione uma fazenda para consultar os registros.
          </section>
        )}
      </div>
    </Layout>
  );
}
function FarmRecords({
  tables,
}: {
  tables: Table[];
}) {
  const { scope, selected, write, all, farmName } = useFarmScope();
  const [table, select] = useState<Table>(tables[0]);
  const [page, paginate] = useState(0);
  const [selection, open] = useState<{
    row: Row;
    label: string;
    action: Action;
  } | null>(null);
  const [busy, saving] = useState(false);
  const [message, notify] = useState("");
  const [failure, report] = useState("");
  const { data, error, reload } = useResource(
    useCallback(
      (signal: AbortSignal) => loadPage(table, scope.split(","), page, signal),
      [table, scope, page],
    ),
  );
  function choose(row: Row, label: string, action: Action) {
    report("");
    open({ row, label, action });
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selection || busy || !write || !selected) return;
    const { row, action } = selection;
    const changes: Record<string, string | number | null> = {};
    if (action === "update") {
      const form = new FormData(e.currentTarget);
      for (const f of editFields(table, row)) {
        const raw = String(form.get(f.key) ?? "").trim();
        const value =
          raw === "" ? null : f.type === "number" ? Number(raw) : raw;
        if (value !== row[f.key]) changes[f.key] = value;
      }
    }
    saving(true);
    report("");
    try {
      const res = await supabase.rpc("manage_farm_record", {
        p_farm: selected.id,
        p_table: table,
        p_key: row.id ?? row.order_id,
        p_expected: row,
        p_action: action,
        p_changes: changes,
      });
      if (res.error) throw res.error;
      open(null);
      notify(
        action === "delete"
          ? "Registro excluído."
          : action === "reopen"
            ? "Registro reaberto."
            : "Alterações salvas.",
      );
      if (action === "delete" && data?.rows.length === 1 && page > 0)
        paginate(page - 1);
      else reload();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      report(
        code === "23514"
          ? "Confira as datas, quantidades e limites do registro."
          : issueMessage(err),
      );
    } finally {
      saving(false);
    }
  }
  return (
    <section className="panel erp-list">
      <header>
        <label>
          Registros de{" "}
          <select
            value={table}
            onChange={(e) => {
              select(e.target.value as Table);
              paginate(0);
              notify("");
            }}
          >
            {tables.map((t) => (
              <option key={t} value={t}>
                {names[t]}
              </option>
            ))}
          </select>
        </label>
        <button onClick={reload}>Atualizar lista</button>
      </header>
      {message && <p role="status">{message}</p>}
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p>Carregando registros…</p>
      ) : (
        <>
          {data.rows.length ? (
            <div className="erp-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Registro</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const label = caption(row, data.refs);
                    const reopen =
                      (table === "bills" && !!row.transaction_id) ||
                      (table === "work_orders" && row.status !== "planned");
                    const fromOrder =
                      table === "stock_moves" && row.event === "work_order";
                    const reference =
                      String(row.id ?? row.order_id).slice(0, 8) +
                      (row.id ? "" : " / " + String(row.lot_id).slice(0, 8));
                    return (
                      <tr
                        key={
                          String(row.id ?? row.order_id) +
                          String(row.lot_id ?? "")
                        }
                      >
                        <td>
                          {label}
                          <small>{all && farmName(String(row.farm_id)) + " · "}Ref. {reference}</small>
                        </td>
                        <td>
                          <div className="erp-actions">
                            {!write ? (
                              "Somente leitura"
                            ) : fromOrder ? (
                              <Link to={"/operacoes?os=" + row.order_id}>
                                Consultar OS
                              </Link>
                            ) : reopen ? (
                              <button
                                onClick={() => choose(row, label, "reopen")}
                              >
                                Reabrir
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => choose(row, label, "update")}
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => choose(row, label, "delete")}
                                >
                                  Excluir
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Nenhum registro encontrado.</p>
          )}
          {data.total > 25 && (
            <div className="erp-actions">
              <button disabled={!page} onClick={() => paginate(page - 1)}>
                Anterior
              </button>
              <span>
                {page + 1} de {Math.ceil(data.total / 25)}
              </span>
              <button
                disabled={(page + 1) * 25 >= data.total}
                onClick={() => paginate(page + 1)}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
      {selection && (
        <Dialog
          title={
            selection.action === "update"
              ? "Editar registro"
              : selection.action === "delete"
                ? "Excluir registro"
                : "Reabrir registro"
          }
          close={() => {
            if (!busy) open(null);
          }}
        >
          <p>{selection.label}</p>
          <form className="erp-form" onSubmit={submit}>
            <fieldset disabled={busy}>
              {selection.action === "update" ? (
                editFields(table, selection.row).map((f) => (
                  <label key={f.key}>
                    {f.label}
                    {f.options ? (
                      <select
                        required
                        name={f.key}
                        defaultValue={String(selection.row[f.key] ?? "")}
                      >
                        <option value="" disabled>
                          Selecione
                        </option>
                        {Object.entries(f.options).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={f.key}
                        type={f.type || "text"}
                        step={f.type === "number" ? "any" : undefined}
                        min={f.type === "number" ? "0" : undefined}
                        required={!f.optional}
                        defaultValue={String(selection.row[f.key] ?? "")}
                      />
                    )}
                  </label>
                ))
              ) : (
                <p>
                  {selection.action === "delete"
                    ? "Confirma a exclusão deste registro?"
                    : table === "bills"
                      ? "A conta voltará a ficar em aberto e o lançamento desta liquidação será retirado do caixa."
                      : "A OS voltará ao planejamento. O estoque receberá de volta os insumos consumidos e os custos da conclusão serão revertidos."}
                </p>
              )}
              {table === "stock_moves" && (
                <p>O saldo do lote e o valor em estoque serão recalculados.</p>
              )}
              {table === "stock_moves" &&
                selection.row.event === "refuel" &&
                selection.row.prior_meter == null &&
                selection.action === "delete" && (
                  <p>
                    Este abastecimento antigo não tem leitura anterior
                    registrada. A máquina manterá a leitura atual.
                  </p>
                )}
              {failure && <p role="alert">{failure}</p>}
              <div className="erp-actions">
                <button type="button" onClick={() => open(null)}>
                  Cancelar
                </button>
                <button className="erp-primary">
                  {busy
                    ? "Salvando…"
                    : selection.action === "update"
                      ? "Salvar alterações"
                      : selection.action === "delete"
                        ? "Confirmar exclusão"
                        : "Confirmar reabertura"}
                </button>
              </div>
            </fieldset>
          </form>
        </Dialog>
      )}
    </section>
  );
}
