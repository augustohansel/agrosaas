import { createContext, useContext, useState } from "react";
import { ArrowRight, Search } from "lucide-react";

export const OpenCopilot = createContext<((query: string) => void) | null>(null);

export function CopilotSearch() {
  const open = useContext(OpenCopilot);
  const [query, setQuery] = useState("");
  return (
    <form className="overview-search" role="search" aria-label="Consultar a fazenda"
      onSubmit={event => { event.preventDefault(); open?.(query.trim()); }}>
      <Search size={18} aria-hidden="true" />
      <input aria-label="Consulta ao Copiloto" placeholder="Consultar o Copiloto da fazenda…" value={query}
        onChange={event => setQuery(event.target.value)} />
      <button type="submit" aria-label="Abrir consulta no Copiloto"><ArrowRight size={17} /></button>
    </form>
  );
}
