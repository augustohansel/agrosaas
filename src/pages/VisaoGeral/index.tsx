import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar, LineChart, Line } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, FileText, Map as MapIcon, Plus, X, Settings2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw';

import { Layout } from '../../components/Layout';
import { useFarm } from '../../contexts/FarmContext';
import { supabase } from '../../services/supabase';
import { getPlots, type Plot } from '../../features/plots/services/api';
import { CustomSelect } from '../../components/CustomSelect';
import { useTranslation } from '../../hooks/useTranslation';
import styles from './styles.module.css';

const PIE_COLORS = ['#16a34a', '#84cc16', '#eab308', '#f97316', '#14b8a6', '#06b6d4', '#f59e0b'];

function getAreaValue(coordinates: any[], unit: string) {
  if (!coordinates || coordinates.length < 3) return 0;
  try {
    const areaSqMeters = L.GeometryUtil.geodesicArea(coordinates);
    let area = areaSqMeters / 10000;
    if (unit === 'acre') area = area * 2.47105;
    return Number(area.toFixed(2));
  } catch (error) {
    return 0;
  }
}

export function VisaoGeral() {
  const { activeFarmId, farms } = useFarm();
  const { t, tCategory, lang } = useTranslation();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const [currency, setCurrency] = useState(localStorage.getItem('@AgroSaaS:currency') || 'BRL');
  const [areaUnit, setAreaUnit] = useState(localStorage.getItem('@AgroSaaS:areaUnit') || 'ha');

  // Estados para o Gráfico Personalizado
  const [showCustomChart, setShowCustomChart] = useState(false);
  const [customChartConf, setCustomChartConf] = useState(() => {
    const saved = localStorage.getItem('@AgroSaaS:customChart');
    return saved ? JSON.parse(saved) : { metric: 'expense', dimension: 'category', type: 'bar' };
  });

  useEffect(() => {
    const handleCurrencyChange = () => setCurrency(localStorage.getItem('@AgroSaaS:currency') || 'BRL');
    const handleAreaChange = () => setAreaUnit(localStorage.getItem('@AgroSaaS:areaUnit') || 'ha');
    
    window.addEventListener('currencyChanged', handleCurrencyChange);
    window.addEventListener('areaUnitChanged', handleAreaChange);
    return () => {
      window.removeEventListener('currencyChanged', handleCurrencyChange);
      window.removeEventListener('areaUnitChanged', handleAreaChange);
    };
  }, []);

  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'pt-BR';
  const areaLabel = areaUnit === 'acre' ? 'ac' : 'ha';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  };

  useEffect(() => {
    async function fetchDashboardData() {
      if (!activeFarmId) return;
      setIsLoading(true);
      try {
        const allFarmIds = farms.map(f => f.id);
        
        let transQuery = supabase.from('transactions').select('*, plots(name)').order('transaction_date', { ascending: true });
        if (activeFarmId === 'all') {
          transQuery = transQuery.in('farm_id', allFarmIds);
        } else {
          transQuery = transQuery.eq('farm_id', activeFarmId);
        }

        const { data: transData, error: transError } = await transQuery;
        if (transError) throw transError;
        setTransactions(transData || []);

        const plotsData = await getPlots(activeFarmId, allFarmIds);
        setPlots(plotsData || []);

      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
    setSelectedMonth('all');
  }, [activeFarmId]);

  const availableMonths = Array.from(new Set(transactions.map(tItem => tItem.transaction_date.substring(0, 7)))).sort().reverse();

  const filteredTransactions = selectedMonth === 'all' 
    ? transactions 
    : transactions.filter(tItem => tItem.transaction_date.startsWith(selectedMonth));

  const formatMonthName = (yyyyMM: string) => {
    const [year, month] = yyyyMM.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    const monthStr = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
    return `${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)} ${year}`;
  };

  const totalIncome = filteredTransactions.filter(tItem => tItem.type === 'income').reduce((acc, tItem) => acc + Number(tItem.amount), 0);
  const totalExpense = filteredTransactions.filter(tItem => tItem.type === 'expense').reduce((acc, tItem) => acc + Number(tItem.amount), 0);
  const balance = totalIncome - totalExpense;
  const transactionCount = filteredTransactions.length;

  const totalMappedArea = plots.reduce((acc, plot) => acc + getAreaValue(plot.coordinates, areaUnit), 0);
  const costPerArea = totalMappedArea > 0 ? totalExpense / totalMappedArea : 0;

  // 1. DADOS: GRÁFICOS ORIGINAIS
  const expensesByCategory = filteredTransactions.filter(tItem => tItem.type === 'expense').reduce((acc, tItem) => {
    acc[tItem.category] = (acc[tItem.category] || 0) + Number(tItem.amount);
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.keys(expensesByCategory).map(key => ({ name: tCategory(key), value: expensesByCategory[key] })).sort((a, b) => b.value - a.value);

  const chartDataMap = filteredTransactions.reduce((acc, tItem) => {
    const date = new Date(tItem.transaction_date + 'T12:00:00Z');
    let keyName = selectedMonth === 'all' 
      ? new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)
      : new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(date);

    if (!acc[keyName]) acc[keyName] = { name: keyName, Receitas: 0, Despesas: 0 };
    if (tItem.type === 'income') acc[keyName].Receitas += Number(tItem.amount);
    else if (tItem.type === 'expense') acc[keyName].Despesas += Number(tItem.amount);

    return acc;
  }, {} as Record<string, { name: string, Receitas: number, Despesas: number }>);

  const areaData = Object.values(chartDataMap);

  const plotStats = filteredTransactions.reduce((acc, tItem) => {
    if (!tItem.plot_id || !tItem.plots?.name) return acc;

    const plotName = tItem.plots.name;
    if (!acc[plotName]) {
      const plotDef = plots.find(p => p.id === tItem.plot_id);
      const pArea = plotDef ? getAreaValue(plotDef.coordinates, areaUnit) : 0;
      acc[plotName] = { name: plotName, Receitas: 0, Despesas: 0, area: pArea };
    }

    const amount = Number(tItem.amount);
    if (tItem.type === 'income') acc[plotName].Receitas += amount;
    else acc[plotName].Despesas += amount;

    return acc;
  }, {} as Record<string, { name: string, Receitas: number, Despesas: number, area: number }>);

  const plotChartData = Object.values(plotStats);

  // 2. DADOS: GRÁFICO PERSONALIZADO
  const customDataAggregator = filteredTransactions.reduce((acc, tItem) => {
    let key = '';
    if (customChartConf.dimension === 'category') key = tCategory(tItem.category);
    else if (customChartConf.dimension === 'plot') key = tItem.plots?.name || t('generalFarm');
    else if (customChartConf.dimension === 'month') key = formatMonthName(tItem.transaction_date.substring(0, 7));

    if (!acc[key]) acc[key] = { name: key, income: 0, expense: 0, value: 0 };
    
    const amt = Number(tItem.amount);
    if (tItem.type === 'income') acc[key].income += amt;
    if (tItem.type === 'expense') acc[key].expense += amt;

    if (customChartConf.metric === 'income') acc[key].value = acc[key].income;
    else if (customChartConf.metric === 'expense') acc[key].value = acc[key].expense;
    else if (customChartConf.metric === 'balance') acc[key].value = acc[key].income - acc[key].expense;
    
    return acc;
  }, {} as Record<string, any>);
  
  let customChartData = Object.values(customDataAggregator).filter((d: any) => d.value !== 0);

  const updateCustomChart = (key: string, val: string) => {
    const newConf = { ...customChartConf, [key]: val };
    setCustomChartConf(newConf);
    localStorage.setItem('@AgroSaaS:customChart', JSON.stringify(newConf));
  };


  const CustomPlotTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const despesaArea = data.area > 0 ? data.Despesas / data.area : 0;
      const receitaArea = data.area > 0 ? data.Receitas / data.area : 0;

      return (
        <div style={{ backgroundColor: 'var(--color-surface)', padding: '1rem', border: '1px solid #e4e4e7', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.75rem', borderBottom: '1px solid #e4e4e7', paddingBottom: '0.5rem' }}>
            {label} <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>({data.area} {areaLabel})</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <p style={{ color: 'var(--color-success)', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span>{t('incomes')}:</span> 
              <strong>{formatCurrency(data.Receitas)} <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({formatCurrency(receitaArea)}/{areaLabel})</span></strong>
            </p>
            <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <span>{t('expenses')}:</span> 
              <strong>{formatCurrency(data.Despesas)} <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>({formatCurrency(despesaArea)}/{areaLabel})</span></strong>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t('dashboardTitle')}</h1>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              onClick={() => setShowCustomChart(!showCustomChart)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                backgroundColor: showCustomChart ? 'transparent' : 'var(--color-primary)',
                color: showCustomChart ? 'var(--color-text-main)' : 'white',
                border: showCustomChart ? '1px solid #e4e4e7' : 'none',
                padding: '0.625rem 1rem', borderRadius: '6px', cursor: 'pointer',
                fontWeight: 500, fontSize: '0.875rem'
              }}
            >
              {showCustomChart ? <X size={16} /> : <Plus size={16} />}
              {showCustomChart ? 'Fechar Gráfico' : 'Criar Gráfico'}
            </button>
            
            <div style={{ width: '200px' }}>
              <CustomSelect 
                value={selectedMonth}
                onChange={(val) => setSelectedMonth(val)}
                options={[
                  { value: 'all', label: t('allPeriod') },
                  ...availableMonths.map(month => ({
                    value: month,
                    label: formatMonthName(month)
                  }))
                ]}
              />
            </div>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.iconWrapper} style={{ backgroundColor: '#e0e7ff', color: '#3b36db' }}><Wallet size={24} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{formatCurrency(balance)}</span>
              <span className={styles.statLabel}>{t('currentBalance')}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.iconWrapper} style={{ backgroundColor: '#dcfce7', color: '#10b981' }}><TrendingUp size={24} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{formatCurrency(totalIncome)}</span>
              <span className={styles.statLabel}>{t('incomes')}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.iconWrapper} style={{ backgroundColor: '#fce7f3', color: '#ec4899' }}><TrendingDown size={24} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{formatCurrency(totalExpense)}</span>
              <span className={styles.statLabel}>{t('expenses')}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.iconWrapper} style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}><MapIcon size={24} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{formatCurrency(costPerArea)}</span>
              <span className={styles.statLabel}>{t('avgCostPerArea')} / {areaLabel}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.iconWrapper} style={{ backgroundColor: '#f3e8ff', color: '#8b5cf6' }}><FileText size={24} /></div>
            <div className={styles.statInfo}>
              <span className={styles.statValue}>{transactionCount}</span>
              <span className={styles.statLabel}>{t('entries')}</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <p style={{ marginTop: '2rem', color: 'var(--color-text-muted)' }}>{t('loadingReports')}</p>
        ) : (
          <>
            <div className={styles.chartsGrid}>
              <div className={styles.chartCard}>
                <h2 className={styles.chartTitle}>{selectedMonth === 'all' ? t('balanceMonthly') : t('balanceDaily')}</h2>
                <div className={styles.chartContainer}>
                  {areaData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={areaData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#a3aed0'}} />
                        <YAxis width={90} axisLine={false} tickLine={false} tick={{fill: '#a3aed0'}} tickFormatter={(val) => `${currency === 'USD' ? '$' : 'R$'} ${val/1000}k`} />
                        <Tooltip formatter={(value: any, name: any) => [formatCurrency(Number(value || 0)), name === 'Receitas' ? t('incomes') : t('expenses')]} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                        <Area type="monotone" dataKey="Despesas" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDespesas)" />
                        <Area type="monotone" dataKey="Receitas" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#colorReceitas)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>{t('noData')}</div>
                  )}
                </div>
              </div>

              <div className={styles.chartCard}>
                <h2 className={styles.chartTitle}>{selectedMonth === 'all' ? t('expensesGeneral') : `${t('expenses')} (${formatMonthName(selectedMonth)})`}</h2>
                <div className={styles.chartContainer}>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: any) => [formatCurrency(Number(value || 0)), t('value')]} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                        <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingTop: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>{t('noExpenses')}</div>
                  )}
                </div>
              </div>
            </div>

            {plotChartData.length > 0 && (
              <div className={styles.chartCard} style={{ marginTop: '1.5rem' }}>
                <h2 className={styles.chartTitle}>{t('perfByPlot')}</h2>
                <div style={{ width: '100%', height: 350, marginTop: '1rem' }}>
                  <ResponsiveContainer>
                    <BarChart data={plotChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} tickFormatter={(value) => `${currency === 'USD' ? '$' : 'R$'} ${value / 1000}k`} />
                      <Tooltip content={<CustomPlotTooltip />} cursor={{ fill: '#f4f4f5' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} formatter={(val) => val === 'Receitas' ? t('incomes') : t('expenses')} />
                      <Bar dataKey="Receitas" fill="var(--color-success, #16a34a)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                      <Bar dataKey="Despesas" fill="var(--color-danger, #dc2626)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* SECÇÃO CONDICIONAL DO GRÁFICO PERSONALIZADO */}
            {showCustomChart && (
              <div className={styles.chartCard} style={{ marginTop: '1.5rem', border: '2px dashed #e4e4e7' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
                  <h2 className={styles.chartTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <Settings2 size={20} color="var(--color-primary)" /> {t('customChart')}
                  </h2>
                  
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ width: '180px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: '0.5rem' }}>{t('metric')}</label>
                      <CustomSelect 
                        value={customChartConf.metric} 
                        onChange={val => updateCustomChart('metric', val)}
                        options={[
                          { value: 'expense', label: t('metricExpense') },
                          { value: 'income', label: t('metricIncome') },
                          { value: 'balance', label: t('metricBalance') }
                        ]}
                      />
                    </div>
                    <div style={{ width: '180px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: '0.5rem' }}>{t('dimension')}</label>
                      <CustomSelect 
                        value={customChartConf.dimension} 
                        onChange={val => updateCustomChart('dimension', val)}
                        options={[
                          { value: 'category', label: t('dimCategory') },
                          { value: 'plot', label: t('dimPlot') },
                          { value: 'month', label: t('dimMonth') }
                        ]}
                      />
                    </div>
                    <div style={{ width: '180px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: '0.5rem' }}>{t('format')}</label>
                      <CustomSelect 
                        value={customChartConf.type} 
                        onChange={val => updateCustomChart('type', val)}
                        options={[
                          { value: 'bar', label: t('fmtBar') },
                          { value: 'line', label: t('fmtLine') },
                          { value: 'pie', label: t('fmtPie') }
                        ]}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ width: '100%', height: 350, display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  {customChartData.length === 0 ? (
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>{t('noData')}</div>
                  ) : customChartConf.type === 'pie' ? (
                    <>
                      {customChartData.filter((d: any) => d.value > 0).length > 0 && (
                        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <h3 style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-success)', margin: 0 }}>Positivo</h3>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={customChartData.filter((d: any) => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                                {customChartData.filter((d: any) => d.value > 0).map((_: any, idx: number) => <Cell key={`pos-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), t('value')]} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {customChartData.filter((d: any) => d.value < 0).length > 0 && (
                        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                          <h3 style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-danger)', margin: 0 }}>Negativo</h3>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={customChartData.filter((d: any) => d.value < 0).map((d: any) => ({ ...d, absValue: Math.abs(d.value) }))} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={5} dataKey="absValue" stroke="none">
                                {customChartData.filter((d: any) => d.value < 0).map((_: any, idx: number) => <Cell key={`neg-${idx}`} fill={PIE_COLORS[(idx + 3) % PIE_COLORS.length]} />)}
                              </Pie>
                              <Tooltip formatter={(val: any) => [formatCurrency(Number(val) * -1), t('value')]} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  ) : customChartConf.type === 'line' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={customChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} tickFormatter={(val) => `${currency === 'USD' ? '$' : 'R$'} ${val/1000}k`} />
                        <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), t('value')]} cursor={{ fill: '#f4f4f5' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--color-primary)", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={customChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} tickFormatter={(val) => `${currency === 'USD' ? '$' : 'R$'} ${val/1000}k`} />
                        <Tooltip formatter={(val: any) => [formatCurrency(Number(val)), t('value')]} cursor={{ fill: '#f4f4f5' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                          {customChartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.value >= 0 ? 'var(--color-success, #16a34a)' : 'var(--color-danger, #dc2626)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}