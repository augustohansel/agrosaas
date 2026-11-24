import { useCallback, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useFarmScope } from "../../contexts/FarmContext";
import { supabase } from "../../services/supabase";
import { brl, displayDate, issueMessage, localDay, quantity, readRows, useResource } from "../../shared/erpData";
import type { JobState } from "../../shared/contracts/scalars";
import { Dialog } from "../field/Dialog";
import { useFields } from "../field/context";
import { jobNames, jobStates } from "../overview/data";
import { MachineService } from "../fleet/MachineService";

type FormKind = "machine" | "order" | "lot" | "complete" | "cancel";

async function loadWorkspace(ids: string[], signal: AbortSignal) {
  const [machines, orders, cycles, seasons, lots, inputs, lines, members] = await Promise.all([
    readRows("machines", ids, signal), readRows("work_orders", ids, signal),
    readRows("crop_cycles", ids, signal), readRows("seasons", ids, signal),
    readRows("input_lots", ids, signal), readRows("inputs", ids, signal), readRows("order_inputs", ids, signal),
    supabase.from("farm_members").select("user_id,profiles(full_name)").in("farm_id", ids).abortSignal(signal),
  ]);
  if (members.error) throw members.error;
  const operators = members.data.map(member => {
    const profile = member.profiles as unknown as { full_name: string | null } | null;
    return { id: member.user_id as string, name: profile?.full_name || "Membro " + member.user_id.slice(0, 8) };
  });
  orders.sort((a, b) => b.planned_on.localeCompare(a.planned_on));
  return { machines, orders, cycles, seasons, lots, inputs, lines, operators };
}

export function Workbench() {
  const { scope } = useFarmScope();
  return scope ? <FarmOrders key={scope} />
    : <section className="panel"><h2>Ordens de serviço</h2><p>Selecione uma propriedade para abrir as ordens e a frota.</p></section>;
}

