import { useState, useEffect } from 'react';

const dictionary = {
  pt: {
    menuOverview: 'Visão Geral', menuCosts: 'Gestão de Custos', menuMap: 'Mapa de Fazendas', menuSettings: 'Configurações', menuLogout: 'Sair do Sistema', controlPanel: 'Painel de Controle', newBtn: 'Nova', loading: 'A carregar...', noFarms: 'Nenhuma fazenda registada', allFarms: 'Todas as Fazendas',
    settingsDesc: 'Gira as preferências do sistema e as suas propriedades.', globalPrefs: 'Preferências Globais', farmMgmt: 'Gestão de Propriedades', locFormatting: 'Localização e Formatação', locDesc: 'Estes ajustes afetam como os valores e métricas são exibidos no seu painel.', langLabel: 'Idioma da Interface', currencyLabel: 'Moeda Principal', areaLabel: 'Unidade de Medida (Área)', registeredFarms: 'Fazendas Registadas', farmListDesc: 'Lista de todas as propriedades associadas à sua conta.', noFarmsFound: 'Nenhuma fazenda encontrada.', createdAt: 'Criada em', renameFarm: 'Renomear', deleteFarm: 'Excluir Fazenda',
    renamePrompt: 'Novo nome para a propriedade:', confirmDel1: 'ATENÇÃO: Deseja mesmo excluir a fazenda "', confirmDel2: '"? Todos os talhões e despesas serão perdidos.', errorApi: 'Ocorreu um erro no servidor.',
    dashboardTitle: 'Dashboard', allPeriod: 'Todo o Período', currentBalance: 'Saldo Atual', incomes: 'Receitas', expenses: 'Despesas', entries: 'Lançamentos', avgCostPerArea: 'Custo Médio', loadingReports: 'A carregar relatórios...', balanceMonthly: 'Balança (Mensal)', balanceDaily: 'Balança (Diária)', noData: 'Sem dados para exibir.', expensesGeneral: 'Despesas (Geral)', noExpenses: 'Sem despesas registadas.', perfByPlot: 'Desempenho por Talhão',
    finMgmtTitle: 'Gestão Financeira', finMgmtDescAll: 'Histórico detalhado de movimentações de todas as propriedades.', finMgmtDescSingle: 'Histórico detalhado de movimentações da', addRecord: 'Adicionar Registo', overview: 'Visão Geral', records: 'registos', loadingRecords: 'A carregar registos...', date: 'Data', description: 'Descrição', areaPlot: 'Área / Talhão', category: 'Categoria', type: 'Tipo', value: 'Valor', actions: 'Ações', noMovements: 'Nenhuma movimentação encontrada.', generalFarm: 'Geral', incomeType: 'Receita', expenseType: 'Despesa', prev: 'Anterior', next: 'Próximo',
    mapTitle: 'Mapeamento de Áreas', mapDescAll: 'Desenhe os seus talhões e faça a gestão das áreas de todas as propriedades.', mapDescSingle: 'Desenhe os seus talhões e faça a gestão das áreas da propriedade.', saving: 'A guardar...', cancelMarking: 'Cancelar Marcação', initialLocDone: 'Localização inicial feita (Alterar)', setInitialLoc: 'Definir Posição Inicial', mappedAreas: 'Áreas Mapeadas', noAreasDrawn: 'Nenhuma área desenhada.', rename: 'Renomear', delete: 'Excluir', clickMapToOpen: 'Clique no mapa para definir onde a câmara deve abrir', whatName: 'Qual o nome desta área (Ex: Talhão Sul, Pasto 1)?',
    newEntry: 'Novo Lançamento', editEntry: 'Editar Registo', newEntryDesc: 'Registe uma nova receita ou despesa.', editEntryDesc: 'Atualize as informações desta movimentação.', movementType: 'Tipo de Movimentação', expenseOpt: 'Despesa (Custo)', incomeOpt: 'Receita (Venda)', areaPlotOpt: 'Área / Talhão (Opcional)', generalFarmOpt: 'Geral da Fazenda', selectPlotPlaceholder: 'Selecione um talhão', categoryOpt: 'Categoria', descOpt: 'Descrição (Opcional)', descPlaceholder: 'Ex: Compra de Ureia', valueBRL: 'Valor', dateOpt: 'Data', cancelBtn: 'Cancelar', saveBtn: 'Salvar Registo', updateBtn: 'Atualizar Registo',
    catFertilizers: 'Adubos e Fertilizantes', catSeeds: 'Sementes', catPesticides: 'Defensivos (Agrotóxicos)', catFuel: 'Combustível', catLabor: 'Mão de Obra', catMaintenance: 'Manutenção de Máquinas', catAnimalNutrition: 'Nutrição Animal', catVet: 'Veterinário', catTaxes: 'Impostos', catOther: 'Outros', catSoy: 'Venda de Soja', catCorn: 'Venda de Milho', catGrains: 'Venda de Grãos', catLivestock: 'Venda de Gado', catVegetables: 'Hortaliças',
    newFarmTitle: 'Criar Nova Fazenda', newFarmNameLabel: 'Nome da Propriedade', newFarmPlaceholder: 'Ex: Fazenda Esperança', createBtn: 'Criar Fazenda',
    exportCSV: 'Exportar CSV',
    customChart: 'O Meu Gráfico', metric: 'Métrica', dimension: 'Agrupar por', format: 'Formato',
    metricIncome: 'Receitas', metricExpense: 'Despesas', metricBalance: 'Saldo',
    dimCategory: 'Categoria', dimPlot: 'Talhão', dimMonth: 'Mês',
    fmtBar: 'Barras', fmtLine: 'Linha', fmtPie: 'Pizza',
    },
  en: {
    menuOverview: 'Dashboard', menuCosts: 'Cost Management', menuMap: 'Farm Map', menuSettings: 'Settings', menuLogout: 'Logout', controlPanel: 'Control Panel', newBtn: 'New', loading: 'Loading...', noFarms: 'No registered farms', allFarms: 'All Farms',
    settingsDesc: 'Manage system preferences and your properties.', globalPrefs: 'Global Preferences', farmMgmt: 'Property Management', locFormatting: 'Localization & Formatting', locDesc: 'These settings affect how values and metrics are displayed on your dashboard.', langLabel: 'Interface Language', currencyLabel: 'Main Currency', areaLabel: 'Area Unit', registeredFarms: 'Registered Farms', farmListDesc: 'List of all properties associated with your account.', noFarmsFound: 'No farms found.', createdAt: 'Created at', renameFarm: 'Rename', deleteFarm: 'Delete Farm',
    renamePrompt: 'New name for the property:', confirmDel1: 'WARNING: Do you really want to delete the farm "', confirmDel2: '"? All plots and records will be lost.', errorApi: 'A server error occurred.',
    dashboardTitle: 'Dashboard', allPeriod: 'All Time', currentBalance: 'Current Balance', incomes: 'Incomes', expenses: 'Expenses', entries: 'Entries', avgCostPerArea: 'Avg. Cost', loadingReports: 'Loading reports...', balanceMonthly: 'Balance (Monthly)', balanceDaily: 'Balance (Daily)', noData: 'No data to display.', expensesGeneral: 'Expenses (General)', noExpenses: 'No registered expenses.', perfByPlot: 'Performance by Plot',
    finMgmtTitle: 'Financial Management', finMgmtDescAll: 'Detailed transaction history for all properties.', finMgmtDescSingle: 'Detailed transaction history for', addRecord: 'Add Record', overview: 'Overview', records: 'records', loadingRecords: 'Loading records...', date: 'Date', description: 'Description', areaPlot: 'Area / Plot', category: 'Category', type: 'Type', value: 'Value', actions: 'Actions', noMovements: 'No transactions found.', generalFarm: 'General', incomeType: 'Income', expenseType: 'Expense', prev: 'Previous', next: 'Next',
    mapTitle: 'Area Mapping', mapDescAll: 'Draw your plots and manage areas for all properties.', mapDescSingle: 'Draw your plots and manage areas for the property.', saving: 'Saving...', cancelMarking: 'Cancel Marking', initialLocDone: 'Initial location set (Change)', setInitialLoc: 'Set Initial Location', mappedAreas: 'Mapped Areas', noAreasDrawn: 'No areas drawn.', rename: 'Rename', delete: 'Delete', clickMapToOpen: 'Click on the map to set where the camera should open', whatName: 'What is the name of this area (Ex: South Plot, Pasture 1)?',
    newEntry: 'New Entry', editEntry: 'Edit Record', newEntryDesc: 'Register a new income or expense.', editEntryDesc: 'Update the information for this transaction.', movementType: 'Transaction Type', expenseOpt: 'Expense (Cost)', incomeOpt: 'Income (Sale)', areaPlotOpt: 'Area / Plot (Optional)', generalFarmOpt: 'General Farm', selectPlotPlaceholder: 'Select a plot', categoryOpt: 'Category', descOpt: 'Description (Optional)', descPlaceholder: 'Ex: Fertilizer Purchase', valueBRL: 'Value', dateOpt: 'Date', cancelBtn: 'Cancel', saveBtn: 'Save Record', updateBtn: 'Update Record',
    catFertilizers: 'Fertilizers', catSeeds: 'Seeds', catPesticides: 'Pesticides', catFuel: 'Fuel', catLabor: 'Labor', catMaintenance: 'Machine Maintenance', catAnimalNutrition: 'Animal Nutrition', catVet: 'Veterinary', catTaxes: 'Taxes', catOther: 'Others', catSoy: 'Soybean Sales', catCorn: 'Corn Sales', catGrains: 'Grain Sales', catLivestock: 'Livestock Sales', catVegetables: 'Vegetables',
    newFarmTitle: 'Create New Farm', newFarmNameLabel: 'Property Name', newFarmPlaceholder: 'Ex: Hope Farm', createBtn: 'Create Farm',
    exportCSV: 'Export CSV',
    customChart: 'My Chart', metric: 'Metric', dimension: 'Group by', format: 'Format',
    metricIncome: 'Incomes', metricExpense: 'Expenses', metricBalance: 'Balance',
    dimCategory: 'Category', dimPlot: 'Plot', dimMonth: 'Month',
    fmtBar: 'Bar', fmtLine: 'Line', fmtPie: 'Pie',
    },
  es: {
    menuOverview: 'Visión General', menuCosts: 'Gestión de Costos', menuMap: 'Mapa de Fincas', menuSettings: 'Configuración', menuLogout: 'Cerrar Sesión', controlPanel: 'Panel de Control', newBtn: 'Nueva', loading: 'Cargando...', noFarms: 'Ninguna finca registrada', allFarms: 'Todas las Fincas',
    settingsDesc: 'Gestiona las preferencias del sistema y tus propiedades.', globalPrefs: 'Preferencias Globales', farmMgmt: 'Gestión de Propiedades', locFormatting: 'Localización y Formato', locDesc: 'Estos ajustes afectan cómo se muestran los valores y métricas en tu panel.', langLabel: 'Idioma de la Interfaz', currencyLabel: 'Moneda Principal', areaLabel: 'Unidad de Medida (Área)', registeredFarms: 'Fincas Registradas', farmListDesc: 'Lista de todas las propiedades asociadas a tu cuenta.', noFarmsFound: 'No se encontraron fincas.', createdAt: 'Creada el', renameFarm: 'Renombrar', deleteFarm: 'Eliminar Finca',
    renamePrompt: 'Nuevo nombre para la propiedad:', confirmDel1: 'ATENCIÓN: ¿Realmente deseas eliminar la finca "', confirmDel2: '"? Se perderán todos los lotes y registros.', errorApi: 'Ocurrió un error en el servidor.',
    dashboardTitle: 'Panel', allPeriod: 'Todo el Período', currentBalance: 'Saldo Actual', incomes: 'Ingresos', expenses: 'Gastos', entries: 'Registros', avgCostPerArea: 'Costo Promedio', loadingReports: 'Cargando reportes...', balanceMonthly: 'Balance (Mensual)', balanceDaily: 'Balance (Diario)', noData: 'Sin datos para mostrar.', expensesGeneral: 'Gastos (General)', noExpenses: 'Sin gastos registrados.', perfByPlot: 'Desempeño por Lote',
    finMgmtTitle: 'Gestión Financiera', finMgmtDescAll: 'Historial detallado de movimientos de todas las propiedades.', finMgmtDescSingle: 'Historial detallado de movimientos de', addRecord: 'Añadir Registro', overview: 'Visión General', records: 'registros', loadingRecords: 'Cargando registros...', date: 'Fecha', description: 'Descripción', areaPlot: 'Área / Lote', category: 'Categoría', type: 'Tipo', value: 'Valor', actions: 'Acciones', noMovements: 'No se encontraron movimientos.', generalFarm: 'General', incomeType: 'Ingreso', expenseType: 'Gasto', prev: 'Anterior', next: 'Siguiente',
    mapTitle: 'Mapeo de Áreas', mapDescAll: 'Dibuja tus lotes y gestiona las áreas de todas las propiedades.', mapDescSingle: 'Dibuja tus lotes y gestiona las áreas de la propiedad.', saving: 'Guardando...', cancelMarking: 'Cancelar Marcación', initialLocDone: 'Ubicación inicial lista (Cambiar)', setInitialLoc: 'Definir Posición Inicial', mappedAreas: 'Áreas Mapeadas', noAreasDrawn: 'No hay áreas dibujadas.', rename: 'Renombrar', delete: 'Eliminar', clickMapToOpen: 'Haz clic en el mapa para definir dónde debe abrir la cámara', whatName: '¿Cuál es el nombre de esta área (Ej: Lote Sur, Pasto 1)?',
    newEntry: 'Nuevo Registro', editEntry: 'Editar Registro', newEntryDesc: 'Registra un nuevo ingreso o gasto.', editEntryDesc: 'Actualiza la información de esta transacción.', movementType: 'Tipo de Transacción', expenseOpt: 'Gasto (Costo)', incomeOpt: 'Ingreso (Venta)', areaPlotOpt: 'Área / Lote (Opcional)', generalFarmOpt: 'General de la Finca', selectPlotPlaceholder: 'Seleccione un lote', categoryOpt: 'Categoría', descOpt: 'Descripción (Opcional)', descPlaceholder: 'Ej: Compra de Fertilizante', valueBRL: 'Valor', dateOpt: 'Fecha', cancelBtn: 'Cancelar', saveBtn: 'Guardar Registro', updateBtn: 'Actualizar Registro',
    catFertilizers: 'Fertilizantes', catSeeds: 'Semillas', catPesticides: 'Pesticidas', catFuel: 'Combustible', catLabor: 'Mano de Obra', catMaintenance: 'Mantenimiento de Máquinas', catAnimalNutrition: 'Nutrición Animal', catVet: 'Veterinario', catTaxes: 'Impuestos', catOther: 'Otros', catSoy: 'Venta de Soja', catCorn: 'Venta de Maíz', catGrains: 'Venta de Granos', catLivestock: 'Venta de Ganado', catVegetables: 'Hortalizas',
    newFarmTitle: 'Crear Nueva Finca', newFarmNameLabel: 'Nombre de la Propiedad', newFarmPlaceholder: 'Ej: Finca Esperanza', createBtn: 'Crear Finca',
    exportCSV: 'Exportar CSV',
    customChart: 'Mi Gráfico', metric: 'Métrica', dimension: 'Agrupar por', format: 'Formato',
    metricIncome: 'Ingresos', metricExpense: 'Gastos', metricBalance: 'Saldo',
    dimCategory: 'Categoría', dimPlot: 'Lote', dimMonth: 'Mes',
    fmtBar: 'Barras', fmtLine: 'Línea', fmtPie: 'Circular',
    }, 
};

