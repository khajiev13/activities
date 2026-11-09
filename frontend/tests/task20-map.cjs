// Run with the installed Playwright skill executor: node run.js /absolute/path/frontend/tests/task20-map.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const TARGET_URL = process.env.TASK20_BASE_URL || 'http://localhost:5173';
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const organization = {
  pk: 'task20-org', name: 'Task20 Map Organization', created_at: '2026-11-07T00:00:00Z', image_url: pixel,
  country: { name: 'China' }, state: { name: 'Beijing' }, city: { name: 'Beijing' },
  location: { pk: 'task20-pin', name: 'Test pitch', points: { latitude: 39.9042, longitude: 116.4074 } },
  teams_count: 0, number_of_people_joined: 0, number_of_teams_sponsored: 0, hosting_leagues_count: 0, hosting_activities_count: 0,
};
const envelope = (data) => JSON.stringify({ requestId: 'task20-test', error: 0, data });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  let releaseStyle;
  const styleReady = new Promise((resolve) => { releaseStyle = resolve; });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    let errors = 0;
    page.on('pageerror', () => { errors++; });
    await page.route('https://api.maptiler.com/**', async (route) => {
      if (new URL(route.request().url()).pathname.endsWith('/style.json')) {
        await styleReady;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#181818' } }] }) });
      } else await route.abort();
    });
    await page.route('**/api/countries/list/', (route) => route.fulfill({ contentType: 'application/json', body: envelope([{ name: 'China', states: [{ name: 'Beijing', cities: [{ name: 'Beijing' }] }] }]) }));
    const team = { name: 'Task20 No-kit Team', image_url: null, founded_at: null, categories: [], men_team: true, public_team: true, country_name: 'China', state_name: 'Beijing', city_name: 'Beijing', location: [organization.location], tshirt_color: [], shorts_color: [], socks_color: [], away_tshirt_color: [] };
    await page.route('**/api/teams/country/**', (route) => route.fulfill({ contentType: 'application/json', body: envelope([team]) }));
    let organizationResults = [organization];
    await page.route('**/api/organizations/country/**', (route) => route.fulfill({ contentType: 'application/json', body: envelope(organizationResults) }));
    await page.goto(TARGET_URL + '/map', { waitUntil: 'domcontentloaded' });
    await page.locator('button[value=organizations]').waitFor();
    await page.evaluate(async () => {
      const resource = performance.getEntriesByType('resource').find((entry) => entry.name.includes('/@maptiler_sdk.js?'));
      const sdk = await import(resource.name);
      const addSource = sdk.Map.prototype.addSource;
      window.task20Sources = [];
      sdk.Map.prototype.addSource = function (id, ...args) {
        window.task20Map = this;
        window.task20Sources.push(id);
        return addSource.call(this, id, ...args);
      };
    });
    // Change category while the style request is still pending. Superseded load handlers must be removed.
    await page.locator('button[value=teams]').click();
    await page.locator('button[value=organizations]').click();
    await page.locator('#search-navbar').getByRole('button', { name: /^Country/ }).click();
    await page.getByPlaceholder('Country', { exact: true }).fill('China');
    await page.locator('[cmdk-list]').getByRole('option').first().click();
    await page.keyboard.press('Escape');
    await page.locator('#search-navbar').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Country', exact: true }).click();
    const result = page.waitForResponse((response) => new URL(response.url()).pathname.startsWith('/api/organizations/country/'));
    await page.locator('#search-navbar').getByRole('button', { name: 'Search', exact: true }).click();
    await result;
    releaseStyle();
    await page.waitForFunction(() => window.task20Map?.getLayer('organizations') && window.task20Map.queryRenderedFeatures({ layers: ['organizations'] }).length > 0);
    assert.equal(errors, 0, 'rendering before style readiness must not crash the page');
    const sources = await page.evaluate(() => window.task20Sources);
    assert(sources.includes('organizations'));
    assert(!sources.includes('activities') && !sources.includes('teams'), 'superseded load handlers must not draw stale categories');
    const position = await page.evaluate(() => window.task20Map.project([116.4074, 39.9042]));
    await page.locator('.maplibregl-canvas').click({ position: { x: position.x, y: position.y } });
    await page.getByText(organization.name, { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('button[value=activities]').click();
    await page.waitForFunction(() => !window.task20Map.getSource('organizations'));
    assert.equal(errors, 0);
    await page.locator('button[value=teams]').click();
    await page.locator('#search-navbar').getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForFunction(() => window.task20Map.getLayer('teams') && window.task20Map.queryRenderedFeatures({ layers: ['teams'] }).length > 0);
    const teamPosition = await page.evaluate(() => window.task20Map.project([116.4074, 39.9042]));
    await page.locator('.maplibregl-canvas').click({ position: { x: teamPosition.x, y: teamPosition.y } });
    await page.getByText(team.name, { exact: true }).waitFor();
    assert.equal(errors, 0, 'a backend-valid no-kit team must open without crashing map controls');
    await page.keyboard.press('Escape');
    async function busyBaseSource(id, changeCategory, resultOrganization) {
      let releaseBase;
      const baseReady = new Promise((resolve) => { releaseBase = resolve; });
      await page.route('**/' + id + '.json', async (route) => {
        await baseReady;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
      });
      await page.evaluate((sourceId) => {
        const map = window.task20Map;
        map.addSource(sourceId, { type: 'geojson', data: location.origin + '/' + sourceId + '.json' });
        map.addLayer({ id: sourceId, type: 'circle', source: sourceId });
      }, id);
      await page.waitForFunction(() => !window.task20Map.isStyleLoaded());
      organizationResults = [resultOrganization];
      if (changeCategory) await page.locator('button[value=organizations]').click();
      const searchResponse = page.waitForResponse((response) => new URL(response.url()).pathname.startsWith('/api/organizations/country/'));
      await page.locator('#search-navbar').getByRole('button', { name: 'Search', exact: true }).click();
      await searchResponse;
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => window.task20Map.isStyleLoaded()), false);
      // The map has already fired its initial load. Releasing this source will only produce readiness/idle events.
      releaseBase();
      await page.waitForFunction(() => window.task20Map.isStyleLoaded());
      await page.waitForFunction(() => window.task20Map.getLayer('organizations') && window.task20Map.queryRenderedFeatures({ layers: ['organizations'] }).length > 0, null, { timeout: 5000 });
      const point = await page.evaluate(() => window.task20Map.project([116.4074, 39.9042]));
      await page.locator('.maplibregl-canvas').click({ position: { x: point.x, y: point.y } });
      await page.getByText(resultOrganization.name, { exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await page.evaluate((sourceId) => { window.task20Map.removeLayer(sourceId); window.task20Map.removeSource(sourceId); }, id);
    }
    await busyBaseSource('task20-busy-category', true, organization);
    await busyBaseSource('task20-busy-search', false, { ...organization, pk: 'task20-updated-org', name: 'Task20 Updated Organization' });
    assert.equal(errors, 0);
    console.log('PASS map initial readiness/pending cleanup; already-loaded busy category/search recover clickable markers; organization cleanup/no-kit card');
  } finally {
    releaseStyle();
    await browser.close();
  }
})().catch((error) => {
  console.log(error.message.replace(/https?:\/\/[^\s]+/g, '[redacted-url]').slice(0, 500));
  process.exitCode = 1;
});
