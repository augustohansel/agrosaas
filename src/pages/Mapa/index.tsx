import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, useMap, useMapEvents } from 'react-leaflet';
import { MapPin, CheckCircle2, Pencil, Trash2, Map as MapIcon, AlertTriangle, PlusCircle } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

(window as any).L = L;
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

import { Layout } from '../../components/Layout';
import { useFarm } from '../../contexts/FarmContext';
import { createPlot, getPlots, updatePlot, deletePlot, type Plot } from '../../features/plots/services/api';
import { updateFarmLocation } from '../../features/farms/services/api';
import { useTranslation } from '../../hooks/useTranslation';
import styles from './styles.module.css';

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, 14, { animate: true, duration: 1.5 }); }, [center[0], center[1], map]);
  return null;
}

function FocusPlotView({ plot }: { plot: Plot | null }) {
  const map = useMap();
  useEffect(() => {
    if (plot && plot.coordinates) {
      try { map.flyToBounds(L.latLngBounds(plot.coordinates), { padding: [50, 50], duration: 1.5 }); } catch (error) { }
    }
  }, [plot, map]);
  return null;
}

function getAreaValue(coordinates: any[], unit: string) {
  if (!coordinates || coordinates.length < 3) return "0.00";
  try {
    let area = L.GeometryUtil.geodesicArea(coordinates) / 10000;
    if (unit === 'acre') area = area * 2.47105;
    return area.toFixed(2);
  } catch (error) { return "0.00"; }
}

