import { useEffect } from 'react';
import { getTelegramApp } from './telegram';

function positive(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function useAppViewport(): void {
  useEffect(() => {
    const app = getTelegramApp();
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const properties = ['--app-height', '--app-offset-top', '--native-safe-top', '--native-safe-right', '--native-safe-bottom', '--native-safe-left'];
    const previous = properties.map(name => root.style.getPropertyValue(name));
    const update = () => {
      const browserHeight = positive(viewport?.height) ?? positive(window.innerHeight) ?? 1;
      const nativeHeight = positive(app?.viewportStableHeight);
      // The visual viewport shrinks for keyboards even while native stable height stays fixed.
      const height = nativeHeight ? Math.min(nativeHeight, browserHeight) : browserHeight;
      root.style.setProperty('--app-height', `${height}px`);
      const offset = viewport?.offsetTop;
      root.style.setProperty('--app-offset-top', `${typeof offset === 'number' && Number.isFinite(offset) ? Math.max(0, offset) : 0}px`);
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const inset = Math.max(positive(app?.safeAreaInset?.[side]) ?? 0, positive(app?.contentSafeAreaInset?.[side]) ?? 0);
        root.style.setProperty(`--native-safe-${side}`, `${inset}px`);
      }
    };
    const keepInputVisible = (event?: Event) => {
      const target = event?.type === 'focusin' ? event.target : document.activeElement;
      if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) {
        target.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      }
    };
    const resize = () => { update(); keepInputVisible(); };
    update();
    const events = ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged'];
    for (const event of events) app?.onEvent?.(event, update);
    window.addEventListener('resize', resize);
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    document.addEventListener('focusin', keepInputVisible);
    return () => {
      for (const event of events) app?.offEvent?.(event, update);
      window.removeEventListener('resize', resize);
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      document.removeEventListener('focusin', keepInputVisible);
      properties.forEach((name, index) => previous[index] ? root.style.setProperty(name, previous[index]) : root.style.removeProperty(name));
    };
  }, []);
}
