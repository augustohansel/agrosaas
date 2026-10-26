import { useState, useEffect } from 'react';
import { Globe, Map as MapIcon, Settings as SettingsIcon, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { CustomSelect } from '../../components/CustomSelect';
import { useFarm } from '../../contexts/FarmContext';
import { useTranslation } from '../../hooks/useTranslation';
import { updateFarm, deleteFarm } from '../../features/farms/services/api';
import styles from './styles.module.css';

export function Configuracoes() {
  const { farms, refreshFarms } = useFarm();
  const { t, lang } = useTranslation();
  const [activeTab, setActiveTab] = useState<'preferences' | 'farms'>('preferences');

  const [language, setLanguage] = useState('pt');
  const [currency, setCurrency] = useState('BRL');
  const [areaUnit, setAreaUnit] = useState('ha');

  // Estados para o modal de exclusão da Fazenda
  const [farmToDelete, setFarmToDelete] = useState<{ id: string, name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para o modal de edição da Fazenda
  const [farmToEdit, setFarmToEdit] = useState<{ id: string, name: string } | null>(null);
  const [newFarmName, setNewFarmName] = useState('');
  const [isEditingFarm, setIsEditingFarm] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('@AgroSaaS:language');
    const savedCurr = localStorage.getItem('@AgroSaaS:currency');
    const savedArea = localStorage.getItem('@AgroSaaS:areaUnit');

    if (savedLang) setLanguage(savedLang);
    if (savedCurr) setCurrency(savedCurr);
    if (savedArea) setAreaUnit(savedArea);
  }, []);

  const handlePreferenceChange = (key: string, value: string, setter: (v: string) => void) => {
    setter(value);
    localStorage.setItem(`@AgroSaaS:${key}`, value);
    window.dispatchEvent(new Event(`${key}Changed`));
  };

  const handleOpenEditFarm = (farmId: string, currentName: string) => {
    setFarmToEdit({ id: farmId, name: currentName });
    setNewFarmName(currentName);
  };

  const confirmEditFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmToEdit || !newFarmName.trim() || newFarmName === farmToEdit.name) {
      setFarmToEdit(null);
      return;
    }
    
    setIsEditingFarm(true);
    try {
      await updateFarm(farmToEdit.id, newFarmName);
      await refreshFarms();
    } catch (error) {
      console.error(error);
      alert(t('errorApi'));
    } finally {
      setIsEditingFarm(false);
      setFarmToEdit(null);
    }
  };

  const handleOpenDeleteFarm = (farmId: string, name: string) => {
    setFarmToDelete({ id: farmId, name });
  };

  const confirmDeleteFarm = async () => {
    if (!farmToDelete) return;
    setIsDeleting(true);
    try {
      await deleteFarm(farmToDelete.id);
      await refreshFarms();
    } catch (error) {
      console.error(error);
      alert(t('errorApi'));
    } finally {
      setIsDeleting(false);
      setFarmToDelete(null);
    }
  };

  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR';

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>{t('menuSettings')}</h1>
            <p className={styles.description}>{t('settingsDesc')}</p>
          </div>
        </div>

        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'preferences' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <SettingsIcon size={18} />
            {t('globalPrefs')}
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'farms' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('farms')}
          >
            <MapIcon size={18} />
            {t('farmMgmt')}
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'preferences' ? (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>{t('locFormatting')}</h2>
              <p className={styles.cardDescription}>{t('locDesc')}</p>
              
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>{t('langLabel')}</label>
                  <CustomSelect 
                    value={language}
                    onChange={(val) => handlePreferenceChange('language', val, setLanguage)}
                    options={[
                      { value: 'pt', label: 'Português (BR)' },
                      { value: 'en', label: 'English (US)' },
                      { value: 'es', label: 'Español (ES)' }
                    ]}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>{t('currencyLabel')}</label>
                  <CustomSelect 
                    value={currency}
                    onChange={(val) => handlePreferenceChange('currency', val, setCurrency)}
                    options={[
                      { value: 'BRL', label: 'Real (R$)' },
                      { value: 'USD', label: 'Dólar (US$)' }
                    ]}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>{t('areaLabel')}</label>
                  <CustomSelect 
                    value={areaUnit}
                    onChange={(val) => handlePreferenceChange('areaUnit', val, setAreaUnit)}
                    options={[
                      { value: 'ha', label: 'Hectares (ha)' },
                      { value: 'acre', label: 'Acres (ac)' }
                    ]}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>{t('registeredFarms')}</h2>
              <p className={styles.cardDescription}>{t('farmListDesc')}</p>
              
              <div className={styles.farmList}>
                {farms.length === 0 ? (
                  <p className={styles.emptyMessage}>{t('noFarmsFound')}</p>
                ) : (
                  farms.map(farm => (
                    <div key={farm.id} className={styles.farmItem}>
                      <div className={styles.farmInfo}>
                        <div className={styles.farmIcon}>
                          <Globe size={20} />
                        </div>
                        <div>
                          <span className={styles.farmName}>{farm.name}</span>
                          <span className={styles.farmDate}>{t('createdAt')} {new Date(farm.created_at).toLocaleDateString(locale)}</span>
                        </div>
                      </div>
                      
                      <div className={styles.farmActions}>
                        <button onClick={() => handleOpenEditFarm(farm.id, farm.name)} className={styles.btnEdit} title={t('renameFarm')}>
                          <Pencil size={18} />
                        </button>
                        <button onClick={() => handleOpenDeleteFarm(farm.id, farm.name)} className={styles.btnDelete} title={t('deleteFarm')}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal de Confirmação de Exclusão da Fazenda */}
        {farmToDelete && (
          <div className={styles.modalOverlay} onClick={() => setFarmToDelete(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--color-danger)' }}>
                <AlertTriangle size={24} />
                <h3 className={styles.modalTitle} style={{ margin: 0 }}>{t('deleteFarm')}</h3>
              </div>
              <p className={styles.modalText}>
                {t('confirmDel1')}<strong>{farmToDelete.name}</strong>{t('confirmDel2')}
              </p>
              <div className={styles.modalActions}>
                <button className={styles.btnCancel} onClick={() => setFarmToDelete(null)} disabled={isDeleting}>
                  {t('cancelBtn')}
                </button>
                <button className={styles.btnDeleteConfirm} onClick={confirmDeleteFarm} disabled={isDeleting}>
                  {isDeleting ? 'A excluir...' : 'Sim, excluir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edição de Fazenda */}
        {farmToEdit && (
          <div className={styles.modalOverlay} onClick={() => setFarmToEdit(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>
                <Pencil size={24} />
                <h3 className={styles.modalTitle} style={{ margin: 0 }}>{t('renameFarm')}</h3>
              </div>
              <form onSubmit={confirmEditFarm}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--color-text-main)' }}>{t('renamePrompt')}</label>
                  <input
                    type="text"
                    autoFocus
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e4e4e7', fontSize: '0.875rem', outline: 'none' }}
                    value={newFarmName}
                    onChange={e => setNewFarmName(e.target.value)}
                    onFocus={e => e.target.select()}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.btnCancel} onClick={() => setFarmToEdit(null)} disabled={isEditingFarm}>
                    {t('cancelBtn')}
                  </button>
                  <button type="submit" className={styles.btnSave} disabled={isEditingFarm || !newFarmName.trim()}>
                    {isEditingFarm ? t('saving') : 'Guardar Nome'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}