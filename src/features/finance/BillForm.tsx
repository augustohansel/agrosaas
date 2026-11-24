import { useState, type FormEvent } from "react";
import { Dialog } from "../field/Dialog";
import { supabase } from "../../services/supabase";
import { brl, displayDate, issueMessage, localDay } from "../../shared/erpData";
import type { BillKind, CostBasis } from "../../shared/contracts/scalars";
import type { BillsRow } from "./contracts";
import { basisNames, type FinanceData } from "./data";
import { transactionCategories } from "../transactions/categories";
import { useTranslation } from "../../hooks/useTranslation";

interface Props {
  farm: string;
  data: FinanceData;
  bill?: BillsRow;
  cycleName: (id: string) => string;
  close: () => void;
  saved: () => void;
}

export function BillForm({ farm, data, bill, cycleName, close, saved }: Props) {
  const { tCategory } = useTranslation();
  const [kind, setKind] = useState<BillKind>("payable");
  const [basis, setBasis] = useState<CostBasis>("direct");
  const [source, selectSource] = useState("");
  const [cycle, selectCycle] = useState("");
  const [busy, saving] = useState(false);
  const [error, report] = useState("");
  const harvest = basis === "sale" ? data.loads.find(l => l.id === source) : undefined;
  const allowed: CostBasis[] = kind === "payable" ? ["direct", "inventory", "equipment", "other"] : ["sale", "other"];
  const sources = basis === "inventory" ? data.receipts.map(r => ({ id: r.id, name: (r.document || "Entrada") + " · " + brl(r.extended_cost) }))
    : basis === "sale" ? data.loads.map(l => ({ id: l.id, name: l.ticket + " · " + cycleName(l.cycle_id) }))
    : basis === "equipment" ? data.maintenance.map(m => ({ id: m.id, name: m.description + " · " + brl(m.cost) })) : [];
  const settling = bill?.kind === "payable" ? "Registrar pagamento" : "Registrar recebimento";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const value = (key: string) => String(fields.get(key) ?? "").trim();
    saving(true);
    report("");
    try {
      if (bill) {
        const { error } = await supabase.rpc("settle_bill", { p_farm: farm, p_bill: bill.id, p_date: value("date") });
        if (error) throw error;
      } else {
        if (!value("description")) throw Error("Informe a descrição do título.");
        const amount = Number(value("amount"));
        const { error } = await supabase.from("bills").insert({
          farm_id: farm, kind, basis, category: value("category"), description: value("description"), due_on: value("date"), amount,
          cycle_id: harvest?.cycle_id || cycle || null,
          receipt_id: basis === "inventory" && source || null,
          maintenance_id: basis === "equipment" && source || null,
          harvest_id: harvest?.id ?? null,
        });
        if (error) throw error;
      }
      saved();
    } catch (err) { report(issueMessage(err)); }
    finally { saving(false); }
  }
  return <Dialog title={bill ? settling : "Novo título"} close={() => { if (!busy) close(); }}>
    <form className="erp-form" onSubmit={submit}><fieldset disabled={busy}>
      {bill ? <p>{bill.description} · {brl(bill.amount)} · Vencimento em {displayDate(bill.due_on)}</p> : <>
        <label>Tipo<select value={kind} onChange={e => {
          const next = e.target.value as BillKind;
          setKind(next); setBasis(next === "payable" ? "direct" : "sale"); selectSource("");
        }}><option value="payable">Conta a pagar</option><option value="receivable">Conta a receber</option></select></label>
        <label>Descrição<input name="description" required autoFocus /></label>
        <label>Classificação<select value={basis} onChange={e => { setBasis(e.target.value as CostBasis); selectSource(""); }}>
          {allowed.map(b => <option key={b} value={b}>{basisNames[b]}</option>)}</select></label>
        <label>Categoria do lançamento<select key={kind} name="category" defaultValue="" required>
          <option value="" disabled>Selecione a categoria</option>
          {transactionCategories[kind === "payable" ? "expense" : "income"].map(category =>
            <option key={category} value={category}>{tCategory(category)}</option>)}
        </select></label>
        {sources.length > 0 && <label>Documento de origem<select value={source} onChange={e => selectSource(e.target.value)}>
          <option value="">Sem vínculo</option>{sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        <label>Centro de custo<select disabled={!!harvest} value={harvest?.cycle_id ?? cycle} onChange={e => selectCycle(e.target.value)}>
          <option value="">Geral da propriedade</option>{data.cycles.map(c => <option key={c.id} value={c.id}>{cycleName(c.id)}</option>)}</select></label>
        <label>Valor do título (R$)<input name="amount" type="number" min=".01" step=".01" required /></label>
      </>}
      <label>{bill ? "Data da liquidação" : "Vencimento"}<input name="date" type="date" defaultValue={localDay()} max={bill ? localDay() : undefined} required /></label>
      {error && <p role="alert">{error}</p>}
      <button className="erp-primary">{busy ? "Salvando…" : bill ? settling : "Cadastrar título"}</button>
    </fieldset></form>
  </Dialog>;
}
