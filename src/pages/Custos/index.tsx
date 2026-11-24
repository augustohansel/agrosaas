import { useState, useEffect, useCallback } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, ArrowLeft, ArrowRight, Pencil, Trash2, Download, AlertTriangle } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { TransactionDrawer } from '../../components/TransactionDrawer';
import { useFarm } from '../../contexts/FarmContext';
import { getTransactions, deleteTransaction, type Transaction } from '../../features/transactions/services/api';
import { useTranslation } from '../../hooks/useTranslation';
import { issueMessage, useResource } from '../../shared/erpData';
import styles from './styles.module.css';

const emptyFilters = { type: '', category: '', plot: '', from: '', until: '' };

export function Custos() {
  const { activeFarmId } = useFarm();
  return <Ledger key={activeFarmId} />;
}

function Ledger() {
  const { activeFarmId, farms } = useFarm();
  const { t, tCategory, lang } = useTranslation();
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  
  // Estado para o modal de exclusão
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [filters, setFilters] = useState(emptyFilters);
  const [requestedPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  const activeFarm = farms.find(f => f.id === activeFarmId);
  const writableFarms = new Set(farms.filter(f => ['owner', 'manager', 'editor'].includes(f.role ?? '')).map(f => f.id));
  const [failure, report] = useState('');

  const [currency, setCurrency] = useState(localStorage.getItem('@AgroSaaS:currency') || 'BRL');

  useEffect(() => {
    const handleCurrencyChange = () => setCurrency(localStorage.getItem('@AgroSaaS:currency') || 'BRL');
    window.addEventListener('currencyChanged', handleCurrencyChange);
    return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
  }, []);

  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR';
  const formatCurrency = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  const formatDate = (dateString: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString + 'T12:00:00Z'));

  const scope = farms.map(f => f.id).join(',');
  const { data, error: loadError, reload: loadTransactions } = useResource(useCallback(
    (signal: AbortSignal) => activeFarmId
      ? getTransactions(activeFarmId, undefined, scope.split(','), signal)
      : Promise.resolve([] as Transaction[]),
    [activeFarmId, scope],
  ));
  const allRows = data ?? [];
  const categories = [...new Set(allRows.filter(row => !filters.type || row.type === filters.type).map(row => row.category))];
  const farmNames = new Map(farms.map(f => [f.id, f.name]));
  const areaLabel = (row: Transaction) => [row.plots?.name || t('generalFarm'), activeFarmId === 'all' && farmNames.get(row.farm_id)].filter(Boolean).join(' · ');
  const plots = new Map(allRows.map(row => [row.plot_id || 'general', row.plot_id ? areaLabel(row) : t('generalFarm')]));
  const transactions = allRows.filter(row =>
    (!filters.type || row.type === filters.type) &&
    (!filters.category || row.category === filters.category) &&
    (!filters.plot || (row.plot_id || 'general') === filters.plot) &&
    (!filters.from || row.transaction_date >= filters.from) &&
    (!filters.until || row.transaction_date <= filters.until)
  );
  const updateFilter = (field: keyof typeof filters, value: string) => {
    setFilters(previous => ({ ...previous, ...(field === 'type' ? { category: '' } : {}), [field]: value }));
    setCurrentPage(1);
  };
  const handleOpenCreate = () => {
    setTransactionToEdit(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setIsDrawerOpen(true);
  };

  // Abre o modal
  const handleOpenDelete = (id: string) => {
    report('');
    setTransactionToDelete(id);
  };

  // Executa a exclusão
  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTransaction(transactionToDelete);
      loadTransactions();
    } catch (error) {
      report(issueMessage(error));
    } finally {
      setIsDeleting(false);
      setTransactionToDelete(null);
    }
  };

  // Função para Exportar para CSV
  const handleExportCSV = () => {
    if (transactions.length === 0) return;

    const headers = [t('date'), t('description'), t('areaPlot'), t('category'), t('type'), t('value')];
    
    const csvRows = transactions.map(tItem => {
      const data = tItem.transaction_date;
      const desc = tItem.description || '-';
      const plot = areaLabel(tItem);
      const cat = tCategory(tItem.category);
      const type = tItem.type === 'income' ? t('incomeType') : t('expenseType');
      
      const val = lang === 'en' ? tItem.amount.toString() : tItem.amount.toString().replace('.', ','); 

      return [data, desc, plot, cat, type, val];
    });

    const csvContent = [headers, ...csvRows].map(row => row.map(cell => '"' + cell.replace(/"/g, '""') + '"').join(';')).join('\n');
    
    const blob = new Blob(["\ufeff", csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const fileNameDate = new Date().toISOString().split('T')[0];
    const farmName = activeFarmId === 'all' ? 'Todas_Fazendas' : (activeFarm?.name || 'Fazenda').replace(/\s+/g, '_');
    link.setAttribute('download', `Relatorio_${farmName}_${fileNameDate}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const currentPage = Math.min(requestedPage, Math.max(1, totalPages));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTransactions = transactions.slice(startIndex, startIndex + itemsPerPage);

  return (
    <Layout>
      <div className={styles.container}>
        <div className={`page-heading ${styles.header}`}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>{t('entries')}</h1>
            <p className={styles.description}>
              {activeFarmId === 'all' ? t('finMgmtDescAll') : `${t('finMgmtDescSingle')} ${activeFarm?.name || ''}.`}
            </p>
          </div>
          
          <div className={styles.toolbar}>
            {transactions.length > 0 && (
              <button 
                className={styles.exportButton}
                onClick={handleExportCSV}
              >
                <Download size={20} /> {t('exportCSV')}
              </button>
            )}

            {writableFarms.has(activeFarmId) && (
              <button className={styles.addButton} onClick={handleOpenCreate}>
                <Plus size={20} /> {t('addRecord')}
              </button>
            )}
          </div>
        </div>

        {failure && <p role="alert">{failure}</p>}
        <div className={styles.filters}>
          <label>{t('type')}<select aria-label={t('type')} value={filters.type} onChange={e => updateFilter('type', e.target.value)}>
            <option value="">{t('allTypes')}</option><option value="income">{t('incomeType')}</option><option value="expense">{t('expenseType')}</option>
          </select></label>
          <label>{t('category')}<select aria-label={t('category')} value={filters.category} onChange={e => updateFilter('category', e.target.value)}>
            <option value="">{t('allCategories')}</option>{[...new Set([...categories, ...(filters.category ? [filters.category] : [])])].sort((a,b) => tCategory(a).localeCompare(tCategory(b),locale)).map(c => <option key={c} value={c}>{tCategory(c)}</option>)}
          </select></label>
          <label>{t('areaPlot')}<select aria-label={t('areaPlot')} value={filters.plot} onChange={e => updateFilter('plot', e.target.value)}>
            <option value="">{t('allPlotsFilter')}</option>{[...plots].sort((a,b) => a[1].localeCompare(b[1],locale)).map(([id,name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          <label>{t('filterFrom')}<input type="date" max={filters.until || undefined} value={filters.from} onChange={e => updateFilter('from', e.target.value)} /></label>
          <label>{t('filterUntil')}<input type="date" min={filters.from || undefined} value={filters.until} onChange={e => updateFilter('until', e.target.value)} /></label>
          <button type="button" disabled={!Object.values(filters).some(Boolean)} onClick={() => { setFilters(emptyFilters); setCurrentPage(1); }}>{t('clearFilters')}</button>
        </div>
        {data && <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}><span className={styles.summaryCardTitle}>{t('overview')}</span><strong>{transactions.length} {t('records')}</strong></div>
          {(['income','expense'] as const).map(type => <div className={styles.summaryCard} key={type}>
            <span className={styles.summaryCardTitle}>{t(type === 'income' ? 'incomes' : 'expenses')}</span>
            <strong>{formatCurrency(transactions.filter(row => row.type === type).reduce((total,row) => total + Number(row.amount),0))}</strong>
          </div>)}
        </div>}
        {loadError ? <p role="alert">{loadError} <button onClick={loadTransactions}>{t('retryFilter')}</button></p> : !data ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t('loadingRecords')}</p>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('description')}</th>
                  <th>{t('areaPlot')}</th>
                  <th>{t('category')}</th>
                  <th>{t('type')}</th>
                  <th>{t('value')}</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {currentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                      {t('noMovements')}
                    </td>
                  </tr>
                ) : (
                  currentTransactions.map((tItem) => (
                    <tr key={tItem.id}>
                      <td style={{ color: 'var(--color-text-muted)' }}>{formatDate(tItem.transaction_date)}</td>
                      <td style={{ fontWeight: 500 }}>{tItem.description || '-'}</td>
                      <td>
                        {tItem.plots?.name ? (
                          <span className={styles.plotTag}>
                            {areaLabel(tItem)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{areaLabel(tItem)}</span>
                        )}
                      </td>
                      <td>{tCategory(tItem.category)}</td>
                      <td>
                        {tItem.type === 'income' ? (
                          <span className={styles.badgeIncome}><ArrowUpRight size={16} /> {t('incomeType')}</span>
                        ) : (
                          <span className={styles.badgeExpense}><ArrowDownLeft size={16} /> {t('expenseType')}</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(Number(tItem.amount))}</td>
                      <td>
                        {writableFarms.has(tItem.farm_id) && <div className={styles.actionButtons} style={{ justifyContent: 'flex-end' }}>
                          <button aria-label="Editar lançamento" className={`${styles.btnAction} ${styles.btnEdit}`} onClick={() => handleOpenEdit(tItem)}>
                            <Pencil size={18} />
                          </button>
                          {!tItem.bill && <button aria-label="Excluir lançamento" className={`${styles.btnAction} ${styles.btnDelete}`} onClick={() => handleOpenDelete(tItem.id)}>
                            <Trash2 size={18} />
                          </button>}
                        </div>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {totalPages > 1 && (
              <div className={styles.tableFooter}>
                <button 
                  className={styles.paginationButton} 
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ArrowLeft size={16} /> {t('prev')}
                </button>
                <div className={styles.paginationPages}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button type="button" key={page} aria-current={currentPage === page ? 'page' : undefined} className={`${styles.pageNumber} ${currentPage === page ? styles.pageNumberActive : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
                  ))}
                </div>
                <button 
                  className={styles.paginationButton} 
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  {t('next')} <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {isDrawerOpen && writableFarms.has(transactionToEdit?.farm_id ?? activeFarmId) && (
          <TransactionDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} farmId={transactionToEdit?.farm_id ?? activeFarmId} transactionToEdit={transactionToEdit} onSuccess={loadTransactions} />
        )}

        {/* Modal de Confirmação de Exclusão */}
        {transactionToDelete && (
          <div className={styles.modalOverlay} onClick={() => setTransactionToDelete(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--color-danger)' }}>
                <AlertTriangle size={24} />
                <h3 className={styles.modalTitle} style={{ margin: 0 }}>Excluir Movimentação</h3>
              </div>
              <p className={styles.modalText}>
                Tem a certeza que deseja excluir este registo? Esta ação é permanente e irá recalcular o balanço da fazenda.
              </p>
              <div className={styles.modalActions}>
                <button className={styles.btnCancel} onClick={() => setTransactionToDelete(null)} disabled={isDeleting}>
                  {t('cancelBtn')}
                </button>
                <button className={styles.btnDeleteConfirm} onClick={confirmDelete} disabled={isDeleting}>
                  {isDeleting ? 'A excluir...' : 'Sim, excluir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
