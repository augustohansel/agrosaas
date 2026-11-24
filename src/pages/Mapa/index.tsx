import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Polygon, Tooltip, ScaleControl, useMap, useMapEvents } from 'react-leaflet';
import { useFields } from '../../features/field/context';
import { FieldDetails } from '../../features/field/Atlas';
import { fieldColor, layers } from '../../features/field/model';
import { MapPin, Pencil, Trash2, Map as MapIcon, AlertTriangle, PlusCircle, Search, Layers, Palette } from 'lucide-react';
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
import { MapNavigation } from './MapNavigation';
import { supabase } from '../../services/supabase';

const colors = ['#419966', '#db9030', '#538bd5', '#b16acf', '#d36955', '#24a5a2', '#bcaa32', '#d26897'];
const colorKey = (p: Plot) => 'agro:map:color:' + p.farm_id + ':' + p.id;
function plotColor(p: Plot) {
  const saved = p.color ?? localStorage.getItem(colorKey(p));
  return saved && /^#[0-9a-f]{6}$/i.test(saved) ? saved : colors[Array.from(p.id).reduce((n,ch) => (31*n+ch.charCodeAt(0)) >>> 0,0) % colors.length];
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

function DrawPolygon({ onPolygonCreated, stop }: { onPolygonCreated: (e: L.DrawEvents.Created) => void; stop: () => void }) {
  const map = useMap();
  useEffect(() => {
    const draw = new L.Draw.Polygon(map as L.DrawMap, { allowIntersection: false, shapeOptions: {color:'#52b789'} });
    map.on(L.Draw.Event.CREATED, onPolygonCreated as L.LeafletEventHandlerFn);
    map.on(L.Draw.Event.DRAWSTOP, stop);
    draw.enable();
    return () => { map.off(L.Draw.Event.CREATED, onPolygonCreated as L.LeafletEventHandlerFn); map.off(L.Draw.Event.DRAWSTOP, stop); draw.disable(); };
  }, [map, onPolygonCreated, stop]);
  return null;
}

function BoundaryEditor({plot,save,cancel}:{plot:Plot;save:(points:L.LatLng[])=>Promise<void>;cancel:()=>void}) {
  const map=useMap();
  const [polygon,setPolygon]=useState<L.Polygon|null>(null);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    const shape=L.polygon(plot.coordinates,{color:'#e76820'}).addTo(map);
    const editor=new L.EditToolbar.Edit(map as L.DrawMap,{featureGroup:L.featureGroup([shape]),poly:{allowIntersection:false},selectedPathOptions:{color:'#ec7b3a'}});
    editor.enable();
    setPolygon(shape);
    return ()=>{editor.disable();shape.remove();};
  },[plot,map]);
  return <div className="boundary-controls" ref={el=>{if(el)L.DomEvent.disableClickPropagation(el);}}>
    <span>Arraste os vértices.</span><button disabled={!polygon||saving} onClick={async()=>{
      if(!polygon)return;
      setSaving(true);
      try {await save(polygon.getLatLngs()[0] as L.LatLng[]);}
      finally {setSaving(false);}
    }}>{saving?'Salvando…':'Salvar limite'}</button><button disabled={saving} onClick={cancel}>Cancelar</button>
  </div>;
}

