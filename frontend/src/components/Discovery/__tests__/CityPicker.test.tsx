// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CityPicker } from '../CityPicker';
import { requestDeviceLocation } from '@/discovery/deviceLocation';
import { resolveCity } from '@/discovery/resolveCity';
vi.mock('@/discovery/deviceLocation', () => ({ requestDeviceLocation: vi.fn() }));
vi.mock('@/discovery/resolveCity', () => ({ resolveCity: vi.fn() }));
const countries = [{ name: 'France', states: [{ name: 'Île-de-France', cities: [{ name: 'Paris' }] }] }, { name: 'Other', states: [{ name: 'North', cities: [{ name: 'Paris' }] }] }];
const city = { country: 'France', state: 'Île-de-France', city: 'Paris' };
const props = () => ({ open: true, onOpenChange: vi.fn(), countries, loading: false, error: null, value: { level: 'city' as const, ...city }, onSelect: vi.fn(), onRetry: vi.fn() });
beforeEach(() => { vi.resetAllMocks(); }); afterEach(cleanup);
describe('city picker', () => {
  it('offers explicit optional location with adjacent provider disclosure and no prompt on mount', () => {
    render(<CityPicker {...props()} />); expect(screen.getByRole('dialog')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Use my location' })).toBeTruthy(); expect(screen.getByText(/GeoNames receives/)).toBeTruthy(); expect(requestDeviceLocation).not.toHaveBeenCalled();
  });
  it('searches disambiguated city labels and selects exact parents', () => {
    const p = props(); render(<CityPicker {...p} />); const search = screen.getByRole('textbox', { name: 'Search cities' });
    fireEvent.change(search, { target: { value: 'North' } }); expect(screen.queryByRole('button', { name: 'Paris, Île-de-France, France' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Paris, North, Other' })); expect(p.onSelect).toHaveBeenCalledWith({ level: 'city', country: 'Other', state: 'North', city: 'Paris' }); expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });
  it('retains explicit country and state alternatives including countries without cities', () => {
    const p = props(); render(<CityPicker {...p} countries={[...countries, { name: 'Empty', states: [] }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse France' })); expect(p.onSelect).toHaveBeenCalledWith({ level: 'country', country: 'France' });
    fireEvent.click(screen.getByRole('button', { name: 'Browse Île-de-France, France' })); expect(p.onSelect).toHaveBeenCalledWith({ level: 'state', country: 'France', state: 'Île-de-France' }); expect(screen.getByRole('button', { name: 'Browse Empty' })).toBeTruthy();
  });
  it('shows hierarchy loading/error and retries without prompting location', () => {
    const p = props(); const view = render(<CityPicker {...p} loading />); expect(screen.getByRole('status').textContent).toMatch(/Loading/);
    view.rerender(<CityPicker {...p} error="Offline" />); expect(screen.getByRole('alert').textContent).toContain('Offline'); fireEvent.click(screen.getByRole('button', { name: 'Retry cities' })); expect(p.onRetry).toHaveBeenCalledOnce(); expect(requestDeviceLocation).not.toHaveBeenCalled();
  });
  it('keeps manual choices available during detection and prevents stale override', async () => {
    let fix!: (value: { latitude: number; longitude: number }) => void; vi.mocked(requestDeviceLocation).mockImplementation(() => new Promise(resolve => { fix = resolve; })); vi.mocked(resolveCity).mockResolvedValue(city);
    const p = props(); render(<CityPicker {...p} />); fireEvent.click(screen.getByRole('button', { name: 'Use my location' })); expect(screen.getByRole('status').textContent).toMatch(/location/);
    fireEvent.click(screen.getByRole('button', { name: 'Paris, North, Other' })); expect(vi.mocked(requestDeviceLocation).mock.calls[0][0]?.aborted).toBe(true);
    await act(async () => fix({ latitude: 12, longitude: 34 })); expect(p.onSelect).toHaveBeenCalledTimes(1); expect(p.onSelect).toHaveBeenLastCalledWith({ level: 'city', country: 'Other', state: 'North', city: 'Paris' });
  });
  it.each(['close', 'unmount', 'retry'])('cancels detection on %s', async (action) => {
    vi.mocked(requestDeviceLocation).mockImplementation(() => new Promise(() => {})); const p = props(); const view = render(<CityPicker {...p} error={action === 'retry' ? 'Offline' : null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' })); const signal = vi.mocked(requestDeviceLocation).mock.calls[0][0];
    if (action === 'unmount') view.unmount(); else if (action === 'close') fireEvent.click(screen.getByRole('button', { name: 'Close' })); else fireEvent.click(screen.getByRole('button', { name: 'Retry cities' }));
    expect(signal?.aborted).toBe(true);
  });
  it('announces denial and unmatched area while preserving the selection', async () => {
    vi.mocked(requestDeviceLocation).mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError')).mockResolvedValueOnce({ latitude: 12, longitude: 34 }); vi.mocked(resolveCity).mockResolvedValue(null);
    const p = props(); render(<CityPicker {...p} />); fireEvent.click(screen.getByRole('button', { name: 'Use my location' })); await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/denied/i)); expect(p.onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Use my location' })); await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/choose a city/i)); expect(p.onSelect).not.toHaveBeenCalled();
  });
  it('restores focus to the opener when the controlled picker closes', async () => {
    const p = props(); const opener = document.createElement('button'); document.body.append(opener); opener.focus(); const view = render(<CityPicker {...p} />);
    view.rerender(<CityPicker {...p} open={false} />); await waitFor(() => expect(document.activeElement).toBe(opener)); opener.remove();
  });
});
