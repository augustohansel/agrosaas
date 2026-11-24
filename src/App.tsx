import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { FieldProvider } from "./features/field/context";
import { lazy, Suspense, useEffect, useState } from "react";
import { supabase } from "./services/supabase";
import { Login } from "./pages/Login";
import { FarmProvider, useFarm } from "./contexts/FarmContext";
const Console = lazy(() =>
  import("./features/field/Console").then((m) => ({ default: m.Console })),
);
const Inventory = lazy(() =>
  import("./features/inventory/Inventory").then((m) => ({
    default: m.Inventory,
  })),
);
const Seasons = lazy(() => import("./features/seasons/Seasons"));
const Harvest = lazy(() => import("./features/harvest/Harvest"));
const Finance = lazy(() => import("./features/finance/Finance"));
const Records = lazy(() => import("./features/records/Records"));
const Overview = lazy(() =>
  import("./features/overview/Overview").then((m) => ({ default: m.Overview })),
);
const VisaoGeral = lazy(() =>
  import("./pages/VisaoGeral").then((m) => ({ default: m.VisaoGeral })),
);
const Custos = lazy(() =>
  import("./pages/Custos").then((m) => ({ default: m.Custos })),
);
const Mapa = lazy(() =>
  import("./pages/Mapa").then((m) => ({ default: m.Mapa })),
);
const Configuracoes = lazy(() =>
  import("./pages/Configuracoes").then((m) => ({ default: m.Configuracoes })),
);

function FarmWorkspace() {
  const { activeFarmId, loadingFarms } = useFarm();
  const { pathname, state, key } = useLocation();
  if (loadingFarms) return <div className="boot">Carregando propriedades…</div>;
  return (
    <FieldProvider key={pathname + activeFarmId + (state?.fromCopilot ? key : "")}>
      <Outlet />
    </FieldProvider>
  );
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div>A carregar sistema...</div>;

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="boot" role="status">
            Abrindo painel…
          </div>
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              !session ? <Login /> : <Navigate to="/visao-geral" replace />
            }
          />

          <Route
            element={
              session ? (
                <FarmProvider key={session.user.id}>
                  <FarmWorkspace />
                </FarmProvider>
              ) : (
                <Navigate to="/" replace />
              )
            }
          >
            <Route path="estoque" element={<Inventory />} />
            <Route path="registros" element={<Records />} />
            <Route path="safras" element={<Seasons />} />
            <Route path="colheita" element={<Harvest />} />
            <Route path="visao-geral" element={<Overview />} />
            <Route path="operacoes" element={<Console />} />
            <Route path="economia" element={<Finance />} />
            <Route path="relatorios" element={<VisaoGeral />} />
            <Route path="custos" element={<Custos />} />
            <Route path="mapa" element={<Mapa />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>
          <Route
            path="/demo"
            element={
              <FieldProvider demo>
                <Outlet />
              </FieldProvider>
            }
          >
            <Route index element={<Overview />} />
            <Route path="visao-geral" element={<Overview />} />
            <Route path="estoque" element={<Inventory />} />
            {["mapa", "operacoes", "economia"].map((path) => (
              <Route key={path} path={path} element={<Console key={path} />} />
            ))}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
