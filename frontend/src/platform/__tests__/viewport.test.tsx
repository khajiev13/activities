// @vitest-environment jsdom
import type { TelegramApp } from '@/platform/telegram';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTelegramApp } from '../telegram';
import { useAppViewport } from '../useAppViewport';
const telegramWindow = window as Window & { Telegram?: { WebApp: TelegramApp } };
vi.mock('@/api/authApi', () => ({ isInTelegram: () => Boolean(telegramWindow.Telegram) }));
function Viewport() { useAppViewport(); return <input aria-label="Search" />; }
const value = (name: string) => document.documentElement.style.getPropertyValue(name);
beforeEach(() => { delete telegramWindow.Telegram; document.documentElement.removeAttribute('style'); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); delete telegramWindow.Telegram; });
describe('Telegram UI capability adapter', () => {
  it('is absent outside Telegram and never exposes authentication fields', () => {
    expect(getTelegramApp()).toBeUndefined();
    const native = { colorScheme: 'dark', initData: 'synthetic-test-value', unrelatedCapability: true };
    telegramWindow.Telegram = { WebApp: native };
    expect(getTelegramApp()?.colorScheme).toBe('dark');
    expect(Object.keys(getTelegramApp()!)).not.toContain('initData');
    expect(Object.keys(getTelegramApp()!)).not.toContain('unrelatedCapability');
  });
});
describe('app viewport', () => {
  it('uses stable height, maximum safe-area insets, updates and removes native listeners', () => {
    const listeners = new Map<string, () => void>(); const offEvent = vi.fn();
    const app = { viewportStableHeight: 600, safeAreaInset: { top: 24, bottom: 20 }, contentSafeAreaInset: { top: 40, bottom: 12 },
      onEvent: (name: string, cb: () => void) => listeners.set(name, cb), offEvent };
    telegramWindow.Telegram = { WebApp: app }; const view = render(<Viewport />);
    expect(value('--app-height')).toBe('600px'); expect(value('--native-safe-top')).toBe('40px'); expect(value('--native-safe-bottom')).toBe('20px');
    app.viewportStableHeight = 480; act(() => listeners.get('viewportChanged')?.()); expect(value('--app-height')).toBe('480px');
    app.contentSafeAreaInset.top = 48; act(() => listeners.get('contentSafeAreaChanged')?.()); expect(value('--native-safe-top')).toBe('48px');
    view.unmount();
    for (const name of ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged']) expect(offEvent).toHaveBeenCalledWith(name, listeners.get(name));
    expect(value('--app-height')).toBe('');
  });
  it('falls back to finite browser dimensions for zero, negative or non-finite native heights', () => {
    const listeners = new Map<string, () => void>();
    const app = { viewportStableHeight: 0, onEvent: (name: string, cb: () => void) => listeners.set(name, cb) };
    telegramWindow.Telegram = { WebApp: app }; render(<Viewport />);
    for (const height of [0, -1, NaN, Infinity, 120]) { app.viewportStableHeight = height; act(() => listeners.get('viewportChanged')?.());
      const pixels = Number.parseFloat(value('--app-height')); expect(Number.isFinite(pixels)).toBe(true); expect(pixels).toBeGreaterThan(0);
    }
  });
  it('follows the visual viewport and keeps focused inputs visible without leaking listeners', () => {
    const viewport = new EventTarget(); Object.assign(viewport, { height: 420, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
    const remove = vi.spyOn(viewport, 'removeEventListener'); const scroll = vi.fn();
    const view = render(<Viewport />); const input = view.getByRole('textbox'); input.scrollIntoView = scroll;
    fireEvent.focusIn(input); act(() => viewport.dispatchEvent(new Event('resize')));
    expect(value('--app-height')).toBe('420px');
    Object.assign(viewport, { height: 250, offsetTop: 95 }); act(() => viewport.dispatchEvent(new Event('scroll')));
    expect(value('--app-height')).toBe('250px'); expect(value('--app-offset-top')).toBe('95px');
    Object.assign(viewport, { offsetTop: -10 }); act(() => viewport.dispatchEvent(new Event('resize'))); expect(value('--app-offset-top')).toBe('0px');
    expect(scroll).toHaveBeenCalled(); view.unmount();
    expect(value('--app-offset-top')).toBe('');
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function)); expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  });
});
