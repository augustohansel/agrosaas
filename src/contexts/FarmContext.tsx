import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { getMyFarms, type Farm } from '../features/farms/services/api';

interface FarmContextData {
  farms: Farm[];
  activeFarmId: string;
  setActiveFarmId: (id: string) => void;
  loadingFarms: boolean;
  refreshFarms: () => Promise<void>;
}

const FarmContext = createContext<FarmContextData>({} as FarmContextData);

export function FarmProvider({ children }: { children: ReactNode }) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [activeFarmId, setActiveFarmId] = useState<string>('');
  const [loadingFarms, setLoadingFarms] = useState(true);

  async function loadFarms() {
    setLoadingFarms(true);
    try {
      const data = await getMyFarms();
      setFarms(data);
      
      if (data.length > 0) {
        // Verifica se há uma fazenda guardada na memória do navegador
        const savedFarmId = localStorage.getItem('@AgroSaaS:activeFarm');
        
        // Confirma se a fazenda guardada ainda existe na lista retornada pela API
        const isValidSavedFarm = data.find(f => f.id === savedFarmId);

        if (isValidSavedFarm) {
          setActiveFarmId(savedFarmId as string);
        } else {
          // Fallback para a primeira opção
          setActiveFarmId(data[0].id);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar fazendas", error);
    } finally {
      setLoadingFarms(false);
    }
  }

  // Carrega as fazendas assim que o provedor é montado
  useEffect(() => {
    loadFarms();
  }, []);

  // Guarda no LocalStorage sempre que o utilizador troca de fazenda no cabeçalho
  useEffect(() => {
    if (activeFarmId) {
      localStorage.setItem('@AgroSaaS:activeFarm', activeFarmId);
    }
  }, [activeFarmId]);

  return (
    <FarmContext.Provider value={{ farms, activeFarmId, setActiveFarmId, loadingFarms, refreshFarms: loadFarms }}>
      {children}
    </FarmContext.Provider>
  );
}

// Hook personalizado para facilitar o uso
export function useFarm() {
  return useContext(FarmContext);
}