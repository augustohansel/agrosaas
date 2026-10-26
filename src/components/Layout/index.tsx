import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CircleDollarSign, Map as MapIcon, Settings, LogOut, Tractor, Plus, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { createFarm } from '../../features/farms/services/api';
import { useFarm } from '../../contexts/FarmContext';
import { CustomSelect } from '../CustomSelect';
import { useTranslation } from '../../hooks/useTranslation';
import styles from './styles.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { farms, activeFarmId, setActiveFarmId, loadingFarms, refreshFarms } = useFarm();
  const { t } = useTranslation();

  const [isNewFarmModalOpen, setIsNewFarmModalOpen] = useState(false);
  const [newFarmName, setNewFarmName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const menuItems = [
    { path: '/visao-geral', icon: LayoutDashboard, label: t('menuOverview') },
    { path: '/custos', icon: CircleDollarSign, label: t('menuCosts') },
    { path: '/mapa', icon: MapIcon, label: t('menuMap') },
    { path: '/configuracoes', icon: Settings, label: t('menuSettings') },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/');
  }

  async function handleCreateFarmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newFarmName.trim()) return;
    
    setIsCreating(true);
    try {
      await createFarm(newFarmName);
      await refreshFarms();
      setIsNewFarmModalOpen(false);
      setNewFarmName('');
    } catch (error) {
      alert("Erro ao criar fazenda.");
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.logo} title="AgroSaaS">
          <Tractor size={32} color="var(--color-primary)" />
        </div>
        
        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link key={item.path} to={item.path} className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`} title={item.label}>
                <Icon size={24} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button onClick={handleLogout} className={`${styles.navItem} ${styles.logoutButton}`} title={t('menuLogout')}>
          <LogOut size={24} />
          <span>{t('menuLogout')}</span>
        </button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h2 className={styles.headerTitle}>{t('controlPanel')}</h2>
          
          <div className={styles.headerActions}>
            {loadingFarms ? (
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('loading')}</span>
            ) : farms.length > 0 ? (
              <div style={{ width: '250px' }}>
                <CustomSelect 
                  value={activeFarmId}
                  onChange={(val) => setActiveFarmId(val)}
                  options={[
                    { value: 'all', label: t('allFarms') },
                    ...farms.map(farm => ({ value: farm.id, label: farm.name }))
                  ]}
                />
              </div>
            ) : (
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('noFarms')}</span>
            )}

            <button onClick={() => setIsNewFarmModalOpen(true)} className={styles.createButton}>
              <Plus size={16} /> {t('newBtn')}
            </button>
          </div>
        </header>
        
        <section className={styles.content}>
          {children}
        </section>
      </main>

      {/* Modal Customizado de Nova Fazenda */}
      {isNewFarmModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsNewFarmModalOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{t('newFarmTitle')}</h3>
              <button className={styles.closeBtn} onClick={() => setIsNewFarmModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleCreateFarmSubmit}>
              <div className={styles.formGroup}>
                <label>{t('newFarmNameLabel')}</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  className={styles.modalInput} 
                  placeholder={t('newFarmPlaceholder')}
                  value={newFarmName}
                  onChange={e => setNewFarmName(e.target.value)}
                />
              </div>
              
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setIsNewFarmModalOpen(false)}>{t('cancelBtn')}</button>
                <button type="submit" className={styles.btnSave} disabled={isCreating || !newFarmName.trim()}>
                  {isCreating ? t('loading') : t('createBtn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}