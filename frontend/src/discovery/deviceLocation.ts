import { getTelegramApp } from '@/platform/telegram';

export type DevicePosition = { latitude: number; longitude: number; accuracy?: number };

// One fix per explicit action. Native denial never starts a second browser prompt.
export function requestDeviceLocation(signal?: AbortSignal): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Location cancelled', 'AbortError')); return; }
    let finished = false;
    const finish = (position?: DevicePosition, error?: DOMException) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else if (position && Number.isFinite(position.latitude) && Math.abs(position.latitude) <= 90 && Number.isFinite(position.longitude) && Math.abs(position.longitude) <= 180) {
        const { latitude, longitude, accuracy } = position;
        resolve({ latitude, longitude, ...(accuracy !== undefined && Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy } : {}) });
      } else reject(new DOMException('Location unavailable', 'NotSupportedError'));
    };
    const abort = () => finish(undefined, new DOMException('Location cancelled', 'AbortError'));
    const timeout = setTimeout(() => finish(undefined, new DOMException('Location timed out', 'TimeoutError')), 8000);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const app = getTelegramApp();
      const manager = app?.isVersionAtLeast?.('8.0') ? app.LocationManager : undefined;
      if (manager) {
        const locate = () => {
          if (finished) return;
          if (!manager.isLocationAvailable) { finish(undefined, new DOMException('Location unavailable', 'NotSupportedError')); return; }
          try {
            manager.getLocation(location => {
              if (!location) finish(undefined, new DOMException('Location permission denied', 'NotAllowedError'));
              else finish({ latitude: location.latitude, longitude: location.longitude, accuracy: location.horizontal_accuracy });
            });
          } catch { finish(undefined, new DOMException('Location unavailable', 'NotSupportedError')); }
        };
        if (manager.isInited) locate(); else manager.init(locate);
      } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          position => finish({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
          error => finish(undefined, new DOMException('Could not get location', error.code === 1 ? 'NotAllowedError' : error.code === 3 ? 'TimeoutError' : 'NotSupportedError')),
          { timeout: 8000, enableHighAccuracy: false, maximumAge: 60000 },
        );
      } else finish(undefined, new DOMException('Location unavailable', 'NotSupportedError'));
    } catch { finish(undefined, new DOMException('Location unavailable', 'NotSupportedError')); }
  });
}
