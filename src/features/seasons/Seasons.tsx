import { useCallback, useState, type FormEvent } from "react";
import { Layout } from "../../components/Layout";
import { useFarm } from "../../contexts/FarmContext";
import { supabase } from "../../services/supabase";
import { brl, displayDate, issueMessage, quantity, readRows, useResource } from "../../shared/erpData";
import { useFields } from "../field/context";
import { Dialog } from "../field/Dialog";

export default function Seasons() {
  const { activeFarmId: farm, farms } = useFarm();
  const { fields, loading, error: fieldError, retry } = useFields();
  const selectedFarm = farms.find(f => f.id === farm);
  const allFarms = farm === "all";
  const scope = allFarms ? farms.map(f => f.id).join(",") : selectedFarm?.id ?? "";
  const write = ["owner", "manager", "editor"].includes(selectedFarm?.role ?? "");
  const { data, error, reload } = useResource(useCallback(async (signal: AbortSignal) => {
    const ids = scope ? scope.split(",") : [];
    const [seasons, cycles, history, economics] = await Promise.all([
      readRows("seasons", ids, signal), readRows("crop_cycles", ids, signal),
      readRows("stage_history", ids, signal), readRows("cycle_economics", ids, signal),
    ]);
    seasons.sort((a, b) => b.starts_on.localeCompare(a.starts_on));
    history.sort((a, b) => b.observed_at.localeCompare(a.observed_at));
    return { seasons, cycles, history, economics };
  }, [scope]));
  const [seasonId, pick] = useState("");
  const [form, show] = useState<"season" | "cycle" | null>(null);
  const [detail, inspect] = useState("");
  const [busy, saving] = useState(false);
  const [message, report] = useState("");
  const season = data?.seasons.find(s => s.id === seasonId) ?? data?.seasons.find(s => s.active) ?? data?.seasons[0];
  const cycles = data?.cycles.filter(c => c.season_id === season?.id) ?? [];
  const cycle = data?.cycles.find(c => c.id === detail);
  const cycleSeason = data?.seasons.find(s => s.id === cycle?.season_id);
  const available = fields.filter(f => f.area >= 0.00005 && !cycles.some(c => c.plot_id === f.id));
  const plotName = (id: string) => fields.find(f => f.id === id)?.name ?? "Talhão";
  function close() {
    if (busy) return;
    show(null);
    inspect("");
    report("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!write || busy) return;
    const values = new FormData(event.currentTarget);
    const value = (key: string) => String(values.get(key) ?? "").trim();
    saving(true);
    report("");
    try {
      if (form === "season") {
        if (value("end") < value("start")) throw Error("O fim deve ser igual ou posterior ao início.");
        const { data: row, error } = await supabase.from("seasons").insert({
          farm_id: farm, name: value("name"), starts_on: value("start"), ends_on: value("end"), active: values.has("active"),
        }).select("id").single();
        if (error) throw error;
        pick(row.id);
      } else if (form === "cycle" && season) {
        const plot = available.find(f => f.id === value("plot"));
        if (!plot) throw Error("Selecione um talhão disponível.");
        const { error } = await supabase.from("crop_cycles").insert({
          farm_id: farm, season_id: season.id, plot_id: plot.id, area_ha: Number(plot.area.toFixed(4)),
          crop: value("crop"), stage: value("stage"), forecast_sc_ha: Number(value("forecast")),
          price_per_bag: Number(value("price")), budget_cost: Number(value("budget")), bag_kg: Number(value("bag")),
        });
        if (error) throw error;
      } else if (cycle) {
        const { error } = await supabase.from("crop_cycles").update({ stage: value("stage") })
          .eq("farm_id", farm).eq("id", cycle.id).select("id").single();
        if (error) throw error;
      }
      show(null);
      reload();
    } catch (err) { report(issueMessage(err)); }
    finally { saving(false); }
  }
  async function toggleActive() {
    if (!season || !write || busy) return;
    saving(true);
    report("");
    try {
      const { error } = await supabase.from("seasons").update({ active: !season.active })
        .eq("farm_id", farm).eq("id", season.id).select("id").single();
      if (error) throw error;
      reload();
    } catch (err) { report(issueMessage(err)); }
    finally { saving(false); }
  }
  return <Layout><div className="field-console">
    <div className="page-heading"><div><h1>Safras e ciclos</h1><p>Culturas, estágios e custos por talhão.</p></div>
      <button className="erp-primary" disabled={!write} onClick={() => { report(""); show("season"); }}>Nova safra</button>
    </div>
    {!form && !cycle && message && <p role="alert">{message}</p>}
    {selectedFarm && !write && <p>Seu acesso a esta propriedade é de consulta. O cadastro de safras exige permissão de edição.</p>}
    {allFarms && farms.length > 0 && <p>Selecione uma fazenda no topo para cadastrar ou editar uma safra.</p>}
    {!scope ? <p>Selecione uma fazenda para consultar as safras.</p>
      : error || fieldError ? <p role="alert">{error ?? "Falha ao carregar os talhões."} <button onClick={() => { reload(); retry(); }}>Tentar novamente</button></p>
      : !data || loading ? <p role="status">Carregando safras e talhões…</p>
      : !season ? <p>{allFarms ? "Nenhuma safra cadastrada nas fazendas selecionadas." : "Nenhuma safra cadastrada nesta propriedade."}</p>
      : (allFarms ? data.seasons : [season]).map(item => {
        const seasonCycles = data.cycles.filter(c => c.season_id === item.id);
        return <section key={item.id} className="panel erp-list"><header><div>
          {allFarms ? <><p>{farms.find(f => f.id === item.farm_id)?.name}</p><h2>{item.name}{item.active ? " · Ativa" : ""}</h2></> :
          <label>Safra <select value={season.id} onChange={e => pick(e.target.value)}>{data.seasons.map(s => <option key={s.id} value={s.id}>{s.name}{s.active ? " · Ativa" : ""}</option>)}</select></label>}
          <p>{displayDate(item.starts_on)} a {displayDate(item.ends_on)}</p></div>
          {write && <div className="erp-actions"><button disabled={busy || (!season.active && data.seasons.some(s => s.active))} onClick={toggleActive}>{season.active ? "Desativar safra" : "Ativar safra"}</button>
            <button disabled={!available.length} onClick={() => { report(""); show("cycle"); }}>Vincular talhão</button></div>}
        </header>
        {seasonCycles.length ? <div className="erp-scroll"><table><thead><tr>{["Talhão", "Cultura", "Estágio", "Área do ciclo", "Custo acumulado"].map(t => <th key={t}>{t}</th>)}</tr></thead>
          <tbody>{seasonCycles.map(c => <tr key={c.id}><td><button onClick={() => { report(""); inspect(c.id); }}>{plotName(c.plot_id)}</button></td><td>{c.crop}</td><td>{c.stage}</td><td>{quantity(c.area_ha)} ha</td><td>{brl(data.economics.find(e => e.cycle_id === c.id)?.actual_cost ?? 0)}</td></tr>)}</tbody></table></div>
          : <p>Nenhum ciclo cadastrado nesta safra.</p>}
      </section>; })}
    {form && <Dialog title={form === "season" ? "Nova safra" : "Vincular talhão à safra"} close={close}>
      <form className="erp-form" onSubmit={submit}><fieldset disabled={busy}>{form === "season" ? <>
        <label>Nome da safra<input name="name" required autoFocus /></label>
        <label>Início<input name="start" type="date" required /></label><label>Fim<input name="end" type="date" required /></label>
        {data && !data.seasons.some(s => s.active) && <label><input type="checkbox" name="active" defaultChecked /> Safra ativa</label>}
      </> : <>
        <label>Talhão<select name="plot" required>{available.map(f => <option key={f.id} value={f.id}>{f.name} · {quantity(f.area)} ha</option>)}</select></label>
        <label>Cultura<input name="crop" required placeholder="Ex. Soja" /></label>
        <label>Estágio inicial<input name="stage" required pattern=".*\S.*" placeholder="Ex. Plantio" /></label>
        <label>Peso da saca (kg)<input name="bag" type="number" min=".001" step=".001" defaultValue="60" required /></label>
        <label>Produtividade prevista (sc/ha)<input name="forecast" type="number" min="0" step=".001" required /></label>
        <label>Preço previsto (R$/saca)<input name="price" type="number" min="0" step=".01" required /></label>
        <label>Custo total orçado (R$)<input name="budget" type="number" min="0" step=".01" required /></label>
      </>}{message && <p role="alert">{message}</p>}<button className="erp-primary">{busy ? "Salvando…" : "Salvar"}</button></fieldset></form>
    </Dialog>}
    {cycle && <Dialog drawer title={plotName(cycle.plot_id)} close={close}><p>{cycleSeason?.name} · {cycle.crop} · {quantity(cycle.area_ha)} ha</p>
      <h3>Histórico de estágios</h3>{data?.history.filter(h => h.cycle_id === cycle.id).map(h => <p key={h.id}>{new Date(h.observed_at).toLocaleString("pt-BR")} · {h.stage}</p>)}
      {write && <form className="erp-form" onSubmit={submit}><fieldset disabled={busy}><label>Novo estágio<input name="stage" required pattern=".*\S.*" /></label>
        {message && <p role="alert">{message}</p>}<button className="erp-primary">Registrar estágio</button></fieldset></form>}
    </Dialog>}
  </div></Layout>;
}
