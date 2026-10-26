import { useState, useEffect, useCallback } from 'react';
import { ArrowDownLeft, ArrowUpRight, Plus, ArrowLeft, ArrowRight, Pencil, Trash2, Download, AlertTriangle } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { TransactionDrawer } from '../../components/TransactionDrawer';
import { useFarm } from '../../contexts/FarmContext';
import { getTransactions, deleteTransaction, type Transaction } from '../../features/transactions/services/api';
import { useTranslation } from '../../hooks/useTranslation';
import styles from './styles.module.css';

export function Custos() {
  const { activeFarmId, farms } = useFarm();
  const { t, tCategory, lang } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  
  // Estado para o modal de exclusão
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [activeCategory, setActiveCategory] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  const activeFarm = farms.find(f => f.id === activeFarmId);

  const [currency, setCurrency] = useState(localStorage.getItem('@AgroSaaS:currency') || 'BRL');

  useEffect(() => {
    const handleCurrencyChange = () => setCurrency(localStorage.getItem('@AgroSaaS:currency') || 'BRL');
    window.addEventListener('currencyChanged', handleCurrencyChange);
    return () => window.removeEventListener('currencyChanged', handleCurrencyChange);
  }, []);

  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR';
  const formatCurrency = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  const formatDate = (dateString: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString + 'T12:00:00Z'));

  const loadTransactions = useCallback(async () => {
    if (!activeFarmId) return;
    setIsLoading(true);
    try {
      const allFarmIds = farms.map(f => f.id);
      const data = await getTransactions(activeFarmId, activeCategory, allFarmIds);
      setTransactions(data);
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeFarmId, activeCategory, farms]);

  useEffect(() => {
    loadTransactions();
    setCurrentPage(1);
  }, [loadTransactions]);

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
      console.error("Erro ao excluir:", error);
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
      const desc = (tItem.description || '-').replace(/"/g, '""');
      const plot = tItem.plots?.name ? tItem.plots.name : t('generalFarm');
      const cat = tCategory(tItem.category);
      const type = tItem.type === 'income' ? t('incomeType') : t('expenseType');
      
      const val = lang === 'en' ? tItem.amount.toString() : tItem.amount.toString().replace('.', ','); 

      return `"${data}","${desc}","${plot}","${cat}","${type}","${val}"`;
    });

    const csvContent = [headers.map(h => `"${h}"`).join(';'), ...csvRows.map(row => row.replace(/,/g, ';'))].join('\n');
    
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

  const expensesByCategory = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentTransactions = transactions.slice(startIndex, startIndex + itemsPerPage);

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>{t('finMgmtTitle')}</h1>
            <p className={styles.description}>
              {activeFarmId === 'all' ? t('finMgmtDescAll') : `${t('finMgmtDescSingle')} ${activeFarm?.name || ''}.`}
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {transactions.length > 0 && (
              <button 
                className={styles.addButton} 
                style={{ backgroundColor: 'transparent', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' }} 
                onClick={handleExportCSV}
              >
                <Download size={20} /> {t('exportCSV')}
              </button>
            )}

            {activeFarmId !== 'all' && activeFarmId && (
              <button className={styles.addButton} onClick={handleOpenCreate}>
                <Plus size={20} /> {t('addRecord')}
              </button>
            )}
          </div>
        </div>

        {transactions.length > 0 && (
          <div className={styles.summaryGrid}>
            <div className={`${styles.summaryCard} ${activeCategory === 'all' ? styles.summaryCardActive : ''}`} onClick={() => setActiveCategory('all')}>
              <div className={styles.summaryCardTitle}>{t('overview')}</div>
              <div className={styles.summaryCardValueNeutral}>{transactions.length} {t('records')}</div>
            </div>
            {Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).map(([category, total]) => (
              <div key={category} className={`${styles.summaryCard} ${activeCategory === category ? styles.summaryCardActive : ''}`} onClick={() => setActiveCategory(category)}>
                <div className={styles.summaryCardTitle}>{tCategory(category)}</div>
                <div className={styles.summaryCardValue}>{formatCurrency(total)}</div>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
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
                          <span style={{ backgroundColor: 'var(--color-surface)', border: '1px solid #e4e4e7', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}>
                            {tItem.plots.name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{t('generalFarm')}</span>
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
                        <div className={styles.actionButtons} style={{ justifyContent: 'flex-end' }}>
                          <button className={`${styles.btnAction} ${styles.btnEdit}`} onClick={() => handleOpenEdit(tItem)}>
                            <Pencil size={18} />
                          </button>
                          <button className={`${styles.btnAction} ${styles.btnDelete}`} onClick={() => handleOpenDelete(tItem.id)}>
                            <Trash2 size={18} />
                          </button>
                        </div>
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
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ArrowLeft size={16} /> {t('prev')}
                </button>
                <div className={styles.paginationPages}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <span key={page} className={`${styles.pageNumber} ${currentPage === page ? styles.pageNumberActive : ''}`} onClick={() => setCurrentPage(page)}>{page}</span>
                  ))}
                </div>
                <button 
                  className={styles.paginationButton} 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  {t('next')} <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {activeFarmId && activeFarmId !== 'all' && (
          <TransactionDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} farmId={activeFarmId} transactionToEdit={transactionToEdit} onSuccess={loadTransactions} />
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