import { getTelegramApp } from '@/platform/telegram';
import { DiscoveryPreferenceSchema } from './place';
import type { DiscoveryPreference } from './place';

const storageKey = 'eventopia.discovery.v1';
const nativeTimeout = 1500;
let mirror: DiscoveryPreference | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

type ReadResult = { preference: DiscoveryPreference | null; warning: boolean };

function parsePreference(value: string | null | undefined): DiscoveryPreference | null {
  if (!value) return null;
  try {
    const parsed = DiscoveryPreferenceSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

function readLocal(): ReadResult {
  try { return { preference: parsePreference(window.localStorage.getItem(storageKey)), warning: false }; }
  catch { return { preference: null, warning: true }; }
}

function latest(...preferences: (DiscoveryPreference | null)[]): DiscoveryPreference | null {
  return preferences.reduce<DiscoveryPreference | null>((current, candidate) => candidate && (!current || candidate.updatedAt > current.updatedAt) ? candidate : current, null);
}

function nativeStorage() {
  const app = getTelegramApp();
  return app?.isVersionAtLeast?.('9.0') ? app.DeviceStorage : undefined;
}

// Native callbacks may never arrive, or arrive after timeout/cancellation.
// They only settle this operation and never write the local mirror.
function nativeCall<T>(run: (finish: (error: string | null, value?: T) => void) => void, signal?: AbortSignal): Promise<{ value?: T; warning: boolean }> {
  return new Promise(resolve => {
    if (signal?.aborted) { resolve({ warning: false }); return; }
    let finished = false;
    const finish = (warning: boolean, value?: T) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      resolve({ value, warning });
    };
    const abort = () => finish(false);
    const timeout = setTimeout(() => finish(true), nativeTimeout);
    signal?.addEventListener('abort', abort, { once: true });
    try { run((error, value) => finish(Boolean(error), value)); }
    catch { finish(true); }
  });
}

export function readCachedDiscoveryPreference(): ReadResult {
  const local = readLocal();
  return { preference: latest(mirror, local.preference), warning: local.warning };
}

export async function readDiscoveryPreference(signal?: AbortSignal): Promise<ReadResult> {
  const local = readLocal();
  let stored: DiscoveryPreference | null = null;
  let warning = local.warning;
  try {
    const storage = nativeStorage();
    if (storage && !signal?.aborted) {
      const result = await nativeCall<string>((finish) => storage.getItem(storageKey, finish), signal);
      warning ||= result.warning;
      if (!result.warning && !signal?.aborted) stored = parsePreference(result.value);
    }
  } catch { warning = true; }
  // Re-read after native work: a manual selection can have been saved meanwhile.
  const current = readLocal();
  return { preference: latest(mirror, current.preference, local.preference, stored), warning: warning || current.warning };
}

export function writeDiscoveryPreference(preference: DiscoveryPreference): Promise<{ warning: boolean }> {
  const parsed = DiscoveryPreferenceSchema.safeParse(preference);
  if (!parsed.success) return Promise.resolve({ warning: true });
  const value = parsed.data;
  mirror = value;
  const serialized = JSON.stringify(value);
  let warning = false;
  // Browser state is visible before waiting for any queued native operation.
  try { window.localStorage.setItem(storageKey, serialized); }
  catch { warning = true; }
  const controller = new AbortController();
  const deadline = Date.now() + nativeTimeout;
  return new Promise(resolve => {
    let finished = false;
    const finish = (result: { warning: boolean }) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      resolve(result);
    };
    // Queue wait counts toward the caller's deadline too. Expired queued work
    // is skipped; an in-flight callback can never change the browser mirror.
    const timeout = setTimeout(() => { controller.abort(); finish({ warning: true }); }, nativeTimeout);
    const pending = writeQueue.then(async () => {
      if (controller.signal.aborted || Date.now() >= deadline) return { warning: true };
      try {
        const storage = nativeStorage();
        if (storage) {
          const result = await nativeCall<boolean>(finish => storage.setItem(storageKey, serialized, finish), controller.signal);
          return { warning: warning || result.warning || controller.signal.aborted || result.value === false };
        }
        return { warning };
      } catch { return { warning: true }; }
    });
    writeQueue = pending;
    void pending.then(finish);
  });
}
