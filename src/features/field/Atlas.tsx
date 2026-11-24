import { useState } from "react";
import { Layers, Navigation, LocateFixed } from "lucide-react";
import { fieldColor, layers, number, type Field } from "./model";
import { Dialog } from "./Dialog";
import type { CycleIndicator } from "../overview/data";
import { brl } from "../../shared/erpData";
import { useFarmScope } from "../../contexts/FarmContext";

export function FieldDetails({
  field: f,
  close,
  demo,
  cycle,
}: {
  field: Field;
  close: () => void;
  demo: boolean;
  cycle?: CycleIndicator;
}) {
  const { all, farmName } = useFarmScope();
  return (
    <Dialog title={f.name} close={close} drawer>
      {all && <p>{farmName(f.farm_id)}</p>}
      <p>
        {number(cycle?.area ?? f.area)} ha · {cycle?.crop ?? f.crop}{demo || !cycle ? ' (simulação)' : ''}
      </p>
      <dl className="details-list">
        {[
          ["Índice NDVI", number(f.ndvi)],
          ["Estágio fenológico", cycle?.stage ?? f.stage],
          ...(cycle ? [["Custo acumulado do ciclo", brl(cycle.cost)]] : []),
          ["Última aplicação", "Há " + f.days + " dias"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <small>{cycle && !demo ? 'NDVI e última aplicação simulados.' : 'Camadas agronômicas simuladas.'}</small>
      <h3>Alertas da área</h3>
      <p>
        {f.ndvi < 0.65
          ? "Vigor abaixo de 0,65 no cenário. Priorizar vistoria de campo."
          : "Vigor dentro da faixa de acompanhamento."}
      </p>
      <h3>Histórico</h3>
      {demo ? (
        <p>Há {f.days} dias · Aplicação registrada no cenário.</p>
      ) : f.history.length ? (
        f.history.slice(0, 10).map((e) => (
          <p key={e.id}>
            {e.transaction_date} · {e.description || e.category}
          </p>
        ))
      ) : (
        <p>Sem lançamentos vinculados a esta área.</p>
      )}
    </Dialog>
  );
}
export function Atlas({
  fields,
  open,
}: {
  fields: Field[];
  open: (f: Field) => void;
}) {
  const [layer, change] = useState(0);
  const points = fields.flatMap((f) => f.points);
  const xs = points.map(
      (p) => p.lng * Math.cos(((points[0]?.lat || 0) * Math.PI) / 180),
    ),
    ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs),
    minY = Math.min(...ys);
  const scale = Math.min(
    480 / (Math.max(...xs) - minX || 1),
    230 / (Math.max(...ys) - minY || 1),
  );
  return (
    <section className="atlas panel">
      <header>
        <div>
          <small>GEOPROCESSAMENTO</small>
          <h2>Mapa dos talhões</h2>
        </div>
        <label className="layer">
          <Layers size={15} />
          <select
            aria-label="Camada do mapa"
            value={layer}
            onChange={(e) => change(+e.target.value)}
          >
            {layers.map((l, i) => (
              <option key={l} value={i}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="atlas-map">
        <span className="north">
          <Navigation size={14} /> N
        </span>
        <svg
          viewBox="0 0 640 300"
          role="group"
          aria-label="Mapa esquemático das áreas"
        >
          <defs>
            <pattern
              id="rows"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(28)"
            >
              <path d="M0 0V7" stroke="#33472b" opacity=".25" strokeWidth="2" />
            </pattern>
          </defs>
          <rect width="640" height="300" fill="#bdc6a0" />
          <path d="M0 0H162L61 102H0ZM0 117L118 76 202 300H0Z" fill="#8ca47f" />
          <path d="M352 0H640V107L490 156Z" fill="#a4b387" />
          <rect width="640" height="300" fill="url(#rows)" />
          <path
            d="M-10 212Q75 180 166 213T348 217T650 125"
            fill="none"
            stroke="#899d8d"
            strokeWidth="16"
          />
          <path
            d="M34 -20Q118 108 220 143T621 319"
            fill="none"
            stroke="#e9debc"
            strokeWidth="8"
          />
          {fields
            .filter((f) => f.points.length >= 3)
            .map((f) => {
              const polygon = f.points.map((p) => [
                320 +
                  (p.lng * Math.cos((points[0].lat * Math.PI) / 180) -
                    (minX + Math.max(...xs)) / 2) *
                    scale,
                150 + (-p.lat - (minY + Math.max(...ys)) / 2) * scale,
              ]);
              const x = polygon.reduce((s, p) => s + p[0], 0) / polygon.length,
                y = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
              return (
                <g
                  className="map-field"
                  tabIndex={0}
                  role="button"
                  aria-label={f.name}
                  key={f.id}
                  onClick={() => open(f)}
                  onKeyDown={(e) => {
                    if (["Enter", " "].includes(e.key)) {
                      e.preventDefault();
                      open(f);
                    }
                  }}
                >
                  <polygon
                    points={polygon.join(" ")}
                    fill={fieldColor(f, layer)}
                    stroke="#f8f3d8"
                    strokeWidth="2.5"
                  />
                  <polygon points={polygon.join(" ")} fill="url(#rows)" />
                  <text x={x} y={y} textAnchor="middle">
                    {f.name}
                  </text>
                </g>
              );
            })}
        </svg>
        {!fields.length && (
          <span className="empty-map">Nenhum talhão neste filtro</span>
        )}
      </div>
      <footer>
        <span>
          <LocateFixed size={14} /> {fields.length} áreas
        </span>
        <span>
          {
            [
              "NDVI simulado · baixo → alto",
              "Estágio simulado · V4 a V8",
              "Aplicação simulada · dias desde manejo",
            ][layer]
          }
        </span>
      </footer>
    </section>
  );
}
