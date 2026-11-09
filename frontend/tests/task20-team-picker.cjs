// Run with the installed Playwright skill executor: node run.js /absolute/path/frontend/tests/task20-team-picker.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const TARGET_URL = process.env.TASK20_BASE_URL || 'http://localhost:5173';
const envelope = (data) => JSON.stringify({ requestId: 'task20-test', error: 0, data });
const user = { uid: 'task20-user', username: 'task20-picker', first_name: 'Test', last_name: 'Player', image_url: null };
const teams = ['Task20 Alpha & friends', 'Task20 Beta'].map((name) => ({
  name, image_url: null, founded_at: null, categories: [], men_team: true, public_team: true,
  country_name: 'China', state_name: 'Beijing', city_name: 'Beijing',
  location: [{ pk: 'pitch', name: 'Pitch', points: { latitude: 39.9, longitude: 116.4 } }],
  tshirt_color: [], shorts_color: [], socks_color: [], away_tshirt_color: [],
}));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.route('**/api/auth/refresh', (route) => route.fulfill({ contentType: 'application/json', body: envelope({ access_token: 'task20-transport-fixture' }) }));
    await page.route('**/api/users/me', (route) => route.fulfill({ contentType: 'application/json', body: envelope(user) }));
    await page.route('**/api/countries/list/', (route) => route.fulfill({ contentType: 'application/json', body: envelope([{ name: 'China', states: [{ name: 'Beijing', cities: [{ name: 'Beijing' }] }] }]) }));
    await page.route('**/api/teams/search/**', (route) => route.fulfill({ contentType: 'application/json', body: envelope(teams) }));
    await page.route('**/api/teams/country/**', (route) => route.fulfill({ contentType: 'application/json', body: envelope(teams) }));
    await page.route('**/api/teams/Task20*', (route) => route.fulfill({ contentType: 'application/json', body: envelope({ ...teams[0], members: [], sponsors: [], belongs_to_organization: [] }) }));
    await page.goto(TARGET_URL + '/activities', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'User menu' }).waitFor();
    await page.locator('button:has(svg.lucide-plus)').first().click();
    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Next slide' }).click();
    await page.getByRole('tab', { name: 'Yes', exact: true }).click();
    for (const team of teams) {
      await page.getByRole('button', { name: 'Choose a team', exact: true }).first().click();
      await page.getByPlaceholder('Search', { exact: true }).fill('Task20');
      await page.getByText(team.name, { exact: true }).last().click();
      assert.equal(new URL(page.url()).pathname, '/activities', 'team selection must keep the activity form open');
    }
    await page.getByText(teams[0].name, { exact: true }).waitFor();
    await page.getByText(teams[1].name, { exact: true }).waitFor();
    await page.goto(TARGET_URL + '/teams', { waitUntil: 'domcontentloaded' });
    await page.locator('#search-navbar').getByRole('button', { name: /^Country/ }).click();
    await page.getByPlaceholder('Country', { exact: true }).fill('China');
    await page.locator('[cmdk-list]').getByRole('option').first().click();
    await page.keyboard.press('Escape');
    await page.locator('#search-navbar').getByRole('combobox').click();
    await page.getByRole('option', { name: 'Country', exact: true }).click();
    await page.locator('#search-navbar').getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByText(teams[0].name, { exact: true }).last().click();
    await page.waitForURL((url) => decodeURIComponent(url.pathname) === '/teams/' + teams[0].name);
    console.log('PASS nullable-image team picker stays in /activities; ordinary team card navigates with encoded name');
  } finally { await browser.close(); }
})().catch((error) => {
  console.log(error.message.replace(/https?:\/\/[^\s]+/g, '[redacted-url]').slice(0, 500));
  process.exitCode = 1;
});
