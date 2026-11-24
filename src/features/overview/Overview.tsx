import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Boxes,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Layers,
  Tractor,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Layout } from "../../components/Layout";
import { CopilotSearch } from "../../components/Layout/CopilotSearch";
import { useFarm } from "../../contexts/FarmContext";
import { useFields } from "../field/context";
import { Dialog } from "../field/Dialog";
import { Atlas, FieldDetails } from "../field/Atlas";
import { FarmWeather } from "../field/Weather";
import type { Field } from "../field/model";
import {
  brl,
  displayDate,
  localDay,
  quantity,
  readRows,
  useResource,
} from "../../shared/erpData";
import {
  demoOverview,
  jobNames,
  jobStates,
  loadOverview,
  type OverviewData,
} from "./data";

type Action = OverviewData["alerts"][number];
function AlertDetail({
  alert,
  demo,
  close,
}: {
  alert: Action;
  demo: boolean;
  close: () => void;
}) {
  const details = useResource(
    useCallback(
      async (signal: AbortSignal) => {
        if (demo)
          return [
            "Máquina T-04",
            "Revisão preventiva do sistema hidráulico",
            "Horímetro de referência: 1.500 h",
          ];
        if (alert.kind === "bill") {
          const [b] = await readRows("bills", [alert.farm], signal, {
            id: alert.source,
          });
          return b
            ? [
                b.kind === "payable" ? "Conta a pagar" : "Conta a receber",
                brl(b.amount),
                "Vencimento em " + displayDate(b.due_on),
                b.settled_on ? "Liquidado" : "Em aberto",
              ]
            : ["O título saiu do escopo desta consulta."];
        }
        const [m] = await readRows("maintenance", [alert.farm], signal, {
          id: alert.source,
        });
        return m
          ? [
              m.kind === "preventive"
                ? "Manutenção preventiva"
                : "Manutenção corretiva",
              m.description,
              ...(m.due_on ? ["Prazo: " + displayDate(m.due_on)] : []),
              ...(m.due_meter !== null
                ? ["Leitura prevista: " + quantity(m.due_meter)]
                : []),
              "Custo registrado: " + brl(m.cost),
            ]
          : ["Registro indisponível."];
      },
      [alert, demo],
    ),
  );
  return (
    <Dialog title={alert.label} close={close} drawer>
      {details.error ? (
        <p role="alert">
          {details.error}{" "}
          <button onClick={details.reload}>Tentar novamente</button>
        </p>
      ) : (
        details.data?.map((v, i) => (
          <p key={i} className="erp-note">
            {v}
          </p>
        )) || <p>Carregando documento…</p>
      )}
    </Dialog>
  );
}
export function Overview() {
  const field = useFields();
  const { demo, fields } = field;
  const { farms, activeFarmId } = useFarm();
  const scope = demo
    ? "demo"
    : activeFarmId === "all"
      ? farms.map((f) => f.id).join(",")
      : activeFarmId;
  const resource = useResource(
    useCallback(
      (s: AbortSignal) =>
        demo
          ? Promise.resolve(demoOverview(fields))
          : loadOverview(scope ? scope.split(",") : [], s),
      [scope, demo, fields],
    ),
  );
  const data = resource.data;
  const [season, chooseSeason] = useState("active");
  const [crop, chooseCrop] = useState("");
  const [metric, setMetric] = useState("");
  const [alert, setAlert] = useState<Action | null>(null);
  const [selected, select] = useState<Field | null>(null);
  const [order, setOrder] = useState<OverviewData["orders"][number] | null>(
    null,
  );
  const seasonIds =
    data?.seasons
      .filter((s) => (season === "active" ? s.active : s.id === season))
      .map((s) => s.id) || [];
  const allCycles =
    data?.cycles.filter((c) => seasonIds.includes(c.season)) || [];
  const cycles = allCycles.filter((c) => !crop || c.crop === crop);
  const mapFields = season === "active" && !crop
    ? fields
    : fields.filter((f) => cycles.some((c) => c.plot === f.id));
  const orders =
    data?.orders.filter((o) => cycles.some((c) => c.id === o.cycle)) || [];
  const area = cycles.reduce((n, c) => n + c.area, 0);
  const cost = cycles.reduce((n, c) => n + c.cost, 0);
  const totals = [
    {
      name: "Área cultivada",
      value: quantity(area) + " ha",
      Icon: Layers,
      sub: cycles.length + " ciclos no recorte",
    },
    {
      name: "Custo por hectare",
      value: area ? brl(cost / area) : "—",
      Icon: CircleDollarSign,
      sub: "Custo apropriado ÷ área",
    },
    {
      name: "Margem projetada",
      value: brl(cycles.reduce((n, c) => n + c.projected, 0)),
      Icon: TrendingUp,
      sub: "Previsão de venda − orçamento",
    },
    {
      name: "Margem realizada",
      value: brl(cycles.reduce((n, c) => n + c.realized, 0)),
      Icon: CircleDollarSign,
      sub: "Vendas recebidas − custos",
    },
  ];
  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const plotName = (id: string) => {
    const field = fields.find(f => f.id === id);
    return [field?.name || "Talhão", activeFarmId === "all" && farms.find(f => f.id === field?.farm_id)?.name].filter(Boolean).join(" · ");
  };
  return (
    <Layout>
      <div className="field-console">
        <header className="overview-cover">
          <span className="field-print cover-print" aria-hidden="true" />
          <p className="cover-date">{demo ? "Demonstração · " : ""}{dateLabel}</p>
          <h1>Panorama da fazenda</h1>
          <CopilotSearch />
        </header>
        <div className="overview-filters">
          <h2>Indicadores da safra</h2>
          {data && (
            <div className="erp-filters">
              <label className="filter">
                <CalendarDays size={16} />
                <select
                  aria-label="Safra dos indicadores"
                  value={season}
                  onChange={(e) => {
                    chooseSeason(e.target.value);
                    chooseCrop("");
                  }}
                >
                  <option value="active">
                    {activeFarmId === "all" ? "Safras ativas" : "Safra ativa"}
                    {data.seasons.filter((s) => s.active).length === 1
                      ? " · " + data.seasons.find((s) => s.active)?.name
                      : ""}
                  </option>
                  {data.seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {activeFarmId === "all"
                        ? " · " + farms.find((f) => f.id === s.farm)?.name
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <select
                aria-label="Filtrar cultura"
                value={crop}
                onChange={(e) => chooseCrop(e.target.value)}
              >
                <option value="">Todas as culturas</option>
                {[...new Set(allCycles.map((c) => c.crop))].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {resource.error ? (
          <section className="panel" role="alert">
            <p>{resource.error}</p>
            <button onClick={resource.reload}>Tentar novamente</button> ·{" "}
            <Link to="/demo">Abrir demonstração</Link>
          </section>
        ) : !data ? (
          <p role="status">Consultando safra, saldos e agenda…</p>
        ) : (
          <>
            {!seasonIds.length && (
              <div className="erp-note">
                Nenhuma safra ativa neste contexto. {!demo && <Link to="/safras">Gerenciar safras e ciclos</Link>}
              </div>
            )}
            <div className="metrics">
              {totals.map(({ name, value, Icon, sub }) => (
                <button
                  className="metric erp-kpi"
                  key={name}
                  onClick={() => setMetric(name)}
                >
                  <header>
                    {name}
                    <Icon size={17} />
                  </header>
                  <strong>{cycles.length ? value : "—"}</strong>
                  <small>{sub}</small>
                </button>
              ))}
            </div>
            <div className="hub-grid">
              <section className="panel erp-priorities">
                <header>
                  <Boxes size={19} />
                  <h2>Ações prioritárias</h2>
                  <span className="erp-count">{data.alerts.length}</span>
                </header>
                <small>Estoque, manutenção e vencimentos da propriedade</small>
                <div className="erp-alerts">
                  {data.alerts.map((a) => {
                    const Icon = a.input
                      ? Boxes
                      : a.kind === "maintenance"
                        ? Wrench
                        : CircleDollarSign;
                    const content = (
                      <>
                        <Icon size={16} />
                        <span>
                          <strong>{a.label}</strong>
                          <small>
                            {a.summary}
                            {activeFarmId === "all"
                              ? " · " + farms.find((f) => f.id === a.farm)?.name
                              : ""}
                          </small>
                        </span>
                        <ChevronRight size={16} />
                      </>
                    );
                    return a.input ? (
                      <Link
                        key={a.key}
                        to={
                          (demo ? "/demo" : "") +
                          "/estoque?insumo=" +
                          encodeURIComponent(a.input)
                        }
                      >
                        {content}
                      </Link>
                    ) : (
                      <button key={a.key} onClick={() => setAlert(a)}>
                        {content}
                      </button>
                    );
                  })}
                  {!data.alerts.length && (
                    <p>
                      Nenhuma pendência de estoque, manutenção ou contas a
                      vencer.
                    </p>
                  )}
                </div>
              </section>
              <FarmWeather demo={demo} />
            </div>
            <div className="hub-grid">
              <Atlas fields={mapFields} open={select} />
              <section className="panel">
                <header>
                  <Tractor size={19} />
                  <h2>Agenda de hoje</h2>
                </header>
                {orders.map((o) => (
                  <button
                    className="erp-order"
                    key={o.id}
                    onClick={() => setOrder(o)}
                  >
                    <span>
                      <strong>{jobNames[o.kind]}</strong>
                      <small>
                        {plotName(o.plot)} · {quantity(o.ha)} ha
                      </small>
                    </span>
                    <span className="erp-chip">{jobStates[o.status]}</span>
                  </button>
                ))}
                {!orders.length && (
                  <p>Nenhuma OS programada para hoje neste recorte.</p>
                )}
                <Link
                  className="erp-link"
                  to={(demo ? "/demo" : "") + "/operacoes"}
                >
                  Ver frentes de trabalho <ArrowUpRight size={15} />
                </Link>
              </section>
            </div>
          </>
        )}
        {order && (
          <Dialog
            drawer
            title={jobNames[order.kind]}
            close={() => setOrder(null)}
          >
            <p>
              {plotName(order.plot)} · {displayDate(localDay())}
            </p>
            <dl className="details-list">
              <div>
                <dt>Status</dt>
                <dd>{jobStates[order.status]}</dd>
              </div>
              <div>
                <dt>Área da OS</dt>
                <dd>{quantity(order.ha)} ha</dd>
              </div>
              <div>
                <dt>Ordem</dt>
                <dd>{order.id}</dd>
              </div>
            </dl>
          </Dialog>
        )}
        {metric && (
          <Dialog drawer title={metric} close={() => setMetric("")}>
            <p>Composição por ciclo de cultivo</p>
            {cycles.map((c) => (
              <div key={c.id} className="erp-entry">
                <strong>{plotName(c.plot)}</strong>
                <span>
                  {metric === totals[0].name
                    ? quantity(c.area) + " ha"
                    : metric === totals[1].name
                      ? brl(c.cost / c.area) + "/ha"
                      : brl(
                          metric === totals[2].name ? c.projected : c.realized,
                        )}
                </span>
                <small>
                  {c.crop} · {quantity(c.area)} ha
                </small>
              </div>
            ))}
            {!cycles.length && <p>Sem ciclos no recorte.</p>}
          </Dialog>
        )}
        {alert && (
          <AlertDetail alert={alert} demo={demo} close={() => setAlert(null)} />
        )}
        {selected && (
          <FieldDetails
            cycle={cycles.find(c => c.plot === selected.id)}
            demo={demo}
            field={selected}
            close={() => select(null)}
          />
        )}
      </div>
    </Layout>
  );
}