type Language = keyof typeof dictionary;
export type TranslationKey = keyof typeof dictionary.pt;

const categoryMapping: Record<string, TranslationKey> = {
  'Adubos e Fertilizantes': 'catFertilizers', 'Sementes': 'catSeeds', 'Defensivos (Agrotóxicos)': 'catPesticides', 'Combustível': 'catFuel', 'Mão de Obra': 'catLabor', 'Manutenção de Máquinas': 'catMaintenance', 'Nutrição Animal': 'catAnimalNutrition', 'Veterinário': 'catVet', 'Impostos': 'catTaxes', 'Outros': 'catOther', 'Venda de Soja': 'catSoy', 'Venda de Milho': 'catCorn', 'Venda de Grãos': 'catGrains', 'Venda de Gado': 'catLivestock', 'Hortaliças': 'catVegetables',
};

export function useTranslation() {
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('@AgroSaaS:language') as Language) || 'pt';
  });

  useEffect(() => {
    const handleLangChange = () => setLang((localStorage.getItem('@AgroSaaS:language') as Language) || 'pt');
    window.addEventListener('languageChanged', handleLangChange);
    return () => window.removeEventListener('languageChanged', handleLangChange);
  }, []);

  const t = (key: TranslationKey) => dictionary[lang]?.[key] || dictionary.pt[key] || key;
  const tCategory = (catName: string) => { const key = categoryMapping[catName]; return key ? t(key) : catName; };

  return { t, tCategory, lang };
}