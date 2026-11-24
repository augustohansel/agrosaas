import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Boxes,
  Coins,
  Gauge,
  Layers,
  Sprout,
  Tractor,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { Layout } from "../../components/Layout";
import { useFarm, useFarmScope } from "../../contexts/FarmContext";
import { useFields } from "./context";
import { money, number, tasks, type Field } from "./model";
import { Atlas, FieldDetails } from "./Atlas";
import { FarmWeather } from "./Weather";
import { Workbench } from "../operations/Workbench";
import { operationAlerts } from "./operations";
import { demoStock } from "../inventory/store";

const simulationStart = Date.now();
function Operations({
  fields,
  filtered,
}: {
  fields: Field[];
  filtered: boolean;
}) {
  const { fields: allFields, demo, fleet } = useFields();
  const { all, farmName } = useFarmScope();
  const [now, tick] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => tick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  if (!demo) {
    const rows = fleet.ops.filter(
      (op) => !filtered || fields.some((f) => f.id === op.plot_id),
    );
    return (
      <section className="panel operations">
        <header>
          <Tractor />
          <h2>Operações e frota</h2>
          <small>Atualização a cada 30 s</small>
        </header>
        {rows.map((op) => (
          <article key={op.id}>
            <time>
              {new Date(op.starts_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
            <div>
              <strong>
                {op.operation} ·{" "}
                {fields.find((f) => f.id === op.plot_id)?.name || "Fazenda"}
              </strong>
              <small>
                {all && farmName(op.farm_id) + " · "}
                {op.machine} · Leitura em{" "}
                {new Date(op.updated_at).toLocaleString("pt-BR")}
              </small>
              <progress value={op.progress} max={100} />
              {operationAlerts(op).map((a) => (
                <span className="issue" key={a}>
                  <TriangleAlert size={14} />
                  {a}
                </span>
              ))}
            </div>
            <b>{number(op.progress)}%</b>
          </article>
        ))}
        {!rows.length && (
          <p>
            {fleet.state === "offline"
              ? "Fonte operacional indisponível."
              : fleet.state === "loading"
                ? "Consultando frentes de trabalho…"
                : "Nenhuma operação informada para este período e filtro."}
          </p>
        )}
      </section>
    );
  }
  return (
    <section className="panel operations">
      <header>
        <Tractor />
        <h2>Operações e frota</h2>
        <small>Simulação</small>
      </header>
      {tasks.map((task, i) => {
        const field = allFields[i];
        const available = i === 0 ? demoStock().lots.find(l => l.id === 'lote-0')?.quantity ?? task.available : task.available;
        if (!field || !fields.some((f) => f.id === field.id)) return null;
        const pct = Math.min(
          100,
          task.initial +
            Math.floor(((now - simulationStart) / 60000) * task.rate),
        );
        return (
          <article key={task.name}>
            <time>{task.start}</time>
            <div>
              <strong>
                {task.name} · {field.name}
              </strong>
              <small>{task.machine}</small>
              <progress value={pct} max={100} />
              {task.service < 10 && (
                <span className="issue">
                  <Wrench size={14} /> Revisão preventiva em {task.service} h
                </span>
              )}
              {available < task.required && (
                <span className="issue">
                  <Boxes size={14} /> {task.stock} · faltam{" "}
                  {task.required - available} {task.unit} para o plantio
                </span>
              )}
            </div>
            <b>{pct}%</b>
          </article>
        );
      })}
      {!allFields
        .slice(0, tasks.length)
        .some((f) => fields.some((v) => v.id === f.id)) && (
        <p>Sem frentes de trabalho neste filtro.</p>
      )}
    </section>
  );
}
export function Console() {
  const { fields, expense, loading, error, retry, demo, fleet } = useFields();
  const { farms, activeFarmId } = useFarm();
  const farm = farms?.find((f) => f.id === activeFarmId);
  const view = useLocation().pathname.split("/").pop();
  const [crop, setCrop] = useState("");
  const [selected, select] = useState<Field | null>(null);
  const filtered = fields.filter((f) => !crop || f.crop === crop);
  const area = filtered.reduce((s, f) => s + f.area, 0);
  const costs = crop ? filtered.reduce((s, f) => s + f.cost, 0) : expense;
  const production = filtered.reduce((s, f) => s + f.yieldSc * f.area, 0);
  const revenue = filtered.reduce(
    (s, f) => s + f.price * f.yieldSc * f.area,
    0,
  );
  const link = (to: string) => (demo ? "/demo" : "") + to;
  const map = view === "mapa",
    ops = view === "operacoes",
    economy = view === "economia" || view === "custos";
  const overview = !map && !ops && !economy;
  const weak = filtered.filter((f) => f.ndvi < 0.65);
  const alerts = fleet.ops
    .filter((op) => !crop || filtered.some((f) => f.id === op.plot_id))
    .flatMap(operationAlerts);
  return (
    <Layout>
      <div className="field-console w-full min-w-0">
        <div className="page-heading">
          <div>
            <small>
              {demo
                ? "FAZENDA BOA VISTA · DEMONSTRAÇÃO"
                : farm?.name || "MINHAS PROPRIEDADES"}
            </small>
            <h1>
              {map
                ? "Hub geoespacial"
                : ops
                  ? "Operações e frota"
                  : economy
                    ? "Economia da safra"
                    : "Panorama da fazenda"}
            </h1>
            <p>
              {overview
                ? "Indicadores da safra e prioridades de campo para hoje."
                : map
                  ? "Explore as camadas e selecione uma área."
                  : ops
                    ? "Acompanhe as frentes de trabalho e os insumos necessários."
                    : "Projeções por cultura e custos registrados por área."}
            </p>
          </div>
          <label className="filter">
            <Sprout size={16} />
            <select
              value={crop}
              aria-label="Filtrar cultura simulada"
              onChange={(e) => setCrop(e.target.value)}
            >
              <option value="">
                {demo ? "Todas as culturas" : "Culturas simuladas"}
              </option>
              {Array.from(new Set(fields.map((f) => f.crop))).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {ops && !demo && <Workbench />}
        {error ? (
          <div role="alert">
            Falha ao carregar os dados.{" "}
            <button onClick={retry}>Tentar novamente</button>
          </div>
        ) : loading ? (
          <p role="status">Carregando indicadores…</p>
        ) : (
          <>
            {overview &&
              demo &&
              filtered.some((f) => f.id === fields[0]?.id) && (
                <Link to={link("/operacoes")} className="action-line">
                  <TriangleAlert size={16} />
                  <strong>Atenção hoje</strong>
                  <span>
                    Reposição de sementes para o plantio
                    {weak.length
                      ? " · " + weak.length + " área com baixo vigor"
                      : ""}
                  </span>
                  <small>Simulação</small>
                  <ArrowUpRight size={15} />
                </Link>
              )}
            {overview && !demo && alerts.length > 0 && (
              <Link to="/operacoes" className="action-line">
                <TriangleAlert size={16} />
                <strong>Atenção hoje</strong>
                <span>{alerts[0]}</span>
                <small>{alerts.length} alertas</small>
                <ArrowUpRight size={15} />
              </Link>
            )}
            {(overview || economy) && (
              <div className="metrics">
                {[
                  {
                    label: "Área mapeada",
                    value: number(area),
                    unit: "ha",
                    icon: Layers,
                    sub: filtered.length + " talhões",
                  },
                  {
                    label: "Custo por hectare",
                    value: area ? money(costs / area) : "—",
                    unit: "/ha",
                    icon: Coins,
                    sub: "Despesas ÷ área mapeada",
                  },
                  {
                    label: "Produtividade projetada",
                    value: area ? number(production / area) : "—",
                    unit: "sc/ha",
                    icon: Sprout,
                    sub: "Projeção simulada",
                  },
                  {
                    label: "Margem estimada",
                    value: revenue
                      ? number(((revenue - costs) / revenue) * 100)
                      : "—",
                    unit: "%",
                    icon: Gauge,
                    sub: "Receita projetada − despesas",
                  },
                ].map(({ label, value, unit, icon: Icon, sub }) => (
                  <section className="metric" key={label}>
                    <header>
                      <span>{label}</span>
                      <Icon size={17} />
                    </header>
                    <strong>
                      {value} <em>{unit}</em>
                    </strong>
                    <small>{sub}</small>
                  </section>
                ))}
              </div>
            )}
            {(overview || map) && (
              <div className={overview ? "hub-grid" : ""}>
                <Atlas fields={filtered} open={select} />
                {overview && (
                  <FarmWeather demo={demo} />
                )}
              </div>
            )}
            {(overview || ops) && (
              <Operations fields={filtered} filtered={!!crop} />
            )}
            {economy && (
              <section className="panel">
                <header>
                  <Activity />
                  <h2>Custo por talhão</h2>
                </header>
                {filtered.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={filtered.map((f) => ({
                        name: f.name,
                        custo: f.area ? Math.round(f.cost / f.area) : 0,
                      }))}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 5" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip
                        formatter={(v) => [money(Number(v)), "Custo/ha"]}
                      />
                      <Bar
                        dataKey="custo"
                        fill="#698f66"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p>Sem talhões para comparar.</p>
                )}
              </section>
            )}
          </>
        )}
        {selected && (
          <FieldDetails
            field={selected}
            demo={demo}
            close={() => select(null)}
          />
        )}
      </div>
    </Layout>
  );
}
