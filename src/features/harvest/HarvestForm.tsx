import { useState, type FormEvent } from "react";
import { Dialog } from "../field/Dialog";
import { supabase } from "../../services/supabase";
import { issueMessage, localDay, quantity } from "../../shared/erpData";
import { storageLabels, type HarvestData } from "./data";

export type Action = { kind: "destination" } | { kind: "load" } | { kind: "dispatch"; destination: string; cycle: string };
const titles = { destination: "Cadastrar destino", load: "Registrar romaneio", dispatch: "Registrar expedição" };

export function HarvestForm({ farm, data, action, cycleName, close, saved }: {
  farm: string; data: HarvestData; action: Action; cycleName: (id: string) => string;
  close: () => void; saved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, report] = useState("");
  const [gross, setGross] = useState("");
  const [tare, setTare] = useState("");
  const [deduction, setDeduction] = useState("0");
  const net = (Math.round(Number(gross) * 1000) - Math.round(Number(tare) * 1000) - Math.round(Number(deduction) * 1000)) / 1000;
  const balance = action.kind === "dispatch" ? data.balances.find(b => b.destination_id === action.destination && b.cycle_id === action.cycle)?.kg ?? 0 : 0;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const value = (key: string) => String(fields.get(key) ?? "").trim();
    setBusy(true);
    report("");
    try {
      let result;
      if (action.kind === "destination") {
        if (!value("name")) throw Error("Informe o nome do destino.");
        result = await supabase.from("destinations").insert({ farm_id: farm, kind: value("kind"), name: value("name") });
      } else if (action.kind === "load") {
        if (!value("ticket")) throw Error("Informe o número do romaneio.");
        if (net <= 0) throw Error("O peso bruto precisa superar a soma da tara e do desconto.");
        result = await supabase.from("harvest_loads").insert({
          farm_id: farm, destination_id: value("destination"), cycle_id: value("cycle"), ticket: value("ticket"),
          received_on: value("date"), gross_kg: Number(gross), tare_kg: Number(tare), deduction_kg: Number(deduction),
          moisture_pct: Number(value("moisture")), impurity_pct: Number(value("impurity")),
        });
      } else {
        if (!value("document") || !value("recipient")) throw Error("Informe o documento e o destinatário.");
        result = await supabase.from("grain_dispatches").insert({
          farm_id: farm, destination_id: action.destination, cycle_id: action.cycle, shipped_on: value("date"),
          document: value("document"), kg: Number(value("kg")), recipient: value("recipient"),
        });
      }
      if (result.error) throw result.error;
      saved();
    } catch (err) { report(issueMessage(err)); }
    finally { setBusy(false); }
  }
  return <Dialog title={titles[action.kind]} close={() => { if (!busy) close(); }}>
    <form className="erp-form" onSubmit={submit}><fieldset disabled={busy}>
      {action.kind === "destination" && <>
        <label>Nome do destino<input name="name" required autoFocus /></label>
        <label>Tipo<select name="kind">{Object.entries(storageLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
      </>}
      {action.kind === "load" && <>
        <label>Romaneio<input name="ticket" required autoFocus /></label>
        <label>Talhão e ciclo<select name="cycle" required>{data.cycles.map(c => <option key={c.id} value={c.id}>{cycleName(c.id)}</option>)}</select></label>
        <label>Destino<select name="destination" required>{data.destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label>Data de recebimento<input name="date" type="date" defaultValue={localDay()} required /></label>
        <div className="erp-pair"><label>Bruto (kg)<input type="number" step=".001" min=".001" value={gross} onChange={e => setGross(e.target.value)} required /></label>
          <label>Tara (kg)<input type="number" step=".001" min="0" value={tare} onChange={e => setTare(e.target.value)} required /></label></div>
        <div className="erp-pair"><label>Umidade (%)<input name="moisture" type="number" step=".01" min="0" max="100" required /></label>
          <label>Impurezas (%)<input name="impurity" type="number" step=".01" min="0" max="100" required /></label></div>
        <label>Desconto do romaneio (kg)<input type="number" step=".001" min="0" value={deduction} onChange={e => setDeduction(e.target.value)} required /></label>
        <p className="erp-total">Peso líquido <strong>{gross && tare ? quantity(net) + " kg" : "—"}</strong></p>
      </>}
      {action.kind === "dispatch" && <>
        <p>{data.destinations.find(d => d.id === action.destination)?.name} · {cycleName(action.cycle)}</p>
        <p>Saldo disponível: {quantity(balance)} kg</p>
        <label>Documento de saída<input name="document" required autoFocus /></label>
        <label>Destinatário<input name="recipient" required /></label>
        <label>Data de expedição<input name="date" type="date" defaultValue={localDay()} required /></label>
        <label>Peso expedido (kg)<input name="kg" type="number" min=".001" max={balance} step=".001" required /></label>
      </>}
      {error && <p role="alert">{error}</p>}
      <button className="erp-primary">{busy ? "Salvando…" : titles[action.kind]}</button>
    </fieldset></form>
  </Dialog>;
}
