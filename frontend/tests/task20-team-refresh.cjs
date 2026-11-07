// Run with the installed Playwright skill executor: node run.js /absolute/path/frontend/tests/task20-team-refresh.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const TARGET_URL = process.env.TASK20_BASE_URL || 'http://localhost:5173';
const envelope = (data) => JSON.stringify({ requestId: 'task20-race', error: 0, data });
const user = { uid: 'task20-user', username: 'task20-race', first_name: 'Test', last_name: 'Player', image_url: null };
function team(name, jersey) {
  return { name, image_url: null, founded_at: null, country_name: 'China', state_name: 'Beijing', city_name: 'Beijing',
    categories: [], men_team: true, public_team: true, location: [], tshirt_color: [], shorts_color: [], socks_color: [], away_tshirt_color: [],
    members: [{ username: jersey, first_name: 'Test', last_name: 'Player', image_url: null, plays_for_division: null, name_on_jersey: jersey, player_number: 17, role: 'Midfielder' }], sponsors: [], belongs_to_organization: [] };
}
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const failures = [];
  try {
    for (const phase of ['join', 'refresh']) for (const refreshStatus of [200, 500]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      const label = phase + '-pending/' + refreshStatus;
      const joinGate = deferred();
      const joinStarted = deferred();
      const joinHandled = deferred();
      const refreshGate = deferred();
      const refreshStarted = deferred();
      const refreshHandled = deferred();
      let refreshGets = 0;
      let joining = false;
      const a = team('Task20 Join A', 'OLD A');
      const b = team('Task20 Join B', 'CURRENT B');
      try {
        await page.route('**/api/auth/refresh', (route) => route.fulfill({ contentType: 'application/json', body: envelope({ access_token: 'task20-transport-fixture' }) }));
        await page.route('**/api/users/me', (route) => route.fulfill({ contentType: 'application/json', body: envelope(user) }));
        await page.route('**/api/teams/**', async (route) => {
          const path = decodeURIComponent(new URL(route.request().url()).pathname);
          if (path === '/api/teams/Task20 Join A/join/') {
            joining = true;
            joinStarted.resolve();
            await joinGate.promise;
            await route.fulfill({ contentType: 'application/json', body: envelope(a) });
            joinHandled.resolve();
          } else if (path === '/api/teams/Task20 Join A/') {
            if (!joining) return route.fulfill({ contentType: 'application/json', body: envelope(a) });
            refreshGets++;
            refreshStarted.resolve();
            if (phase === 'refresh') await refreshGate.promise;
            await route.fulfill({ status: refreshStatus, contentType: 'application/json', body: refreshStatus === 200 ? envelope(a) : JSON.stringify({ requestId: 'task20-late-error', error: 500, message: 'Synthetic failure' }) });
            refreshHandled.resolve();
          } else if (path === '/api/teams/Task20 Join B/') await route.fulfill({ contentType: 'application/json', body: envelope(b) });
          else await route.abort();
        });
        await page.goto(TARGET_URL + '/teams/' + encodeURIComponent(a.name), { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: a.name, exact: true }).waitFor();
        await page.getByRole('button', { name: 'Join', exact: true }).click();
        await page.getByLabel('Jersey name', { exact: true }).fill('LATE A');
        await page.getByLabel('Number', { exact: true }).fill('17');
        await page.getByLabel('Position', { exact: true }).selectOption('Midfielder');
        await page.getByRole('button', { name: 'Join team', exact: true }).click();
        await joinStarted.promise;
        if (phase === 'refresh') { joinGate.resolve(); await refreshStarted.promise; }
        await page.keyboard.press('Escape');
        // BrowserRouter handles a same-route history navigation; no document reload/unmount masks the race.
        await page.evaluate((name) => {
          history.pushState(history.state, '', '/teams/' + encodeURIComponent(name));
          dispatchEvent(new PopStateEvent('popstate'));
        }, b.name);
        await page.getByRole('heading', { name: b.name, exact: true }).waitFor();
        await page.getByRole('region', { name: 'Team members' }).getByText('CURRENT B · #17 · Midfielder', { exact: true }).waitFor();
        if (phase === 'join') { joinGate.resolve(); await joinHandled.promise; }
        else { refreshGate.resolve(); await refreshHandled.promise; }
        // All held responses have now been released. Allow the captured callback/request and React effects to settle.
        await page.waitForTimeout(150);
        if (refreshGets > 0) await refreshHandled.promise;
        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(decodeURIComponent(new URL(page.url()).pathname), '/teams/' + b.name);
        assert.equal(await page.getByRole('heading', { name: b.name, exact: true }).count(), 1, 'late A result must not replace the current B card');
        assert.equal(await page.getByRole('region', { name: 'Team members' }).getByText('CURRENT B · #17 · Midfielder', { exact: true }).count(), 1, 'late A success/failure must preserve B members');
        assert.equal(await page.getByText('Error: Failed to load team data', { exact: true }).count(), 0);
        if (phase === 'join') assert.equal(refreshGets, 0, 'a callback invoked after navigation must not start an obsolete A refresh');
        console.log('PASS deferred team route ' + label);
      } catch (error) {
        failures.push(label);
        console.log('FAIL deferred team route ' + label + ': ' + error.message.replace(/https?:\/\/[^\s]+/g, '[redacted-url]').slice(0, 250));
      } finally {
        joinGate.resolve(); refreshGate.resolve();
        await context.close();
      }
    }
    assert.deepEqual(failures, [], 'obsolete deferred joins/refreshes must not change the current team');
  } finally { await browser.close(); }
})().catch((error) => { console.log(error.message.slice(0, 500)); process.exitCode = 1; });
