import { isInTelegram } from '@/api/authApi';

export type TelegramInsets = Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
export type TelegramLocation = { latitude: number; longitude: number; altitude?: number; course?: number; speed?: number; horizontal_accuracy?: number };
export type TelegramApp = {
  colorScheme?: string;
  viewportStableHeight?: number;
  safeAreaInset?: TelegramInsets;
  contentSafeAreaInset?: TelegramInsets;
  onEvent?: (event: string, callback: () => void) => void;
  offEvent?: (event: string, callback: () => void) => void;
  BackButton?: { show: () => void; hide: () => void; onClick: (callback: () => void) => void; offClick: (callback: () => void) => void };
  isVersionAtLeast?: (version: string) => boolean;
  LocationManager?: {
    isInited?: boolean; isLocationAvailable?: boolean; isAccessRequested?: boolean; isAccessGranted?: boolean;
    init: (callback?: () => void) => void;
    getLocation: (callback: (location: TelegramLocation | null) => void) => void;
    openSettings?: () => void;
  };
};

// Return a capability facade, never the raw WebApp object or its launch data.
// Getters keep event-driven native values current without copying other fields.
export function getTelegramApp(): TelegramApp | undefined {
  if (typeof window === 'undefined' || !isInTelegram()) return undefined;
  const app = (window as Window & { Telegram?: { WebApp?: TelegramApp } }).Telegram?.WebApp;
  if (!app) return undefined;
  return {
    get colorScheme() { return app.colorScheme; },
    get viewportStableHeight() { return app.viewportStableHeight; },
    get safeAreaInset() { return app.safeAreaInset; },
    get contentSafeAreaInset() { return app.contentSafeAreaInset; },
    onEvent: app.onEvent?.bind(app),
    offEvent: app.offEvent?.bind(app),
    BackButton: app.BackButton,
    LocationManager: app.LocationManager,
    isVersionAtLeast: app.isVersionAtLeast?.bind(app),
  };
}
