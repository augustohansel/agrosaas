import { useCallback, useEffect, useRef, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { LocateFixed, Scan } from "lucide-react";
import type { Plot } from "../../features/plots/services/api";
import styles from "./styles.module.css";

export function MapNavigation({ plots, ready, focused, home, report, clearFocus }: {
  plots: Plot[]; ready: boolean; focused: Plot | null; home: [number, number] | null;
  report: (message: string) => void; clearFocus: () => void;
}) {
  const map = useMap();
  const initialized = useRef(false);
  const request = useRef(0);
  const [locating, setLocating] = useState(false);
  const locate = useCallback(() => {
    if (!navigator.geolocation) { report("A localização está indisponível neste navegador."); return; }
    const token = ++request.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (token !== request.current) return;
      setLocating(false);
      map.setView([position.coords.latitude, position.coords.longitude], 15);
      report("Mapa centralizado na sua localização.");
    }, err => {
      if (token !== request.current) return;
      setLocating(false);
      report(err.code === 1 ? "Acesso à localização desativado. Você pode navegar pelo mapa." : "Não foi possível localizar o dispositivo.");
    }, { timeout: 10000, maximumAge: 60000 });
  }, [map, report]);
  const fit = useCallback(() => {
    const bounds = L.latLngBounds([]);
    for (const plot of plots) if (plot.coordinates?.length) bounds.extend(L.latLngBounds(plot.coordinates));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 17 });
    return bounds.isValid();
  }, [map, plots]);
  useEffect(() => {
    function cancel() { request.current++; setLocating(false); }
    map.on("mousedown dragstart zoomstart draw:drawstart", cancel);
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => { initialized.current = false; request.current++; observer.disconnect(); map.off("mousedown dragstart zoomstart draw:drawstart", cancel); };
  }, [map]);
  useEffect(() => {
    if (!ready || initialized.current) return;
    initialized.current = true;
    if (focused || fit()) return;
    if (home) map.setView(home, 14);
    else locate();
  }, [ready, focused, fit, home, locate, map]);
  useEffect(() => {
    if (focused?.coordinates.length) {
      request.current++;
      setLocating(false);
      map.fitBounds(L.latLngBounds(focused.coordinates), { padding: [44, 44], maxZoom: 18 });
    }
  }, [focused, map]);
  return <div className={styles.camera} ref={node => { if (node) L.DomEvent.disableClickPropagation(node); }}>
    <button type="button" disabled={!plots.length} title="Enquadrar todos os talhões" onClick={() => {
      request.current++; setLocating(false); clearFocus(); fit();
    }}><Scan size={16}/>Talhões</button>
    <button type="button" onClick={locate} disabled={locating}><LocateFixed size={16}/>{locating ? "Localizando…" : "Minha localização"}</button>
  </div>;
}
