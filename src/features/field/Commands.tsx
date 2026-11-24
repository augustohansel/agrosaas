import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUpRight } from "lucide-react";
import { useFields } from "./context";
import { Dialog } from "./Dialog";
import { money } from "./model";
import { demoOverview, loadOverview } from "../overview/data";
import { useResource } from "../../shared/erpData";
import { useFarm } from "../../contexts/FarmContext";
import { commandRecords, normalizeSearch as normalize, type CommandRecord } from "./commandRecords";

export function Commands({ close, initialQuery = "" }: { close: () => void; initialQuery?: string }) {
  const { fields, demo } = useFields();
  const navigate = useNavigate();
  const [query, search] = useState(initialQuery);
  const [answer, setAnswer] = useState("");
  const { farms, activeFarmId, setActiveFarmId } = useFarm();
  const [cursor, move] = useState(0);
  const searching = !demo && normalize(query).length >= 2;
  const farmIds = demo
    ? "demo"
    : activeFarmId === "all"
      ? farms.map((f) => f.id).join(",")
      : activeFarmId;
  const records = useResource(useCallback((signal: AbortSignal) =>
    searching && farmIds ? commandRecords(farmIds.split(","), signal) : Promise.resolve([]),
    [searching, farmIds]));
  function go(path: string, farm?: string) {
    if (farm && farm !== activeFarmId) setActiveFarmId(farm);
    close();
    navigate((demo ? "/demo" : "") + path, { state: { fromCopilot: true } });
  }
  const canWrite = !demo && ["owner", "manager", "editor"].includes(farms?.find(f => f.id === activeFarmId)?.role ?? "");
  const snapshot = useResource(
    useCallback(
      (signal: AbortSignal) =>
        demo
          ? Promise.resolve(demoOverview(fields))
          : loadOverview(farmIds ? farmIds.split(",") : [], signal),
      [demo, fields, farmIds],
    ),
  );
  function consult(kind: "cost" | "alerts") {
    if (!snapshot.data) {
      setAnswer(snapshot.error || "Consultando dados…");
      return;
    }
    const { cycles, seasons, alerts } = snapshot.data;
    if (kind === "alerts") {
      setAnswer(
        alerts.map((a) => a.label + " · " + a.summary).join(" / ") ||
          "Nenhum alerta operacional da propriedade.",
      );
      return;
    }
    const active = new Set(seasons.filter((s) => s.active).map((s) => s.id));
    const [top] = cycles
      .filter((c) => active.has(c.season) && c.area > 0)
      .sort((a, b) => b.cost / b.area - a.cost / a.area);
    setAnswer(
      top
        ? (fields.find((f) => f.id === top.plot)?.name || "Talhão") +
            " · " +
            money(top.cost / top.area) +
            "/ha na safra ativa."
        : "Sem ciclos na safra ativa para comparar.",
    );
  }
  const actions: { label: string; detail?: string; key?: string; run: () => void }[] = [
    { label: "Qual talhão tem maior custo/ha?", run: () => consult("cost") },
    { label: "Alertas críticos de hoje", run: () => consult("alerts") },
    ...[
      ["Abrir mapa dos talhões", "/mapa"],
      ["Consultar estoque, lotes e insumos", "/estoque"],
      ["Consultar economia da safra", "/economia"],
      ["Acompanhar operações e frota", "/operacoes"],
      ...(!demo ? [["Consultar safras e ciclos", "/safras"], ["Consultar colheita e armazenagem", "/colheita"]] : []),
      ...(canWrite ? [["Cadastrar novo insumo", "/estoque?criar=insumo"], ["Cadastrar novo título financeiro", "/economia?criar=titulo"]] : []),
    ].map(([label, path]) => ({
      label,
      run: () => go(path),
    })),
  ];
  const words = normalize(query).split(" ").filter(Boolean);
  if (searching) {
    const entries: CommandRecord[] = [
      ...(records.data ?? []),
      ...fields.map(f => ({ id: f.id, label: f.name, detail: "Talhão", farm: f.farm_id, path: "/mapa?talhao=" + f.id })),
      ...farms.filter(f => activeFarmId === "all" || f.id === activeFarmId).map(f => ({ id: f.id, label: f.name, detail: "Propriedade", farm: f.id, path: "/visao-geral" })),
    ];
    const names = new Map(farms.map(f => [f.id, f.name]));
    for (const r of entries) {
      const detail = r.detail + " · " + (names.get(r.farm) ?? "");
      const searchable = normalize([r.label, detail, r.id].join(" "));
      if (words.every(w => searchable.includes(w))) actions.push({
        key: r.path + r.id, label: r.label, detail, run: () => go(r.path, r.farm),
      });
    }
  }
  const matches = actions
    .map((action) => ({
      action,
      score: action.detail ? words.length + Number(normalize(action.label) === normalize(query)) :
        words.filter(w => normalize(action.label).includes(w)).length,
    }))
    .filter((v) => !words.length || v.score)
    .sort((a, b) => b.score - a.score).slice(0, 30);
  const current = Math.min(cursor, Math.max(0, matches.length - 1));
  return (
    <Dialog title="Copiloto agronômico" close={close}>
      <div className="command-input">
        <Search size={19} />
        <input
          autoFocus
          role="combobox" aria-label="Buscar no Copiloto" aria-expanded="true" aria-controls="command-results"
          aria-activedescendant={matches.length ? "command-option-" + current : undefined}
          value={query}
          placeholder="Busque uma consulta ou ação…"
          onChange={(e) => {
            search(e.target.value);
            move(0);
            setAnswer("");
          }}
          onKeyDown={(e) => {
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && matches.length) {
              e.preventDefault();
              const next = (current + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
              move(next);
              document.getElementById("command-option-" + next)?.scrollIntoView({ block: "nearest" });
            }
            if (e.key === "Enter") document.getElementById("command-option-" + current)?.click();
          }}
        />
      </div>
      <div role="listbox" aria-label="Resultados" id="command-results">{matches.map(({ action }, i) => (
        <button
          className="command-row"
          key={action.key ?? action.label}
          id={"command-option-" + i} role="option" aria-selected={i === current} tabIndex={-1}
          disabled={
            !snapshot.data &&
            !snapshot.error &&
            [actions[0], actions[1]].includes(action)
          }
          onClick={action.run}
        >
          <span>{action.label}{action.detail && <small>{action.detail}</small>}</span>
          <ArrowUpRight size={16} />
        </button>
      ))}</div>
      {searching && records.error && <p role="alert">{records.error} <button onClick={records.reload}>Tentar novamente</button></p>}
      {searching && !records.data && !records.error && <p role="status">Buscando registros da fazenda…</p>}
      {!matches.length && (!searching || records.data) && <p>Nenhum resultado encontrado.</p>}
      {answer && (
        <p className="answer" role="status">
          {answer}
        </p>
      )}
    </Dialog>
  );
}
