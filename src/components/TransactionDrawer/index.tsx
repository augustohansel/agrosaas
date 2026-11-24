import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { CustomSelect } from '../CustomSelect';
import { createTransaction, updateTransaction, type Transaction } from '../../features/transactions/services/api';
import { getPlots, type Plot } from '../../features/plots/services/api';
import { useTranslation } from '../../hooks/useTranslation';
import styles from './styles.module.css';
import { transactionCategories } from '../../features/transactions/categories';

interface TransactionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  transactionToEdit: Transaction | null;
  onSuccess: () => void;
}

const defaultFormData = {
  type: 'expense' as 'income' | 'expense',
  plot_id: 'none',
  category: 'Adubos e Fertilizantes',
  description: '',
  amount: '',
  transaction_date: new Date().toISOString().split('T')[0]
};

export function TransactionDrawer({ isOpen, onClose, farmId, transactionToEdit, onSuccess }: TransactionDrawerProps) {
  const { t, tCategory } = useTranslation();
  const [formData, setFormData] = useState(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);
  const settled = Boolean(transactionToEdit?.bill);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [isLoadingPlots, setIsLoadingPlots] = useState(false);

  useEffect(() => {
    if (isOpen && farmId) {
      async function loadPlots() {
        setIsLoadingPlots(true);
        try {
          const data = await getPlots(farmId);
          setPlots(data);
        } catch (error) {
          console.error("Erro ao carregar talhões:", error);
        } finally {
          setIsLoadingPlots(false);
        }
      }
      loadPlots();
    }
  }, [isOpen, farmId]);

  useEffect(() => {
    if (transactionToEdit) {
      setFormData({
        type: transactionToEdit.type,
        plot_id: transactionToEdit.plot_id || 'none',
        category: transactionToEdit.category,
        description: transactionToEdit.description || '',
        amount: String(transactionToEdit.amount),
        transaction_date: transactionToEdit.transaction_date
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [transactionToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        farm_id: farmId,
        plot_id: formData.plot_id === 'none' ? null : formData.plot_id,
        type: formData.type,
        category: formData.category,
        description: formData.description,
        amount: Number(formData.amount),
        transaction_date: formData.transaction_date
      };

      if (transactionToEdit) {
        await updateTransaction(transactionToEdit.id, settled ? { category: payload.category } : payload);
      } else {
        await createTransaction(payload);
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert(error && typeof error === 'object' && 'message' in error ? String(error.message) : "Erro ao salvar transação.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const categories = [...transactionCategories[formData.type]];
  if (!categories.includes(formData.category)) categories.push(formData.category);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>{transactionToEdit ? t('editEntry') : t('newEntry')}</h2>
            <p className={styles.subtitle}>
              {settled ? 'Lançamento de título liquidado. Você pode corrigir a categoria.' : transactionToEdit ? t('editEntryDesc') : t('newEntryDesc')}
            </p>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label={t('cancelBtn')}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {!settled && <>
          <div className={styles.formGroup}>
            <label htmlFor="transactiondrawer-movementType">{t('movementType')}</label>
            <CustomSelect id="transactiondrawer-movementType" 
              value={formData.type}
              onChange={(val) => setFormData({...formData, type: val as 'income'|'expense', category: val === 'income' ? 'Venda de Grãos' : 'Adubos e Fertilizantes'})}
              options={[
                { value: 'expense', label: t('expenseOpt') },
                { value: 'income', label: t('incomeOpt') }
              ]}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="transactiondrawer-areaPlotOpt">{t('areaPlotOpt')}</label>
            <CustomSelect id="transactiondrawer-areaPlotOpt" 
              value={formData.plot_id}
              onChange={(val) => setFormData({...formData, plot_id: val})}
              options={[
                { value: 'none', label: t('generalFarmOpt') },
                ...plots.map(p => ({
                  value: p.id,
                  label: p.name
                }))
              ]}
              placeholder={isLoadingPlots ? t('loading') : t('selectPlotPlaceholder')}
            />
          </div>

          </>}
          <div className={styles.formGroup}>
            <label htmlFor="transactiondrawer-categoryOpt">{t('categoryOpt')}</label>
            <CustomSelect id="transactiondrawer-categoryOpt" 
              value={formData.category}
              onChange={(val) => setFormData({...formData, category: val})}
              options={categories.map(value => ({ value, label: tCategory(value) }))}
            />
          </div>

          {!settled && <>
          <div className={styles.formGroup}>
            <label>{t('descOpt')}</label>
            <input 
              type="text" 
              className={styles.input} 
              placeholder={t('descPlaceholder')}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t('valueBRL')}</label>
            <input 
              type="number" 
              step="0.01" 
              required
              className={styles.input} 
              placeholder="0.00"
              value={formData.amount}
              onChange={e => setFormData({...formData, amount: e.target.value})}
            />
          </div>

          <div className={styles.formGroup}>
            <label>{t('dateOpt')}</label>
            <input 
              type="date" 
              required
              className={styles.input} 
              value={formData.transaction_date}
              onChange={e => setFormData({...formData, transaction_date: e.target.value})}
            />
          </div>

          </>}
          <div className={styles.actions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>{t('cancelBtn')}</button>
            <button type="submit" className={styles.btnSave} disabled={isSaving}>
              {isSaving ? t('saving') : transactionToEdit ? t('updateBtn') : t('saveBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
