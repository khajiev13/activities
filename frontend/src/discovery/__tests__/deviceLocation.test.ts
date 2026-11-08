// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestDeviceLocation } from '../deviceLocation';
import type { TelegramApp } from '@/platform/telegram';
const native = vi.hoisted(() => ({ app: undefined as TelegramApp | undefined }));
vi.mock('@/platform/telegram', () => ({ getTelegramApp: () => native.app }));
let success: PositionCallback; let failure: PositionErrorCallback | null | undefined;
const browser = vi.fn((ok: PositionCallback, fail?: PositionErrorCallback | null) => { success = ok; failure = fail; });
beforeEach(() => { vi.useFakeTimers(); native.app = undefined; browser.mockClear(); Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: browser } }); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const position = { coords: { latitude: 12, longitude: 34, accuracy: 100 } } as GeolocationPosition;
describe('one-shot device location', () => {
  it('returns one browser fix using bounded normal accuracy', async () => {
    const result = requestDeviceLocation(); success(position); expect(await result).toEqual({ latitude: 12, longitude: 34, accuracy: 100 });
    expect(browser).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), expect.objectContaining({ timeout: 8000, enableHighAccuracy: false })); expect(browser).toHaveBeenCalledTimes(1);
  });
  it.each([[1, 'NotAllowedError'], [2, 'NotSupportedError'], [3, 'TimeoutError']])('maps browser error %s', async (code, name) => {
    const result = requestDeviceLocation(); failure?.({ code } as GeolocationPositionError); await expect(result).rejects.toHaveProperty('name', name);
  });
  it('rejects unsupported devices without prompting', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined }); await expect(requestDeviceLocation()).rejects.toHaveProperty('name', 'NotSupportedError');
  });
  it('bounds a browser that never calls back', async () => {
    const result = requestDeviceLocation(); const rejection = expect(result).rejects.toHaveProperty('name', 'TimeoutError'); await vi.advanceTimersByTimeAsync(8000); await rejection;
  });
  it('aborts pending fixes and ignores late browser callbacks', async () => {
    const controller = new AbortController(); const result = requestDeviceLocation(controller.signal); controller.abort(); success(position); await expect(result).rejects.toHaveProperty('name', 'AbortError');
  });
  it('rejects invalid coordinates', async () => {
    const result = requestDeviceLocation(); success({ coords: { latitude: Infinity, longitude: 34 } } as GeolocationPosition); await expect(result).rejects.toHaveProperty('name', 'NotSupportedError');
  });
  it('initializes supported Telegram before availability and requests one fix', async () => {
    let init: (() => void) | undefined;
    const manager = { isLocationAvailable: false, init: vi.fn((cb?: () => void) => { init = cb; }), getLocation: vi.fn((cb: (value: { latitude: number; longitude: number; horizontal_accuracy: number }) => void) => cb({ latitude: 12, longitude: 34, horizontal_accuracy: 80 })) };
    native.app = { isVersionAtLeast: vi.fn(() => true), LocationManager: manager }; const result = requestDeviceLocation(); expect(manager.getLocation).not.toHaveBeenCalled(); manager.isLocationAvailable = true; init?.();
    expect(await result).toEqual({ latitude: 12, longitude: 34, accuracy: 80 }); expect(native.app.isVersionAtLeast).toHaveBeenCalledWith('8.0'); expect(browser).not.toHaveBeenCalled();
  });
  it('treats null native callback as denial without a second browser prompt', async () => {
    native.app = { isVersionAtLeast: () => true, LocationManager: { isInited: true, isLocationAvailable: true, init: vi.fn(), getLocation: cb => cb(null) } };
    await expect(requestDeviceLocation()).rejects.toHaveProperty('name', 'NotAllowedError'); expect(browser).not.toHaveBeenCalled();
  });
  it('does not request native location when unavailable', async () => {
    const getLocation = vi.fn(); native.app = { isVersionAtLeast: () => true, LocationManager: { isInited: true, isLocationAvailable: false, init: vi.fn(), getLocation } };
    await expect(requestDeviceLocation()).rejects.toHaveProperty('name', 'NotSupportedError'); expect(getLocation).not.toHaveBeenCalled(); expect(browser).not.toHaveBeenCalled();
  });
  it('uses browser fallback on older Telegram versions', async () => {
    const init = vi.fn(); native.app = { isVersionAtLeast: () => false, LocationManager: { init, getLocation: vi.fn() } }; const result = requestDeviceLocation(); success(position); await result; expect(init).not.toHaveBeenCalled();
  });
  it('bounds native initialization and rejects pre-aborted requests before prompting', async () => {
    const init = vi.fn(); native.app = { isVersionAtLeast: () => true, LocationManager: { init, getLocation: vi.fn() } }; const result = requestDeviceLocation(); const rejection = expect(result).rejects.toHaveProperty('name', 'TimeoutError'); await vi.advanceTimersByTimeAsync(8000); await rejection;
    const controller = new AbortController(); controller.abort(); await expect(requestDeviceLocation(controller.signal)).rejects.toHaveProperty('name', 'AbortError'); expect(init).toHaveBeenCalledTimes(1);
  });
});
