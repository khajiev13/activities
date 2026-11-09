// Run with the installed Playwright skill executor: node run.js /absolute/path/frontend/tests/task20-activity-submit.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const TARGET_URL = process.env.TASK20_BASE_URL || 'http://localhost:5173';
const envelope = (data) => JSON.stringify({ requestId: 'task20-test', error: 0, data });
const activity = {
  pk: 'task20-activity', title: 'Task20 Valid Activity', description: 'Valid activity from the creation form.',
  date_time: '2026-11-08T12:00:00Z', duration_in_minutes: 60, public: true, categories: [],
  country: { name: 'China' }, state: { name: 'Beijing' }, city: { name: 'Beijing' },
  location: { pk: 'task20-location', name: 'Task20 Pitch', points: { latitude: 39.9042, longitude: 116.4074 } },
  creator: { first_name: 'Test', last_name: 'Player', username: 'task20-player', image_url: '' },
  people_joined: [], number_of_people_joined: 0,
  competition: { team_1: { name: null, image_url: null }, team_2: { name: null, image_url: null } },
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    let posts = 0;
    let submitted;
    await page.route('https://api.maptiler.com/**', (route) => new URL(route.request().url()).pathname.endsWith('/style.json')
      ? route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#181818' } }] }) })
      : route.abort());
    await page.route('**/api/auth/refresh', (route) => route.fulfill({ contentType: 'application/json', body: envelope({ access_token: 'task20-transport-fixture' }) }));
    await page.route('**/api/users/me', (route) => route.fulfill({ contentType: 'application/json', body: envelope({ uid: 'task20-user', ...activity.creator }) }));
    await page.route('**/api/countries/list/', (route) => route.fulfill({ contentType: 'application/json', body: envelope([]) }));
    await page.route('https://secure.geonames.org/**', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(new URL(route.request().url()).pathname.includes('timezoneJSON')
      ? { countryCode: 'CN', sunrise: '06:00', sunset: '18:00', timezoneId: 'Asia/Shanghai' }
      : { geonames: [{ countryName: 'China', adminName1: 'Beijing', name: 'Beijing' }] }) }));
    await page.route('**/api/locations/', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: envelope(activity.location) }));
    await page.route('**/api/activities/', async (route) => {
      posts++;
      submitted = route.request().postDataJSON();
      await route.fulfill({ status: 201, contentType: 'application/json', body: envelope(activity) });
    });
    await page.route('**/api/activities/task20-activity', (route) => route.fulfill({ contentType: 'application/json', body: envelope(activity) }));
    await page.goto(TARGET_URL + '/activities', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'User menu' }).waitFor();
    await page.locator('button:has(svg.lucide-plus)').first().click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByText('Title must be at least 3 characters.', { exact: true }).waitFor();
    assert.equal(posts, 0, 'invalid forms must not reach the API');
    await page.getByPlaceholder('Write your title').fill(activity.title);
    await page.getByPlaceholder('Type your description here.').fill(activity.description);
    await page.getByRole('button', { name: 'Next slide' }).click();
    await page.getByRole('button', { name: 'Next slide' }).click();
    await page.locator('.maplibregl-canvas').click({ position: { x: 200, y: 150 } });
    await page.locator('#location-input').fill(activity.location.name);
    await page.locator('#location-submit').click();
    await page.locator('#location-input').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Next slide' }).click();
    await page.getByRole('button', { name: 'Next slide' }).click();
    await page.getByRole('tab', { name: 'No', exact: true }).click();
    await page.locator('input[type=number]').last().fill('60');
    const button = page.getByRole('button', { name: 'Create', exact: true });
    assert.equal(await button.isEnabled(), true, 'valid custom-control values must not be trapped by stale form validity');
    await Promise.all([page.waitForResponse((response) => new URL(response.url()).pathname === '/api/activities/'), button.click()]);
    assert.equal(posts, 1);
    assert.deepEqual(submitted.location, { pk: 'task20-location' });
    assert.deepEqual(submitted.country, { name: 'China' });
    assert.equal(submitted.duration_in_minutes, 60);
    assert.equal(submitted.is_competition, false);
    assert.equal(submitted.title, activity.title);
    await page.getByRole('heading', { name: activity.title, exact: true }).waitFor({ timeout: 20000 });
    await page.route('**/api/activities/task20-error', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ requestId: 'task20-error', error: 300, message: 'Not found' }) }));
    await page.goto(TARGET_URL + '/activities/task20-error', { waitUntil: 'domcontentloaded' });
    await page.getByRole('alert').getByText('Unable to load activity. Please try again.', { exact: true }).waitFor();
    let releaseDetail;
    const ready = new Promise((resolve) => { releaseDetail = resolve; });
    await page.route('**/api/activities/task20-loading', async (route) => { await ready; await route.fulfill({ contentType: 'application/json', body: envelope(activity) }); });
    await page.goto(TARGET_URL + '/activities/task20-loading', { waitUntil: 'domcontentloaded' });
    await page.getByRole('status').getByText('Loading activity…', { exact: true }).waitFor();
    releaseDetail();
    await page.getByRole('heading', { name: activity.title, exact: true }).waitFor();
    console.log('PASS invalid activity noPOST; valid custom controls submit once; API detail/loading/safe error');
  } finally { await browser.close(); }
})().catch((error) => {
  console.log(error.message.replace(/https?:\/\/[^\s]+/g, '[redacted-url]').slice(0, 500));
  process.exitCode = 1;
});
