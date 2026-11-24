import { useCallback, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownToLine,
  Boxes,
  ChevronRight,
  Layers,
  Plus,
  Search,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Layout } from "../../components/Layout";
import { useFarm } from "../../contexts/FarmContext";
import { useFields } from "../field/context";
import { Dialog } from "../field/Dialog";
import {
  brl,
  displayDate,
  issueMessage,
  localDay,
  quantity,
  useResource,
} from "../../shared/erpData";
import type { InputFamily, InputsRow } from "../../shared/contracts/erp";
import {
  addLot,
  addProduct,
  families,
  history,
  loadInventory,
  receive,
  type Inventory as Stock,
} from "./store";

type FormKind = "product" | "lot" | "receipt";
function StockForm({
  kind,
  stock,
  initial,
  farm,
  demo,
  close,
  done,
}: {
  kind: FormKind;
  stock: Stock;
  initial?: InputsRow;
  farm: string;
  demo: boolean;
  close: () => void;
  done: () => void;
}) {
  const [item, setItem] = useState(
    initial?.id ||
      stock.inputs.find((i) => stock.lots.some((l) => l.input_id === i.id))
        ?.id ||
      "",
  );
  const [family, setFamily] = useState<InputFamily>("seed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lots = stock.lots.filter((l) => l.input_id === item);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const title = {
    product: "Cadastrar insumo",
    lot: "Cadastrar lote",
    receipt: "Registrar entrada",
  }[kind];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    const value = (key: string) => String(form.get(key) || "").trim();
    setBusy(true);
    setError("");
    try {
      if (kind === "product") {
        if (!value("name")) throw Error("Informe o nome do insumo.");
        await addProduct(
          farm,
          {
            name: value("name"),
            family,
            unit: family === "fuel" ? "L" : value("unit"),
            minimum: Number(value("minimum")),
          },
          demo,
        );
      } else if (kind === "lot") {
        if (!value("code") || !initial)
          throw Error("Informe o código do lote.");
        await addLot(
          farm,
          {
            input_id: initial.id,
            code: value("code"),
            expires_on: value("expires") || null,
          },
          demo,
        );
      } else {
        if (!value("document") || !lots.some((l) => l.id === value("lot")))
          throw Error("Selecione um lote e informe o documento.");
        await receive(
          {
            p_farm: farm,
            p_lot: value("lot"),
            p_qty: Number(qty),
            p_unit_cost: Number(price),
            p_document: value("document"),
          },
          demo,
        );
      }
      done();
    } catch (err) {
      setError(issueMessage(err));
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={title}
      close={() => {
        if (!busy) close();
      }}
    >
      <form className="erp-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          {kind === "product" ? (
            <>
              <label>
                Nome do insumo
                <input autoFocus name="name" required maxLength={150} />
              </label>
              <label>
                Família
                <select
                  value={family}
                  onChange={(e) => setFamily(e.target.value as InputFamily)}
                >
                  {Object.entries(families).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="erp-pair">
                <label>
                  Unidade
                  <select
                    name="unit"
                    key={family === "fuel" ? "fuel" : "other"}
                    disabled={family === "fuel"}
                    defaultValue={family === "fuel" ? "L" : "kg"}
                  >
                    {["kg", "L", "un"].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Estoque mínimo
                  <input
                    name="minimum"
                    type="number"
                    defaultValue="0"
                    required
                    min="0"
                    step=".0001"
                  />
                </label>
              </div>
            </>
          ) : kind === "lot" ? (
            <>
              <p>
                {initial?.name} · {initial?.unit}
              </p>
              <label>
                Código do lote
                <input autoFocus name="code" required maxLength={100} />
              </label>
              <label>
                Validade (opcional)
                <input name="expires" type="date" />
              </label>
            </>
          ) : (
            <>
              <label>
                Insumo
                <select value={item} onChange={(e) => setItem(e.target.value)}>
                  {stock.inputs
                    .filter((i) => stock.lots.some((l) => l.input_id === i.id))
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Lote
                <select name="lot" key={item} required>
                  {lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.code}
                    </option>
                  ))}
                </select>
              </label>
              <div className="erp-pair">
                <label>
                  Quantidade ({stock.inputs.find((i) => i.id === item)?.unit})
                  <input
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    type="number"
                    step=".0001"
                    min=".0001"
                    required
                  />
                </label>
                <label>
                  Preço unitário (R$)
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    type="number"
                    min="0"
                    step=".00000001"
                    required
                  />
                </label>
              </div>
              <label>
                Nota fiscal ou documento
                <input name="document" required maxLength={140} />
              </label>
              <div className="erp-total">
                Valor da entrada{" "}
                <strong>{brl(Number(qty) * Number(price))}</strong>
              </div>
            </>
          )}
          {error && <p role="alert">{error}</p>}
          <button className="erp-primary" disabled={busy}>
            {busy ? "Salvando…" : title}
          </button>
        </fieldset>
      </form>
    </Dialog>
  );
}
function StockDetails({
  item,
  stock,
  demo,
  write,
  close,
  action,
}: {
  item: InputsRow;
  stock: Stock;
  demo: boolean;
  write: boolean;
  close: () => void;
  action: (kind: FormKind) => void;
}) {
  const lots = stock.lots.filter((l) => l.input_id === item.id);
  const ids = lots.map((l) => l.id).join(",");
  const ledger = useResource(
    useCallback(
      (signal: AbortSignal) =>
        history(item.farm_id, ids ? ids.split(",") : [], demo, signal),
      [item.farm_id, ids, demo],
    ),
  );
  return (
    <Dialog drawer title={item.name} close={close}>
      <p>
        {families[item.family]} · {quantity(item.quantity)} {item.unit}{" "}
        disponíveis
      </p>
      <dl className="details-list">
        <div>
          <dt>Custo médio / {item.unit}</dt>
          <dd>{item.avg_cost === null ? "—" : brl(item.avg_cost)}</dd>
        </div>
        <div>
          <dt>Mínimo</dt>
          <dd>
            {quantity(item.minimum)} {item.unit}
          </dd>
        </div>
      </dl>
      <h3>Lotes e validade</h3>
      {!lots.length && <p>Cadastre o primeiro lote para lançar uma entrada.</p>}
      {lots.map((l) => (
        <div key={l.id} className="erp-entry">
          <strong>{l.code}</strong>
          <span>
            {quantity(l.quantity)} {item.unit}
          </span>
          <small>
            {l.expires_on
              ? (l.expires_on < localDay() ? "Vencido em " : "Validade ") +
                displayDate(l.expires_on)
              : "Sem validade informada"}
          </small>
          {stock.demand.filter(d => d.lot_id === l.id).map(d => (
            <small key={l.id} className="erp-demand">
              OS previstas: {quantity(d.required_qty ?? 0)} {item.unit}
              {d.first_operation && ' · a partir de ' + displayDate(d.first_operation)}
              {Number(d.shortage_qty) > 0 && ' · faltam ' + quantity(d.shortage_qty!) + ' ' + item.unit}
            </small>
          ))}
        </div>
      ))}
      {write && (
        <div className="erp-actions">
          <button onClick={() => action("lot")}>Novo lote</button>
          {lots.length > 0 && (
            <button className="erp-primary" onClick={() => action("receipt")}>
              Registrar entrada
            </button>
          )}
        </div>
      )}
      <h3>Extrato de movimentações</h3>
      {ledger.error ? (
        <p role="alert">
          {ledger.error}{" "}
          <button onClick={ledger.reload}>Tentar novamente</button>
        </p>
      ) : !ledger.data ? (
        <p>Carregando extrato…</p>
      ) : !ledger.data.length ? (
        <p>Nenhuma movimentação registrada.</p>
      ) : (
        ledger.data.map((m) => (
          <div className="erp-entry" key={m.id}>
            <strong>
              {m.event === "receipt"
                ? "Entrada"
                : m.event === "refuel"
                  ? "Abastecimento"
                  : "Saída por OS"}
            </strong>
            <span>
              {m.event === "receipt" ? "+" : "−"}
              {quantity(m.qty)} {item.unit}
            </span>
            <small>
              {new Date(m.recorded_at).toLocaleDateString("pt-BR")} ·{" "}
              {lots.find((l) => l.id === m.lot_id)?.code} ·{" "}
              {m.document || m.order_id || "Frota"} · {brl(m.extended_cost)}
            </small>
          </div>
        ))
      )}
    </Dialog>
  );
}
export function Inventory() {
  const { demo } = useFields();
  const { activeFarmId, farms } = useFarm();
  const farm = demo ? "demo" : activeFarmId;
  const ids = demo
    ? "demo"
    : farm === "all"
      ? farms.map((f) => f.id).join(",")
      : farm;
  const { data, error, reload } = useResource(
    useCallback(
      (s: AbortSignal) => loadInventory(ids ? ids.split(",") : [], demo, s),
      [ids, demo],
    ),
  );
  const [params, setParams] = useSearchParams();
  const [query, search] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const [form, setForm] = useState<FormKind | null>(params.get("criar") === "insumo" ? "product" : null);
  const [notice, setNotice] = useState("");
  const selected = data?.inputs.find((i) => i.id === params.get("insumo"));
  const write =
    demo ||
    ["owner", "manager", "editor"].includes(
      farms?.find((f) => f.id === farm)?.role || "",
    );
  const low = (i: InputsRow) => i.quantity <= i.minimum;
  const shortage = (i: InputsRow) =>
    data?.demand.some((d) => d.input_id === i.id && Number(d.shortage_qty) > 0);
  const expired = (i: InputsRow) =>
    data?.lots.some(
      (l) =>
        l.input_id === i.id &&
        l.quantity > 0 &&
        l.expires_on &&
        l.expires_on < localDay(),
    );
  const rows = data?.inputs
    .filter(
      (i) =>
        i.name
          .toLocaleLowerCase("pt-BR")
          .includes(query.trim().toLocaleLowerCase("pt-BR")) &&
        (filter === "all" ||
          (filter === "low" && low(i)) ||
          (filter === "expired" && expired(i)) ||
          (filter === "shortage" && shortage(i))),
    )
    .sort((a, b) =>
      sort === "value"
        ? b.carrying_value - a.carrying_value
        : a.name.localeCompare(b.name, "pt-BR"),
    );
  return (
    <Layout>
      <div className="field-console">
        <div className="page-heading">
          <div>
            <small>
              {demo ? "FAZENDA BOA VISTA · DEMONSTRAÇÃO" : "ALMOXARIFADO"}
            </small>
            <h1>Estoque e insumos</h1>
            <p>Saldos por lote, custo médio e necessidades de reposição.</p>
          </div>
          {write && data && (
            <div className="erp-actions">
              <button onClick={() => setForm("product")}>
                <Plus size={16} />
                Novo insumo
              </button>
              <button
                className="erp-primary"
                disabled={!data.lots.length}
                onClick={() => setForm("receipt")}
              >
                <ArrowDownToLine size={16} />
                Registrar entrada
              </button>
            </div>
          )}
        </div>
        {notice && (
          <p role="status" className="erp-feedback">
            {notice}
          </p>
        )}
        {error ? (
          <div className="panel" role="alert">
            {error} <button onClick={reload}>Tentar novamente</button>
          </div>
        ) : !data ? (
          <p role="status">Carregando estoque…</p>
        ) : (
          <>
            <div className="metrics">
              {[
                {
                  title: "Valor em estoque",
                  value: brl(
                    data.inputs.reduce((a, i) => a + i.carrying_value, 0),
                  ),
                  Icon: Wallet,
                },
                {
                  title: "Insumos cadastrados",
                  value: data.inputs.length,
                  Icon: Boxes,
                },
                {
                  title: "No mínimo ou abaixo",
                  value: data.inputs.filter(low).length,
                  Icon: TriangleAlert,
                },
                {
                  title: "Lotes com falta prevista",
                  value: data.demand.filter((d) => Number(d.shortage_qty) > 0)
                    .length,
                  Icon: Layers,
                },
              ].map(({ title, value, Icon }) => (
                <div className="metric" key={title}>
                  <header>
                    {title}
                    <Icon size={16} />
                  </header>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <section className="panel erp-list">
              <header>
                <h2>Inventário</h2>
                <div className="erp-filters">
                  <label className="command-input">
                    <Search size={16} />
                    <input
                      aria-label="Pesquisar insumo"
                      placeholder="Pesquisar insumo"
                      value={query}
                      onChange={(e) => search(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filtrar estoque"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">Todos os saldos</option>
                    <option value="low">Estoque mínimo</option>
                    <option value="shortage">Falta prevista</option>
                    <option value="expired">Lote vencido</option>
                  </select>
                  <select
                    aria-label="Ordenar estoque"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="name">Nome A–Z</option>
                    <option value="value">Maior valor</option>
                  </select>
                </div>
              </header>
              {!write && (
                <p>
                  {farm === "all"
                    ? "Selecione uma propriedade para registrar entradas."
                    : "Visualização de estoque em modo de consulta."}
                </p>
              )}
              <div className="erp-scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Insumo",
                        "Saldo atual",
                        "Mínimo",
                        "Custo médio",
                        "Situação",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows?.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <button onClick={() => setParams({ insumo: i.id })}>
                            {i.name}
                            <ChevronRight size={14} />
                          </button>
                          <small>
                            {families[i.family]}
                            {farm === "all"
                              ? " · " +
                                farms.find((f) => f.id === i.farm_id)?.name
                              : ""}
                          </small>
                        </td>
                        <td>
                          {quantity(i.quantity)} {i.unit}
                        </td>
                        <td>
                          {quantity(i.minimum)} {i.unit}
                        </td>
                        <td>{i.avg_cost === null ? "—" : brl(i.avg_cost)}</td>
                        <td>
                          <span
                            className={
                              "erp-chip " +
                              (low(i) || expired(i) || shortage(i)
                                ? "warn"
                                : "")
                            }
                          >
                            {expired(i)
                              ? "Lote vencido"
                              : shortage(i)
                                ? "Falta prevista"
                                : low(i)
                                  ? "Repor"
                                  : "Regular"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows?.length && (
                <p>
                  {data.inputs.length
                    ? "Nenhum insumo corresponde aos filtros."
                    : "Nenhum insumo cadastrado nesta propriedade."}
                </p>
              )}
            </section>
          </>
        )}
        {selected && data && !form && (
          <StockDetails
            item={selected}
            stock={data}
            demo={demo}
            write={write}
            close={() => setParams({})}
            action={setForm}
          />
        )}
        {form && data && write && (
          <StockForm
            kind={form}
            farm={farm}
            stock={data}
            initial={selected}
            demo={demo}
            close={() => setForm(null)}
            done={() => {
              setNotice(
                form === "receipt"
                  ? "Entrada registrada. Saldo e custo médio atualizados."
                  : "Cadastro salvo.",
              );
              setForm(null);
              reload();
            }}
          />
        )}
      </div>
    </Layout>
  );
}