function FarmOrders() {
  const { selected, write, scope, all, farmName } = useFarmScope();
  const farm = selected?.id;
  const { fields, fleet } = useFields();
  const resource = useResource(useCallback((signal: AbortSignal) => loadWorkspace(scope.split(","), signal), [scope]));
  const [form, setForm] = useState<FormKind | null>(null);
  const [params] = useSearchParams();
  const [orderId, selectOrder] = useState(params.get("os") ?? "");
  const [serviceId, selectMachine] = useState(params.get("maquina") ?? "");
  const [cycleId, selectCycle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = resource.data;
  if (!data) return <p role="status">{resource.error || "Carregando frota e ordens…"} {resource.error && <button onClick={resource.reload}>Tentar novamente</button>}</p>;
  const { machines, orders, cycles, seasons, lots, inputs, lines, operators } = data;
  const order = orders.find(o => o.id === orderId);
  const serviceMachine = machines.find(m => m.id === serviceId);
  const readings = fleet.ops.filter(op => op.order_id === orderId);
  const machine = machines.find(m => m.id === order?.machine_id);
  const cycle = cycles.find(c => c.id === cycleId) ?? cycles[0];
  const plannedLines = lines.filter(l => l.order_id === orderId);
  const availableLots = lots.filter(l => !plannedLines.some(line => line.lot_id === l.id));
  const cycleLabel = (id: string) => {
    const c = cycles.find(row => row.id === id);
    return c ? [all && farmName(c.farm_id), fields.find(f => f.id === c.plot_id)?.name ?? "Talhão", c.crop, seasons.find(s => s.id === c.season_id)?.name].filter(Boolean).join(" · ") : "Ciclo indisponível";
  };
  const lotLabel = (id: string) => {
    const lot = lots.find(l => l.id === id);
    const input = inputs.find(i => i.id === lot?.input_id);
    return { name: [input?.name, lot?.code].join(" · "), unit: input?.unit ?? "" };
  };
  function open(kind: FormKind | null) { setError(""); setForm(kind); }
  async function save(action: () => PromiseLike<{ error: unknown }>) {
    if (!write || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (result.error) throw result.error;
      setForm(null);
      resource.reload();
    } catch (err) {
      setError((err as { code?: string }).code === "23505" && !form
        ? "A máquina ou o operador já está em uma OS em andamento." : issueMessage(err));
    } finally { setBusy(false); }
  }
  function advance(status: JobState, hours?: number, meter?: number) {
    if (order) void save(() => supabase.rpc("advance_order", {
      p_farm: farm, p_order: order.id, p_status: status, p_hours: hours ?? null, p_end_meter: meter ?? null,
    }));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const val = (name: string) => String(values.get(name) ?? "").trim();
    if (form === "machine") void save(() => supabase.from("machines").insert({
      farm_id: farm, name: val("name"), kind: val("type"), meter_unit: val("unit"), meter: Number(val("meter")), hourly_rate: Number(val("rate")),
    }));
    if (form === "order" && cycle) void save(async () => {
      const result = await supabase.from("work_orders").insert({
        farm_id: farm, cycle_id: cycle.id, machine_id: val("machine"), operator_id: val("operator"),
        kind: val("kind"), area_ha: Number(val("area")), planned_on: val("day"),
      }).select("id").single();
      if (result.data) selectOrder(result.data.id);
      return result;
    });
    if (form === "lot" && order) void save(() => supabase.from("order_inputs").insert({
      farm_id: farm, order_id: order.id, lot_id: val("lot"), dose_per_ha: Number(val("dose")),
    }));
    if (form === "complete") advance("completed", Number(val("hours")), val("meter") ? Number(val("meter")) : undefined);
    if (form === "cancel") advance("cancelled");
  }
  const titles = { machine: "Cadastrar máquina", order: "Planejar OS", lot: "Adicionar lote", complete: "Concluir OS", cancel: "Cancelar OS" };
  return <>
    {all && <p>Selecione uma fazenda para cadastrar máquinas ou planejar ordens de serviço.</p>}
    <section className="panel erp-list"><header><h2>Frota cadastrada</h2>{write && <button className="erp-primary" onClick={() => open("machine")}>Cadastrar máquina</button>}</header>
      {machines.length ? <div className="erp-scroll"><table><thead><tr><th>Máquina</th><th>Tipo</th><th>Contador</th><th>Tarifa por hora</th></tr></thead><tbody>
        {machines.map(m => <tr key={m.id}><td><button onClick={() => selectMachine(m.id)}>{m.name}</button>{all && <small>{farmName(m.farm_id)}</small>}</td><td>{m.kind}</td><td>{quantity(m.meter)} {m.meter_unit === "hours" ? "h" : "km"}</td><td>{brl(m.hourly_rate)}</td></tr>)}
      </tbody></table></div> : <p>Nenhuma máquina cadastrada.</p>}
    </section>
    {serviceMachine && <MachineService machine={serviceMachine} write={write} lots={lots} inputs={inputs}
      cycles={cycles.map(c => ({ id: c.id, label: cycleLabel(c.id) }))} close={() => selectMachine("")} refreshed={resource.reload} />}
    <section className="panel erp-list"><header><h2>Ordens de serviço</h2>{write && <button className="erp-primary" disabled={!machines.length || !cycles.length || !operators.length} onClick={() => open("order")}>Planejar OS</button>}</header>
      {!cycles.length && <p>Vincule um talhão em <Link to="/safras">Safras e ciclos</Link> para planejar uma OS.</p>}
      {!machines.length && <p>O planejamento exige uma máquina cadastrada.</p>}
      {orders.length ? <div className="erp-scroll"><table><thead><tr><th>Operação</th><th>Talhão e ciclo</th><th>Data</th><th>Situação</th></tr></thead><tbody>
        {orders.map(o => <tr key={o.id}><td><button onClick={() => { setError(""); selectOrder(o.id); }}>{jobNames[o.kind]}</button></td><td>{cycleLabel(o.cycle_id)}</td><td>{displayDate(o.planned_on)}</td><td>{jobStates[o.status]}</td></tr>)}
      </tbody></table></div> : <p>Nenhuma ordem registrada.</p>}
    </section>
    {order && !form && <Dialog drawer title={jobNames[order.kind]} close={() => { if (!busy) selectOrder(""); }}>
      <p>{cycleLabel(order.cycle_id)} · {quantity(order.area_ha)} ha</p><p>{jobStates[order.status]} · {displayDate(order.planned_on)}</p>
      <p>{machine?.name} · {operators.find(p => p.id === order.operator_id)?.name}</p>
      {readings.map(op => <p key={op.id}>Leitura de campo · {quantity(op.progress)}% · {new Date(op.updated_at).toLocaleString("pt-BR")}</p>)}
      <h3>Insumos da OS</h3>{plannedLines.map(line => { const lot = lotLabel(line.lot_id); return <p key={line.lot_id}>{lot.name} · {quantity(line.dose_per_ha)} {lot.unit}/ha · {quantity(line.dose_per_ha * order.area_ha)} {lot.unit}</p>; })}
      {!plannedLines.length && <p>Nenhum lote vinculado.</p>}
      {order.status === "completed" && <p>{quantity(order.worked_hours ?? 0)} h · Máquina {brl(order.machine_cost ?? 0)} · Insumos {brl(order.input_cost ?? 0)} · Total {brl(Number(order.machine_cost) + Number(order.input_cost))}</p>}
      {write && <div className="erp-actions">
        {order.status === "planned" && <><button disabled={busy || !availableLots.length} onClick={() => open("lot")}>Adicionar lote</button><button disabled={busy} onClick={() => advance("running")}>Iniciar OS</button></>}
        {order.status === "running" && <button disabled={busy} onClick={() => open("complete")}>Concluir OS</button>}
        {["planned", "running"].includes(order.status) && <button disabled={busy} onClick={() => open("cancel")}>Cancelar OS</button>}
      </div>}{error && <p role="alert">{error}</p>}
    </Dialog>}
    {form && <Dialog title={titles[form]} close={() => { if (!busy) open(null); }}><form className="erp-form" onSubmit={submit}><fieldset disabled={busy}>
      {form === "machine" && <><label>Nome<input name="name" required pattern=".*\S.*" autoFocus /></label><label>Tipo<input name="type" required pattern=".*\S.*" placeholder="Trator, colheitadeira…" /></label>
        <label>Contador<select name="unit"><option value="hours">Horímetro (h)</option><option value="km">Odômetro (km)</option></select></label>
        <label>Leitura inicial<input name="meter" type="number" required min="0" step=".01" /></label><label>Tarifa (R$/h)<input name="rate" type="number" required min="0" step=".01" /></label></>}
      {form === "order" && cycle && <><label>Talhão e ciclo<select value={cycle.id} onChange={e => selectCycle(e.target.value)}>{cycles.map(c => <option key={c.id} value={c.id}>{cycleLabel(c.id)}</option>)}</select></label>
        <label>Área da OS (ha)<input key={cycle.id} name="area" type="number" min=".0001" max={cycle.area_ha} step=".0001" defaultValue={cycle.area_ha} required /></label>
        <label>Operação<select name="kind">{Object.entries(jobNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Máquina<select name="machine">{machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label>Operador<select name="operator">{operators.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>Data planejada<input name="day" type="date" defaultValue={localDay()} required /></label></>}
      {form === "lot" && <><label>Insumo e lote<select name="lot">{availableLots.map(l => <option key={l.id} value={l.id}>{lotLabel(l.id).name} ({lotLabel(l.id).unit})</option>)}</select></label>
        <label>Dose por hectare na unidade do lote<input type="number" min=".000001" step=".000001" name="dose" required /></label></>}
      {form === "complete" && <><p>A conclusão registra o consumo dos lotes e o custo das horas trabalhadas.</p><label>Horas trabalhadas<input type="number" name="hours" min=".01" step=".01" required /></label>
        {machine?.meter_unit === "km" && <label>Odômetro final (km)<input type="number" name="meter" min={machine.meter} step=".01" required /></label>}</>}
      {form === "cancel" && <p>Confirmar o cancelamento desta ordem?</p>}
      {error && <p role="alert">{error}</p>}<button className="erp-primary">{busy ? "Salvando…" : titles[form]}</button>
    </fieldset></form></Dialog>}
  </>;
}
