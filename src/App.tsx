import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './services/supabase';
import { Login } from './pages/Login';
import { VisaoGeral } from './pages/VisaoGeral';
import { Custos } from './pages/Custos';
import { FarmProvider } from './contexts/FarmContext';
import { Mapa } from './pages/Mapa';
import { Configuracoes } from './pages/Configuracoes';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div>A carregar sistema...</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={!session ? <Login /> : <Navigate to="/visao-geral" replace />} />
        
        <Route path="/visao-geral" element={session ? <FarmProvider><VisaoGeral /></FarmProvider> : <Navigate to="/" replace />} />
        <Route path="/custos" element={session ? <FarmProvider><Custos /></FarmProvider> : <Navigate to="/" replace />} />
        <Route path="/mapa" element={session ? <FarmProvider><Mapa /></FarmProvider> : <Navigate to="/" replace />} />
        <Route path="/configuracoes" element={session ? <FarmProvider><Configuracoes /></FarmProvider> : <Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}