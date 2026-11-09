/* Synthetic native boundary only. No production hooks, real launch data or real GPS. */
const data = require('./mobile-data.cjs');
const key = 'eventopia.discovery.v1';
const place = (city = data.city, state = data.state, center = [-0.1278, 51.5074], geonameId = 2643743) => ({ geo: { level: 'city', country: data.country, state, city }, geonameId, center });
const preference = (mode = 'manual', selected = place(), updatedAt = 1) => ({ version: 1, mode, place: selected, recent: selected ? [selected] : [], welcomeSeen: true, updatedAt });
const row = (name = data.city, state = data.state, center = [-0.1278, 51.5074], id = 2643743) => ({ name, countryName: data.country, countryCode: 'GB', adminName1: state, adminCode1: state === data.state ? 'ENG' : 'OTHER', lng: String(center[0]), lat: String(center[1]), geonameId: id, fcl: 'P', fcode: 'PPLA' });
async function provider(context, options = {}) {
  const calls = [];
  await context.route(url => url.hostname.endsWith('geonames.org'), async route => {
    const request = route.request(), url = new URL(request.url());
    calls.push({ endpoint: url.pathname.split('/').pop(), search: url.searchParams.get('name_startsWith'), exact: url.searchParams.get('name_equals'), credentials: Boolean(request.headers().authorization || request.headers().cookie) });
    if (options.handle && await options.handle(route, url)) return;
    if (options.failure) return route.fulfill({ status: 503, json: {} });
    const selected = options.row || row();
    return route.fulfill({ json: { totalResultsCount: 1, geonames: [selected] } });
  });
  return calls;
}
async function install(context, options = {}) {
  await context.route(url => url.hostname === 'telegram.org', route => route.fulfill({ body: '' }));
  await context.addInitScript(({ key, options }) => {
    if (options.cached && !sessionStorage.getItem('discovery-fixture-seeded')) { localStorage.setItem(key, JSON.stringify(options.cached)); sessionStorage.setItem('discovery-fixture-seeded', 'yes'); }
    const events = {};
    const fixture = window.__native = { calls: 0, browserCalls: 0, reads: 0, writes: [], events, back: null, shows: 0, hides: 0, pendingRead: null, pendingLocation: null, clock: 0 };
    const now = Date.now.bind(Date); Date.now = () => now() + fixture.clock;
    navigator.geolocation.getCurrentPosition = (success, failure) => { fixture.browserCalls++; options.denied ? failure({ code: 1 }) : success({ coords: { latitude: 51.5074, longitude: -0.1278, accuracy: 100 } }); };
    const app = { initData: 'synthetic-native-fixture', isActive: true, colorScheme: 'light', viewportStableHeight: options.viewportHeight || 844, safeAreaInset: { top: options.safeTop || 0, bottom: options.safeBottom || 0 }, contentSafeAreaInset: {}, ready() {}, expand() {},
      isVersionAtLeast: version => Number(options.version || 9) >= Number(version),
      onEvent: (name, callback) => { (events[name] ||= []).push(callback); }, offEvent: (name, callback) => { events[name] = (events[name] || []).filter(item => item !== callback); },
      BackButton: { show() { fixture.shows++; }, hide() { fixture.hides++; }, onClick(callback) { fixture.back = callback; }, offClick(callback) { if (fixture.back === callback) fixture.back = null; } },
      DeviceStorage: { getItem(storageKey, callback) { fixture.reads++; if (options.delayedRead) fixture.pendingRead = () => callback(null, JSON.stringify(options.stored)); else callback(null, options.stored ? JSON.stringify(options.stored) : undefined); }, setItem(storageKey, value, callback) { fixture.writes.push(JSON.parse(value)); if (options.storageFailure) callback?.('synthetic failure'); else callback?.(null, true); } },
      LocationManager: { isInited: true, isLocationAvailable: true, isAccessRequested: options.permission !== 'prompt', isAccessGranted: options.permission === 'granted', init(callback) { callback?.(); }, getLocation(callback) { fixture.calls++; const finish = () => callback(options.denied ? null : { latitude: 51.5074, longitude: -0.1278, horizontal_accuracy: 100 }); if (options.delayedLocation) fixture.pendingLocation = finish; else finish(); } },
    };
    window.Telegram = { WebApp: app };
    fixture.emit = name => (events[name] || []).slice().forEach(callback => callback());
    fixture.resume = (advance = 300001) => { fixture.clock += advance; app.isActive = false; fixture.emit('deactivated'); app.isActive = true; fixture.emit('activated'); document.dispatchEvent(new Event('visibilitychange')); };
    fixture.viewport = (height, offset = 0) => { Object.defineProperties(visualViewport, { height: { configurable: true, value: height }, offsetTop: { configurable: true, value: offset } }); visualViewport.dispatchEvent(new Event('resize')); };
  }, { key, options });
}
module.exports = { key, place, preference, row, provider, install };
