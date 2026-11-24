import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { useFarmScope } from "../../contexts/FarmContext";
import { useFields } from "../field/context";
import { Dialog } from "../field/Dialog";
import { displayDate, quantity, useResource } from "../../shared/erpData";
import { loadHarvest, storageLabels } from "./data";
import { HarvestForm, type Action } from "./HarvestForm";

export default function Harvest() {
  const { scope } = useFarmScope();
  return <Layout><div className="field-console">
    {scope ? <FarmHarvest key={scope} />
      : <><h1>Colheita e armazenagem</h1><p>Selecione uma propriedade para consultar cargas e saldos.</p></>}
  </div></Layout>;
}

function FarmHarvest() {
  const { selected, scope, all, write, farmName } = useFarmScope();
  const { fields } = useFields();
  const { data, error, reload } = useResource(useCallback((signal: AbortSignal) => loadHarvest(scope.split(","), signal), [scope]));
  const [action, act] = useState<Action | null>(null);
  const [ticketId, inspect] = useState("");
  const [notice, notify] = useState("");
  const heading = <h1>Colheita e armazenagem</h1>;
  if (!data) return <>{heading}{error ? <p role="alert">{error} <button onClick={reload}>Tentar novamente</button></p> : <p role="status">Carregando romaneios e saldos…</p>}</>;
  const { destinations, loads, balances, dispatches, cycles, seasons, economics } = data;
  function cycleName(id: string) {
    const c = cycles.find(c => c.id === id);
    if (!c) return "Ciclo indisponível";
    return [all && farmName(c.farm_id), fields.find(f => f.id === c.plot_id)?.name ?? "Talhão", c.crop, seasons.find(s => s.id === c.season_id)?.name].filter(Boolean).join(" · ");
  }
  const destinationName = (id: string) => destinations.find(d => d.id === id)?.name;
  const ticket = loads.find(l => l.id === ticketId);
  return <>
    <div className="page-heading"><div>{heading}<p>Pesagem, produtividade e custódia de grãos por ciclo.</p></div>
      {write && <div className="erp-actions"><button onClick={() => act({ kind: "destination" })}>Cadastrar destino</button>
        <button className="erp-primary" disabled={!cycles.length || !destinations.length} onClick={() => act({ kind: "load" })}>Registrar romaneio</button></div>}
    </div>
    {all && <p>Selecione uma fazenda para registrar cargas e expedições.</p>}
    {notice && <p role="status" className="erp-feedback">{notice}</p>}
    {!cycles.length && <p>Vincule um talhão em <Link to="/safras">Safras e ciclos</Link> para registrar a colheita.</p>}
    <section className="panel erp-list"><header><h2>Saldo por destino</h2></header>
      {!destinations.length ? <p>Nenhum destino cadastrado nesta propriedade.</p> : <div className="erp-scroll"><table><thead><tr><th>Destino</th><th>Talhão e ciclo</th><th>Saldo</th>{write && <th>Expedição</th>}</tr></thead>
        <tbody>{destinations.flatMap(d => {
          const rows = balances.filter(b => b.destination_id === d.id && b.cycle_id);
          if (!rows.length) return [<tr key={d.id}><td>{d.name}<small>{[storageLabels[d.kind], all && farmName(d.farm_id)].filter(Boolean).join(" · ")}</small></td><td>Sem recebimentos</td><td>0 kg</td>{write && <td>—</td>}</tr>];
          return rows.map(b => <tr key={d.id + b.cycle_id}><td>{d.name}<small>{storageLabels[d.kind]}</small></td>
            <td>{cycleName(b.cycle_id!)}</td><td>{quantity(b.kg ?? 0)} kg</td>{write && <td><button disabled={!b.kg} onClick={() => act({ kind: "dispatch", destination: d.id, cycle: b.cycle_id! })}>Expedir</button></td>}</tr>);
        })}</tbody></table></div>}
    </section>
    <section className="panel erp-list"><header><h2>Produtividade por ciclo</h2></header>
      {cycles.length ? <div className="erp-scroll"><table><thead><tr><th>Talhão e ciclo</th><th>Área</th><th>Colhido</th><th>Prevista</th><th>Realizada</th></tr></thead>
        <tbody>{cycles.map(c => { const stats = economics.find(e => e.cycle_id === c.id); return <tr key={c.id}><td>{cycleName(c.id)}<small>Saca de {quantity(c.bag_kg)} kg</small></td>
          <td>{quantity(c.area_ha)} ha</td><td>{quantity(stats?.harvested_kg ?? 0)} kg</td><td>{quantity(c.forecast_sc_ha)} sc/ha</td>
          <td>{stats?.harvested_kg ? quantity(stats.actual_sc_ha ?? 0) + " sc/ha" : "—"}</td></tr>; })}</tbody></table></div> : <p>Nenhum ciclo cadastrado.</p>}
    </section>
    <section className="panel erp-list"><header><h2>Romaneios recebidos</h2></header>
      {loads.length ? <div className="erp-scroll"><table><thead><tr><th>Romaneio</th><th>Recebimento</th><th>Talhão e ciclo</th><th>Destino</th><th>Peso líquido</th></tr></thead>
        <tbody>{loads.map(l => <tr key={l.id}><td><button onClick={() => inspect(l.id)}>{l.ticket}</button></td><td>{displayDate(l.received_on)}</td>
          <td>{cycleName(l.cycle_id)}</td><td>{destinationName(l.destination_id)}</td><td>{quantity(l.net_kg ?? 0)} kg</td></tr>)}</tbody></table></div> : <p>Nenhum romaneio recebido.</p>}
    </section>
    <section className="panel erp-list"><header><h2>Expedições</h2></header>
      {dispatches.length ? <div className="erp-scroll"><table><thead><tr><th>Documento</th><th>Saída</th><th>Origem</th><th>Destinatário</th><th>Peso</th></tr></thead>
        <tbody>{dispatches.map(d => <tr key={d.id}><td>{d.document}</td><td>{displayDate(d.shipped_on)}</td><td>{destinationName(d.destination_id)}<small>{cycleName(d.cycle_id)}</small></td>
          <td>{d.recipient}</td><td>{quantity(d.kg)} kg</td></tr>)}</tbody></table></div> : <p>Nenhuma saída registrada.</p>}
    </section>
    {action && write && selected && <HarvestForm farm={selected.id} data={data} action={action} cycleName={cycleName} close={() => act(null)} saved={() => {
      notify({ load: "Romaneio registrado.", dispatch: "Expedição registrada.", destination: "Destino cadastrado." }[action.kind]); act(null); reload();
    }} />}
    {ticket && <Dialog drawer title={"Romaneio " + ticket.ticket} close={() => inspect("")}>
      <p>{cycleName(ticket.cycle_id)} · {displayDate(ticket.received_on)} · {destinationName(ticket.destination_id)}</p>
      <dl className="details-list">{[
        ["Peso bruto", quantity(ticket.gross_kg) + " kg"], ["Tara", quantity(ticket.tare_kg) + " kg"],
        ["Umidade", quantity(ticket.moisture_pct) + "%"], ["Impurezas", quantity(ticket.impurity_pct) + "%"],
        ["Desconto informado", quantity(ticket.deduction_kg) + " kg"], ["Peso líquido", quantity(ticket.net_kg ?? 0) + " kg"],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </Dialog>}
  </>;
}
