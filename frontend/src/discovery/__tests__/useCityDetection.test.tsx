// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCityDetection } from '../useCityDetection';
import { requestDeviceLocation } from '../deviceLocation';
import { resolveCity } from '../resolveCity';
vi.mock('../deviceLocation', () => ({ requestDeviceLocation: vi.fn() })); vi.mock('../resolveCity', () => ({ resolveCity: vi.fn() }));
const city = { country: 'France', state: 'Île-de-France', city: 'Paris' }; const position = { latitude: 12, longitude: 34 };
beforeEach(() => { vi.resetAllMocks(); }); afterEach(cleanup);
describe('city detection lifecycle', () => {
  it('does not prompt on mount, reports stages and selects only a resolved city', async () => {
    let fix!: (value: typeof position) => void; let found!: (value: typeof city) => void; vi.mocked(requestDeviceLocation).mockImplementation(() => new Promise(resolve => { fix = resolve; })); vi.mocked(resolveCity).mockImplementation(() => new Promise(resolve => { found = resolve; }));
    const select = vi.fn(); const { result } = renderHook(() => useCityDetection([city], select)); expect(result.current.status).toBe('idle'); expect(requestDeviceLocation).not.toHaveBeenCalled(); act(() => result.current.detect()); expect(result.current.status).toBe('locating'); await act(async () => fix(position)); expect(result.current.status).toBe('resolving'); await act(async () => found(city)); expect(select).toHaveBeenCalledWith(city); expect(result.current.status).toBe('idle');
  });
  it.each([['NotAllowedError', 'denied'], ['NotSupportedError', 'unavailable'], ['TimeoutError', 'error'], ['Error', 'error']])('maps %s to %s without selecting', async (name, status) => {
    vi.mocked(requestDeviceLocation).mockRejectedValue(new DOMException('Failure', name)); const select = vi.fn(); const { result } = renderHook(() => useCityDetection([city], select)); await act(async () => result.current.detect()); expect(result.current.status).toBe(status); expect(select).not.toHaveBeenCalled();
  });
  it('reports unmatched without changing selection', async () => {
    vi.mocked(requestDeviceLocation).mockResolvedValue(position); vi.mocked(resolveCity).mockResolvedValue(null); const select = vi.fn(); const { result } = renderHook(() => useCityDetection([city], select)); await act(async () => result.current.detect()); expect(result.current.status).toBe('unmatched'); expect(select).not.toHaveBeenCalled();
  });
  it.each(['cancel', 'unmount', 'retry'])('ignores stale results after %s when external work ignores abort', async (action) => {
    vi.mocked(requestDeviceLocation).mockResolvedValue(position); let found!: (value: typeof city) => void; vi.mocked(resolveCity).mockImplementation(() => new Promise(resolve => { found = resolve; })); const select = vi.fn(); const { result, unmount } = renderHook(() => useCityDetection([city], select)); await act(async () => result.current.detect()); const old = found; const signal = vi.mocked(resolveCity).mock.calls[0][2];
    act(() => { if (action === 'unmount') unmount(); else if (action === 'cancel') result.current.cancel(); else result.current.detect(); }); expect(signal?.aborted).toBe(true); await act(async () => old(city)); expect(select).not.toHaveBeenCalled();
  });
});
