import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Boxes,
  CircleDollarSign,
  Map as MapIcon,
  Settings,
  LogOut,
  Tractor,
  Wheat,
  Plus,
  X,
  Sprout,
  Sun,
  Moon,
  Search,
  Menu,
  ChartColumn,
  Wallet,
  PanelLeftClose,
} from "lucide-react";
import { useFields } from "../../features/field/context";
import { Commands } from "../../features/field/Commands";
import { supabase } from "../../services/supabase";
import { createFarm } from "../../features/farms/services/api";
import { useFarm } from "../../contexts/FarmContext";
import { useTranslation } from "../../hooks/useTranslation";
import styles from "./styles.module.css";
import { OpenCopilot } from "./CopilotSearch";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { farms, activeFarmId, setActiveFarmId, loadingFarms, refreshFarms } =
    useFarm();
  const { t } = useTranslation();
  const { demo } = useFields();
  const [palette, setPalette] = useState<string | null>(null);
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K";
  const [compact, setCompact] = useState(
    localStorage.getItem("agro:rail") === "compact",
  );
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(
    document.documentElement.dataset.theme === "dark",
  );
  function switchTheme() {
    const theme = dark ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("agro-theme", theme);
    setDark(!dark);
  }
  useEffect(() => {
    function keys(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => v === null ? "" : null);
      }
      if (e.key === "Escape") setMobile(false);
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);

  const [isNewFarmModalOpen, setIsNewFarmModalOpen] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const menuItems = [
    { path: "/visao-geral", icon: LayoutDashboard, label: t("menuOverview") },
    { path: "/mapa", icon: MapIcon, label: "Mapa dos talhões" },
    ...(demo ? [] : [{ path: "/safras", icon: Sprout, label: "Safras e ciclos" }]),
    { path: "/estoque", icon: Boxes, label: "Estoque e insumos" },
    { path: "/operacoes", icon: Tractor, label: "Operações e frota" },
    ...(demo ? [] : [{ path: "/colheita", icon: Wheat, label: "Colheita e armazenagem" }]),
    { path: "/economia", icon: ChartColumn, label: "Economia da safra" },
    ...(demo
      ? []
      : [
          { path: "/custos", icon: Wallet, label: "Lançamentos" },
          { path: "/relatorios", icon: CircleDollarSign, label: "Relatórios" },
          { path: "/configuracoes", icon: Settings, label: t("menuSettings") },
        ]),
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  async function handleCreateFarmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newFarmName.trim()) return;

    setIsCreating(true);
    try {
      await createFarm(newFarmName);
      await refreshFarms();
      setIsNewFarmModalOpen(false);
      setNewFarmName("");
    } catch (error) {
      alert("Erro ao criar fazenda.");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div
      className={
        "workspace " + (compact ? "compact " : "") + (mobile ? "nav-open" : "")
      }
    >
      {mobile && (
        <button
          aria-label="Fechar menu"
          className="rail-mask"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className="rail">
        <span className="field-print rail-print" aria-hidden="true" />
        <div className="rail-brand">
          <span className="brand-symbol"><Sprout size={19} /></span>
          <strong>Gestia</strong>
          <button
            aria-label="Alternar navegação"
            onClick={() => {
              localStorage.setItem(
                "agro:rail",
                compact ? "expanded" : "compact",
              );
              setCompact(!compact);
              setMobile(false);
            }}
          >
            <PanelLeftClose size={17} />
          </button>
        </div>
        <nav aria-label="Navegação principal">
          {menuItems.map(({ path, icon: Icon, label }) => {
            const url = (demo ? "/demo" : "") + path;
            const active =
              location.pathname === url ||
              (demo &&
                location.pathname === "/demo" &&
                path === "/visao-geral");
            return (
              <div key={path} className="rail-section">
                {["/visao-geral", "/estoque", "/economia"].includes(path) && (
                  <small>
                    {path === "/visao-geral"
                      ? "Fazenda"
                      : path === "/estoque"
                        ? "Execução"
                        : "Gestão"}
                  </small>
                )}
                <Link
                  key={path}
                  to={url}
                  title={label}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setMobile(false)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              </div>
            );
          })}
        </nav>
        <div className="rail-group">
          <small>Área de trabalho</small>
          <button
            title="Copiloto agronômico"
            onClick={() => {
              setPalette("");
              setMobile(false);
            }}
          >
            <Search size={17} />
            <span>Copiloto</span>
            <kbd>{shortcut}</kbd>
          </button>
          {!demo && (
            <button
              title={t("newFarmTitle")}
              onClick={() => {
                setIsNewFarmModalOpen(true);
                setMobile(false);
              }}
            >
              <Plus size={17} />
              <span>Nova propriedade</span>
            </button>
          )}
        </div>
        <div className="rail-account">
          <button
            onClick={() => (demo ? navigate("/") : handleLogout())}
            title={demo ? "Acessar conta" : t("menuLogout")}
          >
            <LogOut size={18} />
            <span>{demo ? "Acessar minha conta" : t("menuLogout")}</span>
          </button>
        </div>
      </aside>
      <main className="work-main">
        <span className="field-print canvas-print" aria-hidden="true" />
        <header className="work-bar">
          <button
            className="menu-button"
            aria-label="Abrir navegação"
            onClick={() => setMobile(true)}
          >
            <Menu size={21} />
          </button>
          <div className="farm-picker">
            <Sprout size={17} />
            {demo ? (
              <strong>Fazenda Boa Vista</strong>
            ) : loadingFarms ? (
              t("loading")
            ) : farms.length ? (
              <select
                aria-label="Propriedade ativa"
                value={activeFarmId}
                onChange={(e) => setActiveFarmId(e.target.value)}
              >
                <option value="all">{t("allFarms")}</option>
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            ) : (
              t("noFarms")
            )}
          </div>
          <div className="bar-tools">
            {!demo && ["/estoque","/operacoes","/safras","/colheita","/economia"].includes(location.pathname) &&
              <button onClick={() => navigate("/registros?modulo=" + encodeURIComponent(location.pathname))}>Gerenciar registros</button>}
            <button
              onClick={() => setPalette("")}
              title="Copiloto (Ctrl ou Cmd + K)"
            >
              <Search size={16} />
              <span>Buscar no painel</span>
              <kbd>{shortcut}</kbd>
            </button>
            <button
              onClick={switchTheme}
              aria-label={dark ? "Usar tema claro" : "Usar tema escuro"}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        {palette !== null && <Commands initialQuery={palette} close={() => setPalette(null)} />}

        <OpenCopilot.Provider value={setPalette}>
          <section className={styles.content}>{children}</section>
        </OpenCopilot.Provider>
      </main>

      {/* Modal Customizado de Nova Fazenda */}
      {isNewFarmModalOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsNewFarmModalOpen(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>{t("newFarmTitle")}</h3>
              <button
                className={styles.closeBtn}
                onClick={() => setIsNewFarmModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateFarmSubmit}>
              <div className={styles.formGroup}>
                <label>{t("newFarmNameLabel")}</label>
                <input
                  type="text"
                  autoFocus
                  required
                  className={styles.modalInput}
                  placeholder={t("newFarmPlaceholder")}
                  value={newFarmName}
                  onChange={(e) => setNewFarmName(e.target.value)}
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnCancel}
                  onClick={() => setIsNewFarmModalOpen(false)}
                >
                  {t("cancelBtn")}
                </button>
                <button
                  type="submit"
                  className={styles.btnSave}
                  disabled={isCreating || !newFarmName.trim()}
                >
                  {isCreating ? t("loading") : t("createBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
