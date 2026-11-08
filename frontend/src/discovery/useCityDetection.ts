import { useCallback, useEffect, useRef, useState } from 'react';
import { requestDeviceLocation } from './deviceLocation';
import { resolveCity } from './resolveCity';
import type { CityOption } from './types';

export type CityDetectionStatus = 'idle' | 'locating' | 'resolving' | 'denied' | 'unavailable' | 'unmatched' | 'error';

export function useCityDetection(cities: CityOption[], onSelect: (city: CityOption) => void) {
  const [status, setStatus] = useState<CityDetectionStatus>('idle');
  const active = useRef<AbortController | null>(null);
  const cancel = useCallback(() => { active.current?.abort(); active.current = null; setStatus('idle'); }, []);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  const detect = useCallback(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setStatus('locating');
    const current = () => active.current === controller && !controller.signal.aborted;
    void (async () => {
      try {
        const position = await requestDeviceLocation(controller.signal);
        if (!current()) return;
        setStatus('resolving');
        const city = await resolveCity(position, cities, controller.signal);
        if (!current()) return;
        active.current = null;
        setStatus(city ? 'idle' : 'unmatched');
        if (city) onSelect(city);
      } catch (error) {
        if (!current()) return;
        active.current = null;
        const name = error && typeof error === 'object' && 'name' in error ? error.name : '';
        setStatus(name === 'NotAllowedError' ? 'denied' : name === 'NotSupportedError' ? 'unavailable' : 'error');
      }
    })();
  }, [cities, onSelect]);
  return { status, detect, cancel };
}
