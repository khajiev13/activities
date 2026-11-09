import { act, cleanup } from '@testing-library/react';
import { vi } from 'vitest';

export async function cleanupVaul() {
  cleanup();
  // Vaul 0.8.9 leaves a 300ms usePositionFixed timeout after unmount. Its
  // closeDrawer callbacks run at 300/500ms; position restoration queues a frame.
  // Execute those real callbacks with a live DOM, then release the fake clock.
  // Nothing is cancelled or swallowed: unknown longer-lived timers fail cleanup.
  await act(async () => { await vi.advanceTimersByTimeAsync(500 + 16); });
  if (vi.getTimerCount() !== 0) throw new Error('Unexpected pending timers after Vaul cleanup');
}
