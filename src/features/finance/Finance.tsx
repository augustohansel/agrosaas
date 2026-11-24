import { useCallback, useState } from "react";
import { Layout } from "../../components/Layout";
import { useSearchParams } from "react-router-dom";
import { Dialog } from "../field/Dialog";
import { useFarm } from "../../contexts/FarmContext";
import { brl, displayDate, localDay, useResource } from "../../shared/erpData";
import { useFields } from "../field/context";
import { BillForm } from "./BillForm";
import { basisNames, cashByMonth, loadFinance } from "./data";

export default function Finance() {
  const { activeFarmId, farms } = useFarm();
  const { fields } = useFields();
  const farm = farms.find(f => f.id === activeFarmId);
  const scope = farm?.id ?? (activeFarmId === "all" ? farms.map(f => f.id).join(",") : "");
  const write = !!farm && ["owner", "manager", "editor"].includes(farm.role ?? "");
  const { data, error, reload } = useResource(useCallback(
    (signal: AbortSignal) => loadFinance(scope ? scope.split(",") : [], signal), [scope],
  ));
  const [tab, setTab] = useState("Títulos");
  const [season, setSeason] = useState("");
  const [status, setStatus] = useState("open");
  const [params] = useSearchParams();
  const [action, setAction] = useState(params.get("criar") === "titulo" ? "new" : "");
  const [detailId, inspect] = useState(params.get("titulo") ?? "");
  const [notice, notify] = useState("");
  const farmName = (id: string) => farms.find(f => f.id === id)?.name;
  const cycleName = (id: string) => {
    const c = data?.cycles.find(c => c.id === id);
    if (!c) return "Ciclo indisponível";
    return [fields.find(f => f.id === c.plot_id)?.name ?? "Talhão", c.crop, data?.seasons.find(s => s.id === c.season_id)?.name].filter(Boolean).join(" · ");
  };
  const cycleIds = new Set(data?.cycles.filter(c => c.season_id === season).map(c => c.id));
  const inScope = (id: string | null) => !season || (!!id && cycleIds.has(id));
  const bills = data?.bills.filter(b => inScope(b.cycle_id)) ?? [];
  const txs = data?.transactions.filter(t => inScope(t.cycle_id)) ?? [];
  const economics = data?.economics.filter(c => inScope(c.cycle_id)) ?? [];
  const open = bills.filter(b => !b.settled_on);
  const visibleBills = bills.filter(b => status === "all" || (status === "paid" ? !!b.settled_on : !b.settled_on));
  const bill = data?.bills.find(b => b.id === action);
  const detail = data?.bills.find(b => b.id === detailId);
  const months = cashByMonth(txs, bills);
  return <Layout><div className="field-console">
    <div className="page-heading"><div><h1>Economia da safra</h1><p>Vencimentos, movimento de caixa e resultado por talhão.</p></div>
      {data && <div className="erp-actions"><label>Safra <select value={season} onChange={e => { setSeason(e.target.value); notify(""); }}>
        <option value="">Todas as safras e despesas gerais</option>{data.seasons.map(s => <option key={s.id} value={s.id}>{s.name}{!farm && " · " + farmName(s.farm_id)}</option>)}</select></label>
        {write && <button className="erp-primary" onClick={() => setAction("new")}>Novo título</button>}</div>}
    </div>
    {error ? <p role="alert">{error} <button onClick={reload}>Tentar novamente</button></p> : !data ? <p role="status">Carregando financeiro…</p> : <>
      {!farm && <p>Selecione uma propriedade para cadastrar e liquidar títulos.</p>}
      {notice && <p className="erp-feedback" role="status">{notice}</p>}
      <div className="metrics">{[
        ["A pagar em aberto", open.reduce((n, b) => n + (b.kind === "payable" ? Number(b.amount) : 0), 0)],
        ["A receber em aberto", open.reduce((n, b) => n + (b.kind === "receivable" ? Number(b.amount) : 0), 0)],
        ["Margem projetada", economics.reduce((n, c) => n + Number(c.projected_margin), 0)],
        ["Margem realizada", economics.reduce((n, c) => n + Number(c.realized_margin), 0)],
      ].map(([label, amount]) => <div className="metric" key={label}><header>{label}</header><strong>{brl(Number(amount))}</strong></div>)}</div>
      <div className="erp-actions" role="group" aria-label="Consultas financeiras">{["Títulos", "Fluxo de caixa", "Resultados por talhão"].map(t =>
        <button className={tab === t ? "erp-primary" : ""} key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === "Títulos" && <section className="panel erp-list"><header><h2>Contas a pagar e receber</h2>
        <select aria-label="Situação dos títulos" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="open">Em aberto</option><option value="paid">Liquidados</option><option value="all">Todos os títulos</option></select></header>
        {visibleBills.length ? <div className="erp-scroll"><table><thead><tr><th>Título</th><th>Centro de custo</th><th>Vencimento</th><th>Valor</th><th>Situação</th></tr></thead><tbody>
          {visibleBills.map(b => <tr key={b.id}><td>{b.description}<small>{b.kind === "payable" ? "A pagar" : "A receber"} · {basisNames[b.basis]}{!farm && " · " + farmName(b.farm_id)}</small></td>
            <td>{b.cycle_id ? cycleName(b.cycle_id) : "Geral"}</td><td>{displayDate(b.due_on)}</td><td>{brl(b.amount)}</td>
            <td>{b.settled_on ? "Liquidado em " + displayDate(b.settled_on) : <>{b.due_on < localDay() ? "Vencido" : "Em aberto"} {write && <button onClick={() => setAction(b.id)}>{b.kind === "payable" ? "Pagar" : "Receber"}</button>}</>}</td></tr>)}</tbody></table></div>
          : <p>Nenhum título nesta seleção.</p>}</section>}
      {tab === "Fluxo de caixa" && <>
        <section className="panel erp-list"><header><h2>Movimento mensal</h2></header>
          {months.length ? <div className="erp-scroll"><table><thead><tr><th>Mês</th><th>Entradas realizadas</th><th>Saídas realizadas</th><th>Saldo do mês</th><th>A receber</th><th>A pagar</th></tr></thead><tbody>
            {months.map(([month, m]) => <tr key={month}><td>{month.split("-").reverse().join("/")}</td>{[m.income, m.expense, m.income - m.expense, m.receivable, m.payable].map((v, i) => <td key={i}>{brl(v)}</td>)}</tr>)}
          </tbody></table></div> : <p>Sem movimentos ou vencimentos nesta seleção.</p>}</section>
        <section className="panel erp-list"><header><h2>Extrato de caixa</h2></header>
          {txs.length ? <div className="erp-scroll"><table><thead><tr><th>Lançamento</th><th>Data</th><th>Tipo</th><th>Valor</th></tr></thead><tbody>
            {txs.map(t => <tr key={t.id}><td>{t.description || t.category}<small>{[t.cycle_id && cycleName(t.cycle_id), (!farm || !t.cycle_id) && farmName(t.farm_id)].filter(Boolean).join(" · ")}</small></td>
              <td>{displayDate(t.transaction_date)}</td><td>{t.type === "income" ? "Entrada" : t.type === "expense" ? "Saída" : "Sem classificação"}</td><td>{brl(t.amount)}</td></tr>)}
          </tbody></table></div> : <p>Nenhum lançamento nesta seleção.</p>}</section>
      </>}
      {tab === "Resultados por talhão" && <section className="panel erp-list"><header><h2>Resultado por ciclo de cultivo</h2></header>
        {economics.length ? <div className="erp-scroll"><table><thead><tr><th>Talhão e ciclo</th><th>Custo apropriado</th><th>Custo/ha</th><th>Vendas recebidas</th><th>Margem projetada</th><th>Margem realizada</th></tr></thead><tbody>
          {economics.map(c => <tr key={c.cycle_id}><td>{cycleName(c.cycle_id ?? "")}{!farm && <small>{farmName(c.farm_id ?? "")}</small>}</td>
            {[c.actual_cost, c.cost_per_ha, c.received_revenue, c.projected_margin, c.realized_margin].map((v, i) => <td key={i}>{v === null ? "—" : brl(v)}</td>)}</tr>)}
        </tbody></table></div> : <p>Nenhum ciclo de cultivo nesta seleção.</p>}</section>}
      {detail && <Dialog drawer title={detail.description} close={() => inspect("")}>
        <p>{basisNames[detail.basis]} · {brl(detail.amount)}</p><p>Vencimento em {displayDate(detail.due_on)}</p>
        <p>{detail.cycle_id ? cycleName(detail.cycle_id) : "Geral da propriedade"}</p>
        <p>{detail.settled_on ? "Liquidado em " + displayDate(detail.settled_on) : "Em aberto"}</p>
        {write && !detail.settled_on && <button className="erp-primary" onClick={() => { inspect(""); setAction(detail.id); }}>{detail.kind === "payable" ? "Pagar" : "Receber"}</button>}
      </Dialog>}
      {farm && write && (action === "new" || bill) && <BillForm farm={farm.id} data={data} bill={bill} cycleName={cycleName} close={() => setAction("")} saved={() => {
        notify(bill ? "Liquidação registrada no caixa." : "Título cadastrado."); setAction(""); reload();
      }} />}
    </>}
  </div></Layout>;
}
