import { useCallback, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { brl, displayDate, issueMessage, localDay, quantity, readRows, useResource } from "../../shared/erpData";
import type { InputLotsRow, InputsRow, MachinesRow } from "../../shared/contracts/erp";
import { Dialog } from "../field/Dialog";

interface Props {
  machine: MachinesRow;
  lots: InputLotsRow[];
  inputs: InputsRow[];
  cycles: { id: string; label: string }[];
  write: boolean;
  close: () => void;
  refreshed: () => void;
}

export function MachineService({ machine, lots, inputs, cycles, write, close, refreshed }: Props) {
  const { id, farm_id: farm } = machine;
  const { data, error: loadError, reload } = useResource(useCallback(async (signal: AbortSignal) => {
    const [services, moves] = await Promise.all([
      readRows("maintenance", [farm], signal, { machine_id: id }),
      readRows("stock_moves", [farm], signal, { machine_id: id, event: "refuel" }),
    ]);
    moves.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
    services.sort((a, b) => Number(!!a.completed_on) - Number(!!b.completed_on)
      || (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"));
    return { services, moves };
  }, [id, farm]));
  const [mode, setMode] = useState<"fuel" | "maintenance" | "finish" | null>(null);
  const [serviceId, selectService] = useState("");
  const [error, report] = useState("");
  const [busy, saving] = useState(false);
  const [request, setRequest] = useState("");
  const unit = machine.meter_unit === "hours" ? "h" : "km";
  const today = localDay();
  const fuelIds = new Set(inputs.filter(i => i.family === "fuel" && i.unit === "L").map(i => i.id));
  const fuels = lots.filter(l => fuelIds.has(l.input_id) && l.quantity > 0 && (!l.expires_on || l.expires_on >= today));
  const [lotId, selectLot] = useState("");
  const lot = fuels.find(l => l.id === lotId) ?? fuels[0];
  const service = data?.services.find(m => m.id === serviceId);
  function open(next: typeof mode) {
    report("");
    if (next === "fuel") setRequest(crypto.randomUUID());
    setMode(next);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !write) return;
    const form = new FormData(event.currentTarget);
    const val = (key: string) => String(form.get(key) ?? "").trim();
    saving(true);
    report("");
    try {
      if (mode === "fuel" && lot) {
        const args = { p_farm: farm, p_machine: id, p_request: request, p_lot: lot.id,
          p_qty: Number(val("liters")), p_meter: Number(val("meter")), p_cycle: val("cycle") || null };
        const result = await supabase.rpc("refuel_machine", args);
        if (result.error) {
          // O débito pode ter sido confirmado mesmo se a resposta se perdeu.
          const { data: prior, error } = await supabase.from("stock_moves").select("lot_id,qty,meter_reading,cycle_id")
            .eq("id", request).eq("farm_id", farm).eq("machine_id", id).eq("event", "refuel").maybeSingle();
          if (error || !prior) throw result.error;
          if (prior.lot_id !== lot.id || Number(prior.qty) !== args.p_qty ||
              Number(prior.meter_reading) !== args.p_meter || prior.cycle_id !== args.p_cycle)
            throw Error("Confira o histórico da máquina antes de registrar outro abastecimento.");
        }
      } else if (mode === "maintenance") {
        if (!val("date") && !val("meter")) throw Error("Informe a data prevista ou o contador da revisão.");
        if (!val("description")) throw Error("Descreva o serviço.");
        const { error } = await supabase.from("maintenance").insert({
          farm_id: farm, machine_id: id, kind: val("kind"), description: val("description"),
          due_on: val("date") || null, due_meter: val("meter") ? Number(val("meter")) : null,
        });
        if (error) throw error;
      } else if (mode === "finish" && service) {
        const { error } = await supabase.from("maintenance")
          .update({ completed_on: val("date"), cost: Number(val("cost")) })
          .eq("farm_id", farm).eq("machine_id", id).eq("id", service.id).is("completed_on", null).select("id").single();
        if (error) throw error;
      } else return;
      open(null);
      refreshed();
    } catch (err) { report(issueMessage(err)); }
    finally { saving(false); }
  }
  return <Dialog drawer title={machine.name} close={() => { if (!busy) close(); }}>
    <p>{machine.kind} · {quantity(machine.meter)} {unit} · {brl(machine.hourly_rate)}/h</p>
    {mode ? <form className="erp-form" onSubmit={submit}><fieldset disabled={busy}>
      <h3>{mode === "fuel" ? "Registrar abastecimento" : mode === "finish" ? "Concluir manutenção" : "Programar manutenção"}</h3>
      {mode === "fuel" && lot && <>
        <label>Combustível e lote<select value={lot.id} onChange={e => selectLot(e.target.value)}>{fuels.map(l =>
          <option key={l.id} value={l.id}>{inputs.find(i => i.id === l.input_id)?.name} · {l.code} · {quantity(l.quantity)} L</option>)}</select></label>
        <label>Litros abastecidos<input type="number" name="liters" min=".0001" step=".0001" max={lot.quantity} required /></label>
        <label>Leitura atual ({unit})<input type="number" name="meter" min={machine.meter} defaultValue={machine.meter} step=".01" required /></label>
        <label>Ciclo de cultivo<select name="cycle"><option value="">Uso geral da propriedade</option>{cycles.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
      </>}
      {mode === "maintenance" && <>
        <label>Serviço<input name="description" required autoFocus /></label>
        <label>Tipo<select name="kind"><option value="preventive">Preventiva</option><option value="corrective">Corretiva</option></select></label>
        <label>Data prevista<input type="date" name="date" /></label>
        <label>Contador previsto ({unit})<input type="number" min="0" step=".01" name="meter" /></label>
      </>}
      {mode === "finish" && <><p>{service?.description}</p><label>Data da conclusão<input type="date" name="date" defaultValue={today} max={today} required /></label>
        <label>Custo realizado (R$)<input name="cost" type="number" step=".01" min="0" defaultValue={service?.cost} required /></label></>}
      {error && <p role="alert">{error}</p>}
      <div className="erp-actions"><button type="button" onClick={() => open(null)}>Voltar</button><button className="erp-primary">{busy ? "Salvando…" : "Confirmar"}</button></div>
    </fieldset></form> : <>
      {write && <div className="erp-actions"><button disabled={!fuels.length} onClick={() => open("fuel")}>Abastecer</button><button onClick={() => open("maintenance")}>Programar manutenção</button></div>}
      {write && !fuels.length && <p>Para abastecer, registre um lote de combustível com saldo e validade vigente em <Link to="/estoque">Estoque e insumos</Link>.</p>}
      {loadError ? <p role="alert">{loadError} <button onClick={reload}>Tentar novamente</button></p> : !data ? <p>Carregando histórico…</p> : <>
        <h3>Manutenções</h3>{data.services.map(m => <div className="erp-entry" key={m.id}>
          <strong>{m.description}</strong><span>{m.kind === "preventive" ? "Preventiva" : "Corretiva"}</span>
          <small>{[m.due_on && displayDate(m.due_on), m.due_meter !== null && quantity(m.due_meter) + " " + unit].filter(Boolean).join(" · ")}</small>
          {m.completed_on ? <span>Concluída em {displayDate(m.completed_on)} · {brl(m.cost)}</span> :
            write && <button onClick={() => { selectService(m.id); open("finish"); }}>Concluir manutenção</button>}
        </div>)}{!data.services.length && <p>Nenhuma manutenção registrada.</p>}
        <h3>Histórico de abastecimentos</h3>{data.moves.map(m => <div className="erp-entry" key={m.id}><strong>{quantity(m.qty)} L · {brl(m.extended_cost)}</strong>
          <span>Lote {lots.find(l => l.id === m.lot_id)?.code} · {quantity(m.meter_reading ?? 0)} {unit}</span>
          <small>{new Date(m.recorded_at).toLocaleString("pt-BR")}</small></div>)}{!data.moves.length && <p>Nenhum abastecimento registrado.</p>}
      </>}
    </>}
  </Dialog>;
}
