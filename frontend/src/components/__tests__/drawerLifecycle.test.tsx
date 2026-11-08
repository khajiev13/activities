// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { cleanupVaul } from '@/test/cleanupVaul';

beforeEach(() => { vi.useFakeTimers(); window.scrollTo = vi.fn(); });
afterEach(async () => { cleanup(); await vi.advanceTimersByTimeAsync(516); vi.useRealTimers(); vi.restoreAllMocks(); });
it('executes the real delayed Vaul position callback before the jsdom fixture is released', async () => {
  const scheduledAt: number[] = []; const liveDocument: boolean[] = []; const start = Date.now();
  const originalFrame = globalThis.requestAnimationFrame;
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(callback => {
    scheduledAt.push(Date.now() - start);
    return originalFrame(time => { liveDocument.push(Boolean(document.body)); callback(time); });
  });
  render(<Drawer open><DrawerContent><DrawerTitle>Lifecycle fixture</DrawerTitle><DrawerDescription>Real modal lifecycle</DrawerDescription></DrawerContent></Drawer>);
  expect(document.body.style.position).toBe('fixed');
  await cleanupVaul();
  // Vaul 0.8.9 schedules this frame from its uncancelled 300ms position timer.
  expect(scheduledAt).toContain(300);
  expect(liveDocument.length).toBeGreaterThanOrEqual(2);
  expect(liveDocument.every(Boolean)).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  expect(document.body.style.position).not.toBe('fixed');
});
