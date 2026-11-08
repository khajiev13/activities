import { useRef, useEffect } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
interface BaseMapProps {
  onMapLoad: (map: maptilersdk.Map) => void;
  onMapError?: () => void;
  center?: [number, number]; zoom?: number;
}
export default function BaseMap({ onMapLoad, onMapError, center = [0, 20], zoom = 2 }: BaseMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onMapLoad, onMapError }); callbacks.current = { onMapLoad, onMapError };
  const initial = useRef({ center, zoom });
  useEffect(() => {
    if (!container.current) return;
    maptilersdk.config.apiKey = import.meta.env.VITE_MAPTILER_KEY;
    let map: maptilersdk.Map;
    const style = () => document.documentElement.classList.contains('dark') ? maptilersdk.MapStyle.BASIC.DARK : maptilersdk.MapStyle.BASIC.LIGHT;
    try { map = new maptilersdk.Map({ container: container.current, style: style(), ...initial.current, navigationControl: false, fullscreenControl: false, geolocateControl: false }); }
    catch { callbacks.current.onMapError?.(); return; }
    const error = () => callbacks.current.onMapError?.();
    map.on('error', error);
    // Existing callers install style/load handlers themselves; retain the immediate callback contract.
    callbacks.current.onMapLoad(map);
    const resize = () => map.resize();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    observer?.observe(container.current); window.addEventListener('resize', resize);
    const theme = new MutationObserver(() => map.setStyle(style()));
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { theme.disconnect(); observer?.disconnect(); window.removeEventListener('resize', resize); map.off('error', error); map.remove(); };
  }, []);
  return <div ref={container} className="discovery-map-canvas map" aria-label="City results map" />;
}
