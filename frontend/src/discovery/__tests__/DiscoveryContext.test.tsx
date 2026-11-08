// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Link, useLocation } from 'react-router-dom';
import { DiscoveryProvider, useDiscovery } from '../DiscoveryContext';
import { fetchCountries, fetchResults } from '../api';
import type { DiscoveryResults } from '../types';
vi.mock('../api', () => ({ fetchCountries: vi.fn(), fetchResults: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function Probe() {
  const d = useDiscovery(); const loc = useLocation();
  return <><output>{d.state.entity}:{d.state.query}:{d.results.teams.map(t => t.name).join(',')}</output><output>{loc.search}</output>
    <output>{d.countriesError ?? d.countries.length}</output><button onClick={d.retryCountries}>Retry catalogue</button>
    <button onClick={() => d.setState(s => ({ ...s, query: 'new' }))}>Search</button>
    <Link to={'/teams?' + d.searchForDestination('teams')}>Teams</Link><Link to={'/map?' + d.searchForDestination()}>Explore</Link></>;
}
function mount(path = '/map?level=city&country=UK&state=England&city=Cambridge&entity=activities&view=list&q=old') { return render(<MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><Probe /></DiscoveryProvider></MemoryRouter>); }
it('restores URL state, canonicalizes directory entity, and remembers Explore context', async () => {
  vi.mocked(fetchCountries).mockResolvedValue([]); vi.mocked(fetchResults).mockResolvedValue({ activities: [], teams: [], organizations: [] });
  mount(); expect(screen.getByText('activities:old:')).toBeTruthy();
  fireEvent.click(screen.getByText('Teams')); await waitFor(() => expect(screen.getByText('teams:old:')).toBeTruthy());
  fireEvent.click(screen.getByText('Search')); await waitFor(() => expect(screen.getByText('teams:new:')).toBeTruthy());
  fireEvent.click(screen.getByText('Explore')); await waitFor(() => expect(screen.getByText('activities:old:')).toBeTruthy());
});
it('ignores a slower response after the search context changes', async () => {
  vi.mocked(fetchCountries).mockResolvedValue([]);
  let finish: (value: DiscoveryResults) => void = () => {};
  vi.mocked(fetchResults).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ activities: [], teams: [], organizations: [] });
  mount(); fireEvent.click(screen.getByText('Search'));
  await waitFor(() => expect(screen.getByText('activities:new:')).toBeTruthy());
  await act(async () => finish({ activities: [], organizations: [], teams: [{ name: 'stale' }] as DiscoveryResults['teams'] }));
  expect(screen.queryByText(/stale/)).toBeNull();
});

it('retries the shared country catalogue after failure', async () => {
  vi.mocked(fetchCountries).mockRejectedValueOnce(new Error('offline')).mockResolvedValue([{ name: 'UK', states: [] }]);
  vi.mocked(fetchResults).mockResolvedValue({ activities: [], teams: [], organizations: [] });
  mount(); expect(await screen.findByText(/Could not load available cities/)).toBeTruthy();
  fireEvent.click(screen.getByText('Retry catalogue')); expect(await screen.findByText('1')).toBeTruthy();
});

it('treats a trailing-slash directory URL as its canonical entity', async () => {
  vi.mocked(fetchCountries).mockResolvedValue([]);
  mount('/teams/?entity=activities&q=football&view=map');
  expect(await screen.findByText('teams:football:')).toBeTruthy();
});

it.each(['geography', 'entity', 'search'] as const)('retains selection across view/detail/login and clears it permanently for changed %s', async context => {
  vi.mocked(fetchCountries).mockResolvedValue([]); vi.mocked(fetchResults).mockResolvedValue({ activities: [], teams: [], organizations: [] });
  const original = '/map?level=city&country=UK&state=England&city=Cambridge&entity=activities&view=map&q=old';
  function SelectionProbe() {
    const d = useDiscovery();
    return <><output aria-label="Selection">{d.selected ?? 'none'}</output>
      <button onClick={() => d.setSelected('activity/one')}>Select pin</button>
      <button onClick={() => d.setState(s => ({ ...s, view: s.view === 'map' ? 'list' : 'map' }))}>Toggle view</button>
      <button onClick={() => d.setState(s => context === 'search' ? { ...s, query: 'new' } : context === 'entity' ? { ...s, entity: 'teams' } : { ...s, geo: { level: 'city', country: 'UK', state: 'Scotland', city: 'Edinburgh' } })}>Change context</button>
      <Link to="/activities/activity%2Fone">Detail without query</Link><Link to="/login">Login without query</Link><Link to={original}>Original context</Link></>;
  }
  render(<MemoryRouter initialEntries={[original]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DiscoveryProvider><SelectionProbe /></DiscoveryProvider></MemoryRouter>);
  const selection = () => screen.getByLabelText('Selection').textContent;
  fireEvent.click(screen.getByText('Select pin')); expect(selection()).toBe('activity/one');
  fireEvent.click(screen.getByText('Toggle view')); expect(selection()).toBe('activity/one');
  fireEvent.click(screen.getByText('Detail without query')); fireEvent.click(screen.getByText('Login without query')); fireEvent.click(screen.getByText('Original context')); expect(selection()).toBe('activity/one');
  fireEvent.click(screen.getByText('Change context')); expect(selection()).toBe('none');
  fireEvent.click(screen.getByText('Original context')); expect(selection()).toBe('none');
});