export function Mapa() {
  const [params] = useSearchParams();
  const requestedPlot = params.get("talhao");
  const fieldData=useFields();
  const [layer,setLayer]=useState(-1);
  const [ready,setReady]=useState(false);
  const [search,setSearch]=useState('');
  const [color,setColor]=useState(colors[0]);
  const [drawing,setDrawing]=useState(false);
  const stopDrawing=useCallback(()=>setDrawing(false),[]);
  const [base,setBase]=useState('satellite');
  const [loadingPreference, setLoadingPreference] = useState(true);
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const {data,error} = await supabase.from('map_preferences').select('base_map,map_layer').abortSignal(controller.signal).maybeSingle();
        if (controller.signal.aborted) return;
        if (error) throw error;
        if (data) {setBase(data.base_map); setLayer(data.map_layer);}
      } catch {
        if (!controller.signal.aborted) setPreferenceError('Não foi possível carregar as preferências do mapa.');
      } finally {
        if (!controller.signal.aborted) setLoadingPreference(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);
  async function savePreference(change: {base_map: string} | {map_layer: number}) {
    if (loadingPreference || savingPreference) return;
    setSavingPreference(true);
    setPreferenceError('');
    try {
      const payload: { base_map?: string; map_layer?: number } = change;
      const {error} = await supabase.from('map_preferences').upsert(payload, {onConflict:'user_id'});
      if (error) throw error;
      if ('base_map' in change) setBase(change.base_map);
      else setLayer(change.map_layer);
    } catch {setPreferenceError('A preferência não foi salva. Verifique a conexão e a migration de mapas.');}
    finally {setSavingPreference(false);}
  }
  const [details,setDetails]=useState('');
  const [boundary,setBoundary]=useState<Plot|null>(null);
  const [message,setMessage]=useState('');
  const detailField=fieldData.fields.find(f=>f.id===details);
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
  const write = ['owner','editor','manager'].includes(activeFarm?.role ?? '');
  
  const [areaUnit, setAreaUnit] = useState(localStorage.getItem('@AgroSaaS:areaUnit') || 'ha');
  const areaLabel = areaUnit === 'acre' ? 'ac' : 'ha';

  useEffect(() => {
    const handleAreaChange = () => setAreaUnit(localStorage.getItem('@AgroSaaS:areaUnit') || 'ha');
    window.addEventListener('areaUnitChanged', handleAreaChange);
    return () => window.removeEventListener('areaUnitChanged', handleAreaChange);
  }, []);
  
  const home: [number, number] | null = activeFarm?.latitude != null && activeFarm.longitude != null ? [Number(activeFarm.latitude), Number(activeFarm.longitude)] : null;

  useEffect(() => {
    let current = true;
    async function loadPlots() {
      if (!activeFarmId) {setReady(true);return;}
      try {
        const allFarmIds = farms.map(f => f.id);
        const data = await getPlots(activeFarmId, allFarmIds);
        if (!current) return;
        setPlots(data);
        setReady(true);
        if (requestedPlot) {
          const match = data.find(p => p.id === requestedPlot);
          if (match) { setFocusedPlot(match); setDetails(match.id); }
        }
      } catch {if (current) setMessage('Não foi possível carregar os talhões. Atualize para tentar novamente.');}
    }
    loadPlots();
    return () => {current = false;};
  }, [activeFarmId, farms, requestedPlot]);

  async function handleLocationSelect(lat: number, lng: number) {
    if (!activeFarm) return;
    setIsSaving(true);
    try {
      await updateFarmLocation(activeFarm.id, lat, lng);
      await refreshFarms(); 
      setIsSelectingLocation(false);
    } catch {setMessage('Não foi possível salvar a posição da fazenda.');} finally { setIsSaving(false); }
  }

  // Intercepta a criação do polígono no mapa
  const handlePolygonCreated = useCallback((e: L.DrawEvents.Created) => {
    const latlngs = (e.layer as L.Polygon).getLatLngs()[0] as L.LatLng[];
    const areaValue = getAreaValue(latlngs, areaUnit);
    
    // Guarda os dados e abre o modal em vez do prompt
    setPlotToCreate(latlngs);
    setCreatePlotArea(areaValue);
    setCreatePlotName('');
    setColor(colors[plots.length % colors.length]);
  }, [areaUnit,plots.length]);

  // Confirma a criação no modal
  const confirmCreatePlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarmId || activeFarmId === 'all' || !plotToCreate || !createPlotName.trim()) {
      setPlotToCreate(null);
      return;
    }
    
    setIsCreatingPlot(true);
    try {
      const row = await createPlot({ farm_id: activeFarmId, name: createPlotName.trim(), coordinates: plotToCreate, color });
      setPlots(all => [...all,row]); setFocusedPlot(row); setPlotToCreate(null);
      fieldData.retry();
    } catch (error) {
      setMessage('Não foi possível salvar o talhão.');
    } finally {
      setIsCreatingPlot(false);
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
      fieldData.retry();
      setPlots(plots.filter(p => p.id !== plotToDelete));
      if (focusedPlot?.id === plotToDelete) setFocusedPlot(null);
    } catch (error) {
      setMessage('Não foi possível excluir. Verifique se o talhão possui ciclos ou lançamentos vinculados.');
    } finally {
      setIsDeleting(false);
      setPlotToDelete(null);
    }
  };

  const handleOpenEditPlot = (plot: Plot) => {
    setPlotToEdit(plot);
    setNewPlotName(plot.name);
    setColor(plotColor(plot));
  };

  const confirmEditPlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!write || !plotToEdit || !newPlotName.trim()) {
      setPlotToEdit(null);
      return;
    }
    
    setIsEditingPlot(true);
    try {
      const edited = await updatePlot(plotToEdit.id, { color, ...(newPlotName.trim() !== plotToEdit.name ? {name:newPlotName.trim()} : {}) });
      fieldData.retry();
      setPlots(plots.map(p => p.id === edited.id ? edited : p));
      if (focusedPlot?.id === edited.id) setFocusedPlot(edited);
      setPlotToEdit(null);
    } catch (error) {
      setMessage('Não foi possível salvar as alterações.');
    } finally {
      setIsEditingPlot(false);
    }
  };

  const getButtonText = () => {
    if (isSaving) return t('saving');
    if (isSelectingLocation) return t('cancelMarking');
    return home ? 'Alterar ponto da fazenda' : 'Marcar ponto da fazenda';
  };
  const normalize = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const visible = plots.filter(p=>normalize(p.name).includes(normalize(search)));
  const area = plots.reduce((sum,p)=>sum+Number(getAreaValue(p.coordinates,areaUnit)),0);
  const displayColor = (p:Plot) => {
    const f = fieldData.fields.find(item=>item.id===p.id);
    return layer < 0 || !f ? plotColor(p) : fieldColor(f,layer);
  };
  const colorPicker = <fieldset className={styles.colors}><legend>Cor do talhão na fazenda</legend>
    {colors.map(c=><button type="button" key={c} style={{background:c}} aria-label={'Usar cor '+c} aria-pressed={color===c} onClick={()=>setColor(c)}>{color===c?'✓':''}</button>)}
    <input type="color" aria-label="Escolher outra cor" value={color} onChange={e=>setColor(e.target.value)}/></fieldset>;

  return (
    <Layout>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <small className={styles.farmName}>{activeFarm?.name || 'Minhas propriedades'}</small>
            <h1 className={styles.title}>Mapa dos talhões</h1>
            <p className={styles.description}>{ready ? plots.length+' talhões · '+area.toLocaleString('pt-BR',{maximumFractionDigits:2})+' '+areaLabel+' mapeados' : 'Carregando áreas…'}</p>
          </div>
          
          {write && <div className={styles.headerActions}>
            <button onClick={() => setIsSelectingLocation(!isSelectingLocation)} className={styles.secondary} disabled={isSaving || drawing || !!boundary}>
              <MapPin size={16} />
              {getButtonText()}
            </button>
            <button className={styles.locationButton} disabled={isSelectingLocation || !!boundary} onClick={()=>setDrawing(!drawing)}><PlusCircle size={17}/>{drawing?'Cancelar desenho':'Desenhar talhão'}</button>
          </div>}
        </div>

        <div className={styles.toolbar}><label><Layers size={16}/> Camada <select disabled={loadingPreference || savingPreference} value={layer} onChange={e=>void savePreference({map_layer:+e.target.value})}><option value={-1}>Cores dos talhões</option>{layers.map((l,i)=><option key={l} value={i}>{l} (simulado)</option>)}</select></label>
          <label>Base <select disabled={loadingPreference || savingPreference} value={base} onChange={e=>void savePreference({base_map:e.target.value})}><option value="satellite">Satélite</option><option value="street">Ruas e estradas</option></select></label>
          {write&&focusedPlot&&!boundary&&<button disabled={drawing||isSelectingLocation} onClick={()=>setBoundary(focusedPlot)}>Editar limite · {focusedPlot.name}</button>}
        </div>
        {message&&<p role="status" className={styles.notice}>{message}</p>}
        {preferenceError && <p role="alert" className={styles.notice}>{preferenceError}</p>}
        {detailField&&<FieldDetails field={detailField} demo={false} close={()=>setDetails('')}/>}
        <div className={styles.mainLayout}>
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <MapIcon size={20} className={styles.sidebarIcon} />
              <h3>{t('mappedAreas')}</h3>
            </div>
            <label className={styles.search}><Search size={16}/><input aria-label="Buscar talhão" placeholder="Buscar talhão" value={search} onChange={e=>setSearch(e.target.value)}/></label>
            
            <div className={styles.plotList}>
              {visible.length === 0 ? (
                <p className={styles.emptyMessage}>{!ready?'Carregando…':search?'Nenhum talhão corresponde à busca.':t('noAreasDrawn')}</p>
              ) : (
                visible.map(plot => (
                  <div key={plot.id} className={`${styles.plotItem} ${focusedPlot?.id === plot.id ? styles.plotItemActive : ''}`}>
                    <button className={styles.plotInfo} onClick={()=>setFocusedPlot({...plot})}>
                      <i style={{background:displayColor(plot)}}/>
                      <span className={styles.plotName}>{plot.name}{activeFarmId === 'all' && ' · ' + (farms.find(f => f.id === plot.farm_id)?.name ?? '')}</span>
                      <span className={styles.plotArea}>{getAreaValue(plot.coordinates, areaUnit)} {areaLabel}</span>
                    </button>
                    
                    <div className={styles.plotActions}>
                      {write && <button onClick={(e) => { e.stopPropagation(); handleOpenEditPlot(plot); }} className={styles.btnEdit} title={'Personalizar '+plot.name}><Palette size={16} /></button>}
                      {write&&<button onClick={(e) => { e.stopPropagation(); handleOpenDelete(plot.id); }} className={styles.btnDelete} title={t('delete')}><Trash2 size={16} /></button>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={`${styles.mapWrapper} ${isSelectingLocation ? styles.mapWrapperSelecting : ''}`}>
            <MapContainer center={home ?? [-14.2,-51.9]} zoom={home?14:4} className={styles.mapElement}>
              {base==='satellite'?<TileLayer key="satellite" url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="&copy; Google Maps" />:
                <TileLayer key="streets" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />}
              <ScaleControl imperial={false} position="bottomleft"/>
              <MapNavigation plots={plots} ready={ready} focused={focusedPlot} home={home} report={setMessage} clearFocus={()=>setFocusedPlot(null)}/>
              <LocationSelector isSelecting={isSelectingLocation} onLocationSelect={handleLocationSelect} />
              {plots.filter(p=>p.id!==boundary?.id).map(plot=>{
                return <Polygon key={plot.id} positions={plot.coordinates} pathOptions={{color:focusedPlot?.id===plot.id?'#ffffff':displayColor(plot),weight:focusedPlot?.id===plot.id?4:2.5,fillColor:displayColor(plot),fillOpacity:.53}}
                  eventHandlers={{click:()=>{if(!drawing&&!isSelectingLocation&&!boundary){setFocusedPlot(plot);setDetails(plot.id);}}}}><Tooltip sticky>{plot.name} · {getAreaValue(plot.coordinates,areaUnit)} {areaLabel}</Tooltip></Polygon>;
              })}
              {boundary&&<BoundaryEditor plot={boundary} cancel={()=>setBoundary(null)} save={async points=>{
                try {
                  const updated=await updatePlot(boundary.id,{coordinates:points.map(({lat,lng})=>({lat,lng}))});
                  setPlots(all=>all.map(p=>p.id===updated.id?updated:p));setFocusedPlot(updated);setBoundary(null);setMessage('Limite atualizado.');fieldData.retry();
                } catch {setMessage('Falha ao salvar o limite. Tente novamente.');}
              }}/>}
              {drawing && write && <DrawPolygon onPolygonCreated={handlePolygonCreated} stop={stopDrawing}/>}
              {drawing && <div className={styles.instructionBanner}>Marque os vértices e clique no primeiro para fechar a área.</div>}
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
                <h3 className={styles.modalTitle} style={{ margin: 0 }}>Personalizar talhão</h3>
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
                    readOnly={!write}
                    onChange={e => setNewPlotName(e.target.value)}
                    onFocus={e => e.target.select()}
                  />
                </div>
                {colorPicker}
                <div className={styles.modalActions}>
                  <button type="button" className={styles.btnCancel} onClick={() => setPlotToEdit(null)} disabled={isEditingPlot}>
                    {t('cancelBtn')}
                  </button>
                  <button type="submit" className={styles.btnSave} disabled={isEditingPlot || !newPlotName.trim()}>
                    {isEditingPlot ? t('saving') : 'Salvar alterações'}
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
                {colorPicker}
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