function LocationSelector({ isSelecting, onLocationSelect }: { isSelecting: boolean, onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { if (isSelecting) onLocationSelect(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function NativeDrawControl({ onPolygonCreated }: { onPolygonCreated: (e: any) => void }) {
  const map = useMap();
  useEffect(() => {
    if ((map as any)._drawControlAdded) return;
    const drawControl = new L.Control.Draw({
      draw: { polygon: { allowIntersection: false, shapeOptions: { color: '#16a34a' } }, polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false }
    });
    map.addControl(drawControl);
    (map as any)._drawControlAdded = true;
    map.on(L.Draw.Event.CREATED, onPolygonCreated);
    return () => { map.removeControl(drawControl); map.off(L.Draw.Event.CREATED, onPolygonCreated); (map as any)._drawControlAdded = false; };
  }, [map, onPolygonCreated]);
  return null;
}

export function Mapa() {
  const { farms, activeFarmId, refreshFarms } = useFarm();
  const { t } = useTranslation();
  const [plots, setPlots] = useState<Plot[]>([]);
  const [focusedPlot, setFocusedPlot] = useState<Plot | null>(null);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado para o modal de exclusão do Talhão
  const [plotToDelete, setPlotToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado para o modal de edição do Talhão
  const [plotToEdit, setPlotToEdit] = useState<Plot | null>(null);
  const [newPlotName, setNewPlotName] = useState('');
  const [isEditingPlot, setIsEditingPlot] = useState(false);

  // Estado para o modal de CRIAÇÃO do Talhão (Substitui o prompt)
  const [plotToCreate, setPlotToCreate] = useState<any>(null);
  const [createPlotName, setCreatePlotName] = useState('');
  const [createPlotArea, setCreatePlotArea] = useState('');
  const [isCreatingPlot, setIsCreatingPlot] = useState(false);

  const activeFarm = farms.find(f => f.id === activeFarmId);
  const defaultCenter: [number, number] = [-29.6842, -53.8069]; 
  
  const [areaUnit, setAreaUnit] = useState(localStorage.getItem('@AgroSaaS:areaUnit') || 'ha');
  const areaLabel = areaUnit === 'acre' ? 'ac' : 'ha';

  useEffect(() => {
    const handleAreaChange = () => setAreaUnit(localStorage.getItem('@AgroSaaS:areaUnit') || 'ha');
    window.addEventListener('areaUnitChanged', handleAreaChange);
    return () => window.removeEventListener('areaUnitChanged', handleAreaChange);
  }, []);
  
  const hasLocation = !!(activeFarm?.latitude && activeFarm?.longitude);
  const centerPosition: [number, number] = hasLocation ? [activeFarm.latitude!, activeFarm.longitude!] : defaultCenter;

  useEffect(() => {
    async function loadPlots() {
      if (!activeFarmId) return;
      try {
        const allFarmIds = farms.map(f => f.id);
        const data = await getPlots(activeFarmId, allFarmIds);
        setPlots(data);
      } catch (error) {}
    }
    loadPlots();
  }, [activeFarmId, farms]);

  async function handleLocationSelect(lat: number, lng: number) {
    if (!activeFarm) return;
    setIsSaving(true);
    try {
      await updateFarmLocation(activeFarm.id, lat, lng);
      await refreshFarms(); 
      setIsSelectingLocation(false);
    } catch (error) {} finally { setIsSaving(false); }
  }

  // Intercepta a criação do polígono no mapa
  async function handlePolygonCreated(e: any) {
    if (!activeFarmId || activeFarmId === 'all') return;
    const latlngs = e.layer.getLatLngs()[0]; 
    const areaValue = getAreaValue(latlngs, areaUnit);
    
    // Guarda os dados e abre o modal em vez do prompt
    setPlotToCreate(latlngs);
    setCreatePlotArea(areaValue);
    setCreatePlotName('');
  }

  // Confirma a criação no modal
  const confirmCreatePlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarmId || activeFarmId === 'all' || !plotToCreate || !createPlotName.trim()) {
      setPlotToCreate(null);
      return;
    }
    
    setIsCreatingPlot(true);
    try {
      await createPlot({ farm_id: activeFarmId, name: createPlotName, coordinates: plotToCreate });
      const data = await getPlots(activeFarmId, farms.map(f => f.id));
      setPlots(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCreatingPlot(false);
      setPlotToCreate(null);
    }
  };

  const handleOpenDelete = (id: string) => {
    setPlotToDelete(id);
  };

  const confirmDelete = async () => {
    if (!plotToDelete) return;
    setIsDeleting(true);
    try {
      await deletePlot(plotToDelete);
      setPlots(plots.filter(p => p.id !== plotToDelete));
      if (focusedPlot?.id === plotToDelete) setFocusedPlot(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsDeleting(false);
      setPlotToDelete(null);
    }
  };

  const handleOpenEditPlot = (plot: Plot) => {
    setPlotToEdit(plot);
    setNewPlotName(plot.name);
  };

  const confirmEditPlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plotToEdit || !newPlotName.trim() || newPlotName === plotToEdit.name) {
      setPlotToEdit(null);
      return;
    }
    
    setIsEditingPlot(true);
    try {
      await updatePlot(plotToEdit.id, { name: newPlotName });
      setPlots(plots.map(p => p.id === plotToEdit.id ? { ...p, name: newPlotName } : p));
    } catch (error) {
      console.error(error);
    } finally {
      setIsEditingPlot(false);
      setPlotToEdit(null);
    }
  };

  const getButtonText = () => {
    if (isSaving) return t('saving');
    if (isSelectingLocation) return t('cancelMarking');
    return hasLocation ? t('initialLocDone') : t('setInitialLoc');
  };

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>{t('mapTitle')}</h1>
            <p className={styles.description}>{activeFarmId === 'all' ? t('mapDescAll') : t('mapDescSingle')}</p>
          </div>
          
          {activeFarm && activeFarmId !== 'all' && (
            <button onClick={() => setIsSelectingLocation(!isSelectingLocation)} className={styles.locationButton} style={{ backgroundColor: isSelectingLocation ? '#dc2626' : hasLocation ? '#16a34a' : 'var(--color-primary)' }} disabled={isSaving}>
              {hasLocation && !isSelectingLocation ? <CheckCircle2 size={20} /> : <MapPin size={20} />}
              {getButtonText()}
            </button>
          )}
        </div>

        <div className={styles.mainLayout}>
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <MapIcon size={20} className={styles.sidebarIcon} />
              <h3>{t('mappedAreas')}</h3>
            </div>
            
            <div className={styles.plotList}>
              {plots.length === 0 ? (
                <p className={styles.emptyMessage}>{t('noAreasDrawn')}</p>
              ) : (
                plots.map(plot => (
                  <div key={plot.id} className={`${styles.plotItem} ${focusedPlot?.id === plot.id ? styles.plotItemActive : ''}`} onClick={() => setFocusedPlot(plot)}>
                    <div className={styles.plotInfo}>
                      <span className={styles.plotName}>{plot.name}</span>
                      <span className={styles.plotArea}>{getAreaValue(plot.coordinates, areaUnit)} {areaLabel}</span>
                    </div>
                    
                    <div className={styles.plotActions}>
                      <button onClick={(e) => { e.stopPropagation(); handleOpenEditPlot(plot); }} className={styles.btnEdit} title={t('rename')}><Pencil size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleOpenDelete(plot.id); }} className={styles.btnDelete} title={t('delete')}><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={`${styles.mapWrapper} ${isSelectingLocation ? styles.mapWrapperSelecting : ''}`}>
            <MapContainer center={centerPosition} zoom={14} className={styles.mapElement}>
              <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />
              {!focusedPlot && <ChangeView center={centerPosition} />}
              <FocusPlotView plot={focusedPlot} />
              <LocationSelector isSelecting={isSelectingLocation} onLocationSelect={handleLocationSelect} />
              {plots.map(plot => (
                <Polygon key={plot.id} positions={plot.coordinates} pathOptions={{ color: focusedPlot?.id === plot.id ? '#f59e0b' : 'var(--color-primary)', fillColor: focusedPlot?.id === plot.id ? '#f59e0b' : 'var(--color-primary)', fillOpacity: focusedPlot?.id === plot.id ? 0.6 : 0.4 }}>
                  <Popup><strong>{plot.name}</strong><br/>{getAreaValue(plot.coordinates, areaUnit)} {areaLabel}</Popup>
                </Polygon>
              ))}
              {activeFarmId && activeFarmId !== 'all' && <NativeDrawControl onPolygonCreated={handlePolygonCreated} />}
              {isSelectingLocation && <div className={styles.instructionBanner}>{t('clickMapToOpen')}</div>}
            </MapContainer>
          </div>
        </div>

        {/* Modal de Confirmação de Exclusão do Talhão */}
        {plotToDelete && (
          <div className={styles.modalOverlay} onClick={() => setPlotToDelete(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--color-danger)' }}>
                <AlertTriangle size={24} />
                <h3 className={styles.modalTitle} style={{ margin: 0 }}>Excluir Área</h3>
              </div>
              <p className={styles.modalText}>
                Tem a certeza que deseja excluir este talhão mapeado? Esta ação irá remover o desenho do mapa de forma permanente.
              </p>
              <div className={styles.modalActions}>
                <button className={styles.btnCancel} onClick={() => setPlotToDelete(null)} disabled={isDeleting}>
                  {t('cancelBtn')}
                </button>
                <button className={styles.btnDeleteConfirm} onClick={confirmDelete} disabled={isDeleting}>
                  {isDeleting ? 'A excluir...' : 'Sim, excluir'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edição de Talhão */}
        {plotToEdit && (
          <div className={styles.modalOverlay} onClick={() => setPlotToEdit(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>
                <Pencil size={24} />
                <h3 className={styles.modalTitle} style={{ margin: 0 }}>Renomear Área</h3>
              </div>
              <form onSubmit={confirmEditPlot}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--color-text-main)' }}>Novo Nome</label>
                  <input
                    type="text"
                    autoFocus
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e4e4e7', fontSize: '0.875rem', outline: 'none' }}
                    value={newPlotName}
                    onChange={e => setNewPlotName(e.target.value)}
                    onFocus={e => e.target.select()}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.btnCancel} onClick={() => setPlotToEdit(null)} disabled={isEditingPlot}>
                    {t('cancelBtn')}
                  </button>
                  <button type="submit" className={styles.btnSave} disabled={isEditingPlot || !newPlotName.trim()}>
                    {isEditingPlot ? t('saving') : 'Guardar Nome'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de CRIAÇÃO de Talhão */}
        {plotToCreate && (
          <div className={styles.modalOverlay} onClick={() => setPlotToCreate(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', color: 'var(--color-success, #16a34a)' }}>
                <PlusCircle size={24} />
                <h3 className={styles.modalTitle} style={{ margin: 0 }}>Nova Área Desenhada</h3>
              </div>
              <p className={styles.modalText} style={{ marginBottom: '1.5rem' }}>
                Área calculada: <strong style={{ color: 'var(--color-text-main)' }}>{createPlotArea} {areaLabel}</strong>
              </p>
              <form onSubmit={confirmCreatePlot}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--color-text-main)' }}>{t('whatName')}</label>
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="Ex: Talhão Sul"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e4e4e7', fontSize: '0.875rem', outline: 'none' }}
                    value={createPlotName}
                    onChange={e => setCreatePlotName(e.target.value)}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.btnCancel} onClick={() => setPlotToCreate(null)} disabled={isCreatingPlot}>
                    {t('cancelBtn')}
                  </button>
                  <button type="submit" className={styles.btnSave} style={{ backgroundColor: 'var(--color-success, #16a34a)' }} disabled={isCreatingPlot || !createPlotName.trim()}>
                    {isCreatingPlot ? t('saving') : 'Guardar Área'}
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