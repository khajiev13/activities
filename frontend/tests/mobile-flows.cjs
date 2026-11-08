/* Run with Node; see docs/testing/mobile-ui.html. Always headless, never uses a user profile. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = require('./fixtures/mobile-data.cjs');
const BASE = process.env.EVENTOPIA_BASE_URL || 'http://127.0.0.1:5173';
const OUT = path.resolve(process.env.SCREENSHOT_DIR || '.artifacts/mobile-ui');
const selected = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const results = []; let checks = 0; let browser;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
async function until(fn, message = 'Expected rendered state') {
  const start = Date.now(); while (Date.now() - start < 20000) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 40)); } throw new Error(message);
}
async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function shot(page, name) { return page.screenshot({ path: path.join(OUT, name + '.png'), animations: 'disabled', fullPage: false }); }
async function setup(options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...options.context });
  const model = await data.install(context, options);
  if (!options.realMap) {
    await context.route(url => url.hostname.endsWith('maptiler.com'), route => route.abort());
    await context.route(url => url.hostname === 'telegram.org', route => route.fulfill({ body: '' }));
  }
  await context.route(url => url.hostname.endsWith('geonames.org'), route => route.abort());
  const page = await context.newPage(); const errors = []; const resources = [];
  page.on('pageerror', error => errors.push(error.message.replace(/https?:\/\/\S+/g, '[URL]').replace(/\+\d{9,15}|\b\d{6}\b|\b[a-f0-9]{32,64}\b/gi, '[synthetic auth value]')));
  page.on('request', request => { const url = new URL(request.url()); if (url.origin === new URL(BASE).origin && !url.pathname.startsWith('/api/')) resources.push(url.pathname); });
  page.setDefaultTimeout(15000);
  return { context, page, model, errors, resources };
}
async function clean(run) { equal(run.errors, [], 'No unexpected browser exceptions'); equal(run.model.unknown, [], 'All fixture API boundaries are recognized'); await run.context.close(); }
async function fit(page) {
  const overflow = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && getComputedStyle(el).visibility !== 'hidden'; }).slice(0, 8).map(el => ({ tag: el.tagName, class: el.className, right: el.getBoundingClientRect().right })) }));
  if (overflow.scrollWidth > overflow.width) await shot(page, 'overflow-' + overflow.width);
  check(overflow.scrollWidth <= overflow.width, 'Page fits width: ' + JSON.stringify(overflow));
}
async function targets(page) {
  const failures = await page.evaluate(() => [...document.querySelectorAll('button,a,input,select,textarea,[role="option"],[role="tab"]')].filter(el => {
    const r = el.getBoundingClientRect(), style = getComputedStyle(el);
    return r.width && r.height && style.visibility !== 'hidden' && !el.closest('.maplibregl-ctrl, .app-skip-link') && !el.matches('[aria-hidden="true"]') && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }).flatMap(el => {
    // Checkbox/radio label is the actual hit area.
    const target = el.matches('input[type="radio"],input[type="checkbox"]') ? el.closest('label') || el : el;
    const r = target.getBoundingClientRect();
    return r.height < 43.5 || r.width < 43.5 || r.left < -1 || r.right > innerWidth + 1 ? [{ label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 50) || el.tagName, width: r.width, height: r.height }] : [];
  }));
  equal(failures, [], 'Visible app controls have at least 44px hit areas');
}
async function fieldReachable(page, field) {
  await field.scrollIntoViewIfNeeded(); await field.focus(); await settle(page);
  const r = await field.boundingBox(), viewport = page.viewportSize();
  check(r && r.x >= 0 && r.x + r.width <= viewport.width + 1 && r.y >= 0 && r.y + r.height <= viewport.height + 1, 'Focused field fits the viewport');
  const exposed = await field.evaluate(el => { const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { fits: hit === el || el.contains(hit), id: el.id, shortSheet: el.closest('.create-sheet')?.dataset.short, sheetHeight: el.closest('.create-sheet')?.getBoundingClientRect().height, hit: hit?.tagName + ':' + hit?.textContent?.slice(0, 100), field: { x: r.x, y: r.y, width: r.width, height: r.height } }; });
  if (!exposed.fits) await shot(page, 'clipped-field-' + viewport.width + '-' + exposed.id.replace(/[^a-zA-Z0-9]/g, ''));
  check(exposed.fits, 'Focused field is exposed above sticky controls: ' + JSON.stringify(exposed));
}
async function openCreate(page, entity) {
  await page.goto(BASE + '/' + entity + data.query(entity));
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  return page.getByRole('dialog').filter({ hasText: 'Create a new ' + (entity === 'activities' ? 'activity' : entity === 'teams' ? 'team' : 'organization') });
}
async function discard(page, drawer) {
  await drawer.getByRole('button', { name: 'Close', exact: true }).click();
  if (await page.getByRole('alertdialog').count()) await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await drawer.waitFor({ state: 'hidden' });
  await until(() => page.evaluate(() => !document.body.style.position && document.body.style.pointerEvents !== 'none'), 'Modal restores body styles');
}
async function manualVenue(page, drawer, { retry = false, city = data.city } = {}) {
  await drawer.getByLabel('Venue name', { exact: true }).fill(data.place.name);
  if (!await drawer.getByLabel('Longitude', { exact: true }).isVisible()) await drawer.getByRole('button', { name: 'Enter location manually', exact: true }).click();
  for (const [label, value] of [['Longitude', '10'], ['Latitude', '20'], ['Country', data.country], ['State or region', data.state], ['City', city]]) await drawer.getByLabel(label, { exact: true }).fill(value);
  await drawer.getByRole('button', { name: 'Use this location', exact: true }).click();
  if (retry) { await drawer.getByRole('alert').filter({ hasText: 'Could not save this location' }).waitFor(); await drawer.getByRole('button', { name: 'Use this location', exact: true }).click(); }
  await drawer.getByRole('button', { name: 'Change location', exact: true }).waitFor();
}
async function runCase(name, fn) {
  if (selected && name !== selected) return;
  const before = checks; const start = Date.now();
  try { await fn(); results.push({ name, status: 'PASS', checks: checks - before, milliseconds: Date.now() - start }); console.log('PASS ' + name + ' (' + (checks - before) + ' checks)'); }
  catch (error) { const message = error.message.replace(/https?:\/\/\S+/g, '[URL]').replace(/\+\d{9,15}|\b\d{6}\b|\b[a-f0-9]{32,64}\b/gi, '[synthetic auth value]').slice(0, 2200); results.push({ name, status: 'FAIL', checks: checks - before, message }); console.error('FAIL ' + name + ': ' + message); }
  finally { for (const context of browser.contexts()) await context.close(); }
}
async function responsive() {
  for (const width of [320, 360, 390, 430, 768, 1280]) for (const theme of ['light', 'dark']) {
    const run = await setup({ context: { viewport: { width, height: width >= 768 ? 960 : 844 }, colorScheme: theme } }); const { page, resources, model } = run;
    for (const [label, route] of [['Explore', '/map'], ['Activities', '/activities'], ['Teams', '/teams'], ['Organizations', '/organizations']]) {
      if (label === 'Explore') await page.goto(BASE + route + data.query('activities'));
      else await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: label, exact: true }).click();
      await until(() => page.locator('[data-result-id]').count());
      await fit(page); await targets(page);
      equal(new URL(page.url()).searchParams.get('city'), data.city, 'Tab preserves city');
      equal(new URL(page.url()).searchParams.get('q'), 'ball', 'Tab preserves search');
      check(!page.url().includes('/login'), 'Anonymous browsing does not require login');
      if ([320, 390, 1280].includes(width)) await shot(page, `tabs-${width}-${theme}-${label.toLowerCase()}`);
    }
    check(!resources.some(resource => /three-globe|react-three|globe\.json|HomePage|illustrations/.test(resource)), 'Discovery does not request marketing globe/3D');
    equal(model.writes.length, 0, 'Anonymous tabs perform no content writes');
    await clean(run);
  }
}
async function copy() {
  const run = await setup(); run.model.one = true; const { page } = run;
  await page.goto(BASE + '/organizations' + data.query('organizations'));
  await page.getByRole('button', { name: 'About Community club' }).waitFor();
  equal({ result: await page.getByText('1 result · ' + data.city, { exact: true }).count(), organization: await page.getByText(/1 team · 1 member · 1 activity/).count() }, { result: 1, organization: 1 }, 'Singular result and organization counts');
  await clean(run);
}
async function navigation() {
  const run = await setup(); const { page, model } = run;
  await page.goto(BASE + '/map' + data.query('activities'));
  await page.getByRole('searchbox').fill('friendly');
  await until(() => model.requests.some(request => request.search === 'friendly'));
  await page.getByRole('button', { name: 'Teams', exact: true }).click();
  await page.getByRole('link', { name: 'Community team 06', exact: true }).waitFor();
  const query = new URL(page.url()).search;
  const scroll = page.locator('.discovery-results-scroll');
  await page.getByRole('link', { name: 'Community team 06', exact: true }).scrollIntoViewIfNeeded(); const before = await scroll.evaluate(el => el.scrollTop);
  await page.getByRole('link', { name: 'Community team 06', exact: true }).click();
  await page.getByRole('region', { name: 'Team information' }).waitFor(); await shot(page, 'detail-team-390');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await until(async () => await scroll.count() && await scroll.evaluate(el => el.scrollTop) === before, 'Detail restores list scroll');
  equal(new URL(page.url()).search, query, 'Detail restores filter/view/query');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Organizations' }).click();
  await page.getByRole('button', { name: 'About Community club' }).click();
  await page.getByRole('region', { name: 'Organization preview' }).waitFor();
  equal(await page.getByRole('region', { name: 'Organization preview' }).getByRole('link').count(), 0, 'Organization preview has no invented detail action');
  await page.getByRole('button', { name: 'Close preview' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Explore' }).click();
  equal(new URL(page.url()).search, query, 'Explore preserves own entity/filter/view');
  model.failResults = true; await page.getByRole('searchbox').fill('offline'); await page.getByRole('button', { name: 'Retry results' }).waitFor();
  model.failResults = false; model.empty = true; await page.getByRole('button', { name: 'Retry results' }).click(); await page.getByText(/No teams found/).waitFor();
  await clean(run);
}
async function teamJoin() {
  const run = await setup({ authenticated: true }); const { page, model } = run;
  await page.goto(BASE + '/teams/Community%20United' + data.query('teams'));
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await targets(page);
  await page.getByRole('button', { name: 'Join team', exact: true }).click(); equal(model.writes.length, 0, 'Invalid join sends no request');
  await page.getByLabel('Jersey name').fill('PLAYER'); await page.getByLabel('Number', { exact: true }).fill('8'); await page.getByLabel('Position', { exact: true }).selectOption('Midfielder');
  await page.getByRole('button', { name: 'Join team', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Unable to join' }).waitFor();
  model.failTeamJoin = false; await page.getByRole('button', { name: 'Join team', exact: true }).click(); await page.getByText('You are a member · Midfielder', { exact: true }).waitFor();
  equal(model.teamJoinPayload, { name_on_jersey: 'PLAYER', player_number: 8, position: 'Midfielder' }, 'Team join payload preserved');
  equal(model.writes.length, 2, 'Exactly failure and retry join requests'); await shot(page, 'team-joined-390'); await clean(run);
}
async function geography() {
  for (const mode of ['allowed', 'denied', 'unmatched', 'provider-failure', 'manual-race']) {
    const run = await setup(); const { context, page, model } = run;
    await context.addInitScript(mode => {
      window.__locationCalls = 0;
      navigator.geolocation.getCurrentPosition = (success, failure) => {
        window.__locationCalls++;
        if (mode === 'denied') failure({ code: 1 });
        else if (mode === 'manual-race') window.__resolveLocation = () => success({ coords: { latitude: 20, longitude: 10, accuracy: 100 } });
        else success({ coords: { latitude: 20, longitude: 10, accuracy: 100 } });
      };
    }, mode);
    let providerRequests = 0;
    await context.route(url => url.hostname.endsWith('geonames.org'), route => {
      providerRequests++;
      check(!route.request().headers().authorization && !route.request().headers().cookie, 'Lookup carries no Eventopia credentials');
      if (mode === 'provider-failure') return route.fulfill({ status: 503, json: {} });
      return route.fulfill({ json: { geonames: [{ name: mode === 'unmatched' ? 'Unknown city' : 'Shared city', countryName: data.country, adminName1: 'Other state' }] } });
    });
    await page.goto(BASE + '/'); const dialog = page.getByRole('dialog'); await dialog.waitFor();
    equal(await page.evaluate(() => window.__locationCalls), 0, 'No automatic location prompt');
    equal(model.resultReads, 0, 'No default city result request');
    check(await dialog.getByText(/GeoNames receives your coordinates/).count(), 'Provider disclosure appears before location action');
    await dialog.getByRole('button', { name: 'Use my location', exact: true }).click();
    if (mode === 'allowed') {
      await dialog.waitFor({ state: 'hidden' }); equal(new URL(page.url()).searchParams.get('state'), 'Other state', 'Duplicate city resolved with compatible exact parent');
      await until(() => model.requests.some(request => request.path.includes('/city/Shared city/')), 'Exact stored city requested');
    } else if (mode === 'manual-race') {
      await dialog.getByRole('button', { name: `${data.city}, ${data.state}, ${data.country}`, exact: true }).click();
      await page.evaluate(() => window.__resolveLocation());
      equal(new URL(page.url()).searchParams.get('city'), data.city, 'Manual city wins over pending GPS');
      equal(providerRequests, 0, 'Cancelled GPS callback does not start provider lookup');
    } else {
      await dialog.getByRole('status').filter({ hasText: mode === 'denied' ? 'permission denied' : mode === 'unmatched' ? 'choose a city from' : 'Could not detect' }).waitFor();
      await dialog.getByLabel('Search cities').fill('Shared city');
      equal(await dialog.getByRole('button', { name: /^Shared city,/ }).count(), 3, 'Duplicate geographic names remain separately selectable');
      await dialog.getByRole('button', { name: `Shared city, ${data.state}, Other country`, exact: true }).click();
      equal(new URL(page.url()).searchParams.get('country'), 'Other country', 'Manual choice preserves exact country');
    }
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
    check(!/latitude|longitude|accuracy/.test(stored), 'Exact coordinates are absent from application storage and URL');
    equal(await page.evaluate(() => window.__locationCalls), 1, 'Single location request per action'); await clean(run);
  }
  const run = await setup(); const { page } = run;
  await page.goto(BASE + '/'); const dialog = page.getByRole('dialog');
  await dialog.getByText('Browse countries and states', { exact: true }).click(); await dialog.getByRole('button', { name: 'Browse Other state, ' + data.country, exact: true }).click();
  equal(new URL(page.url()).searchParams.get('level'), 'state', 'Explicit state browsing works');
  await page.getByRole('button', { name: new RegExp('^Other state') }).click(); await dialog.getByText('Browse countries and states', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Browse ' + data.country, exact: true }).click(); equal(new URL(page.url()).searchParams.get('level'), 'country', 'Explicit country browsing works'); await clean(run);
}
async function authParticipation() {
  const run = await setup(); const { page, model } = run;
  await page.goto(BASE + '/activities' + data.query('activities'));
  const panel = page.locator('.discovery-results-scroll'); const link = page.getByRole('link', { name: data.activity.title, exact: true });
  await link.scrollIntoViewIfNeeded(); const scroll = await panel.evaluate(el => el.scrollTop); check(scroll > 0, 'Login restoration starts with a scrolled list');
  await link.click(); await page.getByRole('link', { name: 'Join activity', exact: true }).click();
  await page.getByRole('button', { name: 'Send code', exact: true }).waitFor();
  // Synthetic credentials are supplied only while no screenshots or logs are captured.
  await page.getByLabel('Phone number').fill('+99890' + String(require('node:crypto').randomInt(1000000, 9999999))); await page.getByRole('button', { name: 'Send code', exact: true }).click();
  await page.getByLabel('6-digit code').fill(String(require('node:crypto').randomInt(100000, 999999))); await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('button', { name: 'Join activity', exact: true }).waitFor();
  equal(new URL(page.url()).pathname, '/activities/one', 'Successful login returns to detail'); equal(new URL(page.url()).search, data.query('activities'), 'Successful login preserves query');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  equal(new URL(page.url()).pathname, '/activities', 'Back reaches list rather than duplicate detail');
  await until(async () => await panel.count() && await panel.evaluate(el => el.scrollTop) === scroll, 'Successful login restores list position');
  await link.click(); await page.getByRole('button', { name: 'Join activity', exact: true }).click(); await page.getByText('1 person joined', { exact: true }).waitFor();
  model.failLeave = true; await page.getByRole('button', { name: 'Leave activity', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'Unable to update participation' }).waitFor();
  check(await page.getByText('1 person joined', { exact: true }).count(), 'Failed leave preserves authoritative count');
  model.failLeave = false; await page.getByRole('button', { name: 'Leave activity', exact: true }).click(); await page.getByText('0 people joined', { exact: true }).waitFor();
  equal(model.writes.length, 3, 'Actual activity join, failed leave and retry requests'); await shot(page, 'detail-activity-390');
  await page.getByRole('button', { name: 'Account', exact: true }).click(); await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await page.getByRole('link', { name: 'Join activity', exact: true }).waitFor(); check(!model.authenticated, 'Logout revokes fixture session'); await clean(run);
}
function contrast(fg, bg) {
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const a = luminance(fg), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
async function contrastPairs(page) {
  const pairs = await page.evaluate(() => {
    const pairs = {};
    for (const [name, fg, bg] of [['body', 'foreground', 'background'], ['muted', 'muted-foreground', 'card'], ['primary', 'primary-foreground', 'primary'], ['destructive', 'destructive-foreground', 'destructive']]) {
      const sample = document.createElement('span'); sample.style.color = `hsl(var(--${fg}))`; sample.style.backgroundColor = `hsl(var(--${bg}))`; document.body.append(sample);
      const style = getComputedStyle(sample); pairs[name] = { fg: style.color, bg: style.backgroundColor }; sample.remove();
    }
    return pairs;
  });
  for (const [name, pair] of Object.entries(pairs)) { pair.ratio = contrast(pair.fg, pair.bg); check(pair.ratio >= 4.5, name + ' text contrast >= 4.5:1 (actual ' + pair.ratio.toFixed(2) + ')'); }
  return pairs;
}
async function modalFocus() {
  const run = await setup({ authenticated: true }); const { page } = run;
  await page.goto(BASE + '/activities' + data.query('activities')); await page.getByRole('searchbox').waitFor();
  await page.getByRole('button', { name: 'Account', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.waitFor(); await settle(page);
  check(await dialog.evaluate(el => el.contains(document.activeElement)), 'Account modal receives focus');
  for (let i = 0; i < 9; i++) { await page.keyboard.press('Tab'); check(await dialog.evaluate(el => el.contains(document.activeElement)), 'Tab focus remains inside modal'); }
  await dialog.getByRole('button', { name: 'Close', exact: true }).focus(); await settle(page); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); await until(() => page.getByRole('button', { name: 'Account', exact: true }).evaluate(el => document.activeElement === el), 'Escape restores opener focus'); checks++;
  await page.getByRole('button', { name: new RegExp('^' + data.city) }).click(); await dialog.waitFor(); await dialog.getByRole('button', { name: 'Close', exact: true }).focus(); await settle(page); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
  await until(() => page.getByRole('button', { name: new RegExp('^' + data.city) }).evaluate(el => document.activeElement === el), 'City modal restores opener focus'); checks++;
  await clean(run);
}
async function accessibility() {
  const run = await setup({ authenticated: true }); const { page } = run;
  await page.goto(BASE + '/activities' + data.query('activities')); await page.getByRole('searchbox').waitFor();
  for (const size of [{ width: 320, height: 568, text: '20px' }, { width: 667, height: 320, text: '20px' }, { width: 390, height: 844, text: '32px' }]) {
    await page.goto(BASE + '/teams' + data.query('teams')); await page.getByRole('searchbox').waitFor();
    await page.setViewportSize({ width: size.width, height: size.height }); await page.evaluate(text => document.documentElement.style.fontSize = text, size.text); await settle(page);
    await fit(page); await targets(page); await page.getByRole('button', { name: 'Create', exact: true }).click(); const drawer = page.getByRole('dialog'); await drawer.getByLabel('Name', { exact: true }).waitFor();
    equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), size.text, 'Text scale persists in the actual opened form');
    await until(() => drawer.evaluate(el => el.dataset.short === String(el.getBoundingClientRect().height <= 400)), 'Create observes actual portaled sheet height'); checks++;
    for (const label of ['Name', 'Founded date', 'Logo of the team (optional)', 'Venue name']) {
      await fieldReachable(page, drawer.getByLabel(label, { exact: true }));
      if (size.width === 667 && label === 'Name') await shot(page, 'landscape-focused-field-667');
    }
    await fieldReachable(page, drawer.getByLabel('Socks', { exact: true }));
    await fieldReachable(page, drawer.getByRole('button', { name: 'Create', exact: true })); await fieldReachable(page, drawer.getByRole('button', { name: 'Close', exact: true }));
    await shot(page, 'larger-text-form-' + size.width); await discard(page, drawer);
    await page.evaluate(() => document.documentElement.style.fontSize = '');
  }
  // Repeated real-Vaul opens/closes and route switches exercise browser cleanup, not jsdom mocks.
  for (let i = 0; i < 4; i++) {
    await page.goto(BASE + '/activities' + data.query('activities')); await until(() => page.locator('[data-result-id]').count());
    const panel = page.locator('.discovery-results-scroll'); await panel.evaluate(el => { el.scrollTop = 500; el.dispatchEvent(new Event('scroll', { bubbles: true })); }); const before = await panel.evaluate(el => el.scrollTop);
    await page.getByRole('button', { name: 'Create', exact: true }).click(); const drawer = page.getByRole('dialog'); await drawer.getByLabel('Title', { exact: true }).fill('Draft ' + i); await discard(page, drawer);
    equal(await panel.evaluate(el => el.scrollTop), before, 'Closing drawer restores actual list scroll');
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Teams', exact: true }).click();
    equal(await page.locator('[data-vaul-drawer]').count(), 0, 'No stale drawer after route switch');
    equal(await page.locator('canvas').count(), 0, 'Directory cleans up map canvases');
  }
  await clean(run);
}
async function nativeAdapter() {
  for (const denied of [false, true]) {
    const run = await setup({ authenticated: true }); const { context, page } = run;
    await context.route(url => url.hostname === 'telegram.org', route => route.fulfill({ body: '' }));
    await context.addInitScript(({ denied, marker }) => {
      const events = {}; window.__native = { calls: 0, browserCalls: 0, events, back: null, shows: 0, hides: 0 };
      navigator.geolocation.getCurrentPosition = () => window.__native.browserCalls++;
      window.Telegram = { WebApp: { initData: marker, colorScheme: 'dark', viewportStableHeight: 800, safeAreaInset: { top: 20, bottom: 10 }, contentSafeAreaInset: { bottom: 30 }, ready() {}, expand() {}, isVersionAtLeast: () => true,
        onEvent: (event, callback) => { (events[event] ||= []).push(callback); }, offEvent: (event, callback) => { events[event] = events[event].filter(item => item !== callback); },
        BackButton: { show() { window.__native.shows++; }, hide() { window.__native.hides++; }, onClick(callback) { window.__native.back = callback; }, offClick(callback) { if (window.__native.back === callback) window.__native.back = null; } },
        LocationManager: { isInited: false, isLocationAvailable: true, init(callback) { this.isInited = true; callback(); }, getLocation(callback) { window.__native.calls++; callback(denied ? null : { latitude: 20, longitude: 10, horizontal_accuracy: 100 }); } },
      } };
    }, { denied, marker: require('node:crypto').randomBytes(16).toString('hex') });
    await context.route(url => url.hostname.endsWith('geonames.org'), route => route.fulfill({ json: { geonames: [{ name: data.city, countryName: data.country, adminName1: data.state }] } }));
    await page.goto(BASE + '/'); const dialog = page.getByRole('dialog'); await dialog.waitFor();
    equal(await page.evaluate(() => window.__native.calls), 0, 'Native permission waits for explicit action');
    await dialog.getByRole('button', { name: 'Use my location', exact: true }).click();
    if (denied) { await dialog.getByRole('status').filter({ hasText: 'permission denied' }).waitFor(); await dialog.getByRole('button', { name: `${data.city}, ${data.state}, ${data.country}`, exact: true }).click(); }
    await dialog.waitFor({ state: 'hidden' }); equal(await page.evaluate(() => window.__native.calls), 1, 'Controlled native manager called once'); equal(await page.evaluate(() => window.__native.browserCalls), 0, 'Native denial/success does not prompt browser');
    check(await page.evaluate(() => document.documentElement.classList.contains('dark')), 'Telegram theme wins over system');
    await page.getByRole('button', { name: 'Account', exact: true }).click(); await page.getByLabel('Appearance').selectOption('light'); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    check(await page.evaluate(() => !document.documentElement.classList.contains('dark')), 'Explicit theme wins over Telegram');
    await page.evaluate(() => { const app = window.Telegram.WebApp; app.contentSafeAreaInset.bottom = 48; app.viewportStableHeight = 700; for (const name of ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged']) window.__native.events[name].forEach(callback => callback()); });
    equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--native-safe-bottom')), '48px', 'Telegram inset event updates maximum safe area');
    equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--app-height')), '700px', 'Telegram viewport event updates app height');
    await page.setViewportSize({ width: 390, height: 400 }); await page.evaluate(() => visualViewport.dispatchEvent(new Event('resize')));
    await until(async () => await page.evaluate(() => parseFloat(document.documentElement.style.getPropertyValue('--app-height')) <= 400), 'Visual viewport resize shrinks below native stable height');
    const drawer = await openCreate(page, 'activities'); await fieldReachable(page, drawer.getByLabel('Duration (minutes)', { exact: true })); await fieldReachable(page, drawer.getByRole('button', { name: 'Create', exact: true })); await fieldReachable(page, drawer.getByRole('button', { name: 'Close', exact: true })); await discard(page, drawer);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + '/activities/one' + data.query('activities')); await page.getByRole('heading', { name: 'About this activity', exact: true }).waitFor();
    check(await page.evaluate(() => window.__native.shows > 0 && typeof window.__native.back === 'function'), 'Native Back registers on detail');
    await page.evaluate(() => window.__native.back()); await page.waitForURL(url => url.pathname === '/activities');
    await until(async () => await page.evaluate(() => window.__native.back === null), 'Native Back callback cleans up after detail');
    await clean(run);
  }
}
async function activityForm() {
  const run = await setup({ authenticated: true }); const { page, model } = run; model.failVenue = true;
  const drawer = await openCreate(page, 'activities');
  await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await drawer.getByRole('alert').waitFor(); equal(model.writes.length, 0, 'Invalid activity sends no write');
  await drawer.getByLabel('Title', { exact: true }).fill('Example match'); await drawer.getByLabel('Description', { exact: true }).fill('A synthetic activity description.');
  await drawer.getByLabel('Outdoor activity', { exact: true }).click(); await drawer.getByLabel('Ball games', { exact: true }).check();
  await drawer.getByLabel('Venue name', { exact: true }).fill(data.place.name);
  if (!await drawer.getByLabel('Longitude', { exact: true }).isVisible()) await drawer.getByRole('button', { name: 'Enter location manually', exact: true }).click();
  await drawer.getByLabel('Longitude', { exact: true }).fill('10'); await drawer.getByLabel('Latitude', { exact: true }).fill('20');
  await drawer.getByRole('button', { name: 'Use this location', exact: true }).click(); await drawer.getByRole('alert').filter({ hasText: 'Could not save this location' }).waitFor();
  equal(model.writes.length, 0, 'Provider failure does not send incomplete venue');
  await manualVenue(page, drawer, { retry: true }); equal(model.countryReads, 2, 'Venue success refreshes catalogue once');
  await drawer.getByLabel('Date and time', { exact: true }).fill('2026-12-01T14:30'); await drawer.getByLabel('Duration (minutes)', { exact: true }).fill('90'); await drawer.getByLabel('Public Activity', { exact: true }).uncheck();
  await drawer.getByRole('tab', { name: 'Yes', exact: true }).click(); await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await drawer.getByRole('alert').filter({ hasText: 'two distinct competition teams' }).waitFor();
  equal(model.activityPayload, null, 'Competition validation precedes POST');
  for (const name of ['Team Alpha', 'Team Beta']) {
    await drawer.getByRole('button', { name: 'Select a team', exact: true }).first().click();
    const picker = page.getByRole('dialog').filter({ hasText: 'Please search for the team' });
    await picker.getByPlaceholder('Search', { exact: true }).fill(name); await picker.getByRole('button', { name, exact: true }).click(); await picker.waitFor({ state: 'hidden' });
  }
  await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await drawer.getByRole('alert').filter({ hasText: 'Could not create the activity' }).waitFor();
  equal(await drawer.getByLabel('Title', { exact: true }).inputValue(), 'Example match', 'Failed activity retains draft');
  await shot(page, 'activity-form-error-390');
  await drawer.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByRole('alertdialog').waitFor(); await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await page.waitForURL(url => url.pathname === '/activities/created-activity'); await drawer.waitFor({ state: 'hidden' });
  await page.getByRole('heading', { name: 'Example match', exact: true }).waitFor(); await page.getByRole('heading', { name: 'About this activity', exact: true }).waitFor();
  const payload = model.activityPayload;
  equal(payload.categories, [{ pk: 'category-1', name: 'Ball games' }], 'Activity categories preserved'); equal(payload.competition.team_2.name, 'Team Beta', 'Competition team payload preserved');
  equal(payload.public, false, 'Activity privacy preserved'); equal(payload.date_time, await page.evaluate(() => new Date('2026-12-01T14:30').toISOString()), 'Activity local date converts to ISO'); equal(payload.duration_in_minutes, 90, 'Duration preserved');
  equal(model.countryReads, 2, 'Activity persistence does not duplicate venue catalogue refresh');
  await shot(page, 'activity-created-390'); const before = model.resultReads; await page.getByRole('button', { name: 'Back', exact: true }).click();
  equal(new URL(page.url()).search, data.query('activities'), 'Created detail Back retains filters'); await until(() => model.resultReads > before, 'Created activity results refreshed'); await clean(run);
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
async function imageValidation(page, drawer, label) {
  const input = drawer.getByLabel(label, { exact: true });
  for (const file of [{ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic') }, { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }]) {
    await input.setInputFiles(file); await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await drawer.getByRole('alert').waitFor();
  }
  await input.setInputFiles({ name: 'synthetic-logo.png', mimeType: 'image/png', buffer: png });
}
async function selectOrganization(drawer, label, name) {
  const input = drawer.getByRole('combobox', { name: label, exact: true });
  await input.fill(name); await input.press('ArrowDown'); await input.press('Enter');
  await drawer.getByText(name, { exact: true }).waitFor();
}
async function teamForm() {
  const run = await setup({ authenticated: true, context: { viewport: { width: 320, height: 740 } } }); const { page, model } = run;
  const drawer = await openCreate(page, 'teams');
  await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await drawer.getByRole('alert').waitFor(); equal(model.writes.length, 0, 'Invalid team sends no writes');
  await drawer.getByLabel('Name', { exact: true }).fill('New community team'); await drawer.getByLabel('Founded date', { exact: true }).fill('2020-03-04');
  await drawer.getByLabel('Women’s team', { exact: true }).check(); await drawer.getByLabel('Public Team', { exact: true }).check(); await drawer.getByLabel('Outdoor activity', { exact: true }).click(); await drawer.getByLabel('Ball games', { exact: true }).check();
  await manualVenue(page, drawer); const before = model.writes.length;
  await imageValidation(page, drawer, 'Logo of the team (optional)'); equal(model.writes.length, before, 'Invalid image MIME and size block team multipart');
  const preview = drawer.getByRole('img', { name: 'Team logo preview', exact: true }); await preview.waitFor();
  check(await preview.evaluate(el => el.complete && el.naturalWidth > 0 && el.clientWidth === 64 && el.clientHeight === 64), 'Actual uploaded image renders within compact preview');
  // Accept initial black directly, without changing native value. Other chosen and untouched fields differ.
  equal(await drawer.getByLabel('Home shirt', { exact: true }).inputValue(), '#000000', 'Native initial black is displayed');
  await drawer.getByRole('button', { name: 'Use home shirt color', exact: true }).click();
  await drawer.getByLabel('Away shirt', { exact: true }).fill('#2d67ba'); await drawer.getByLabel('Shorts', { exact: true }).fill('#eeeeee');
  model.failOrganizations = true; await drawer.getByLabel('Belongs to an organization', { exact: true }).check(); await drawer.getByRole('button', { name: 'Retry organizations', exact: true }).waitFor();
  model.failOrganizations = false; await drawer.getByRole('button', { name: 'Retry organizations', exact: true }).click();
  await selectOrganization(drawer, 'Search organization', 'Community organization with a long descriptive name');
  await drawer.getByRole('button', { name: 'Add sponsor', exact: true }).click(); await selectOrganization(drawer, 'Search sponsor 1', 'Sponsor Alpha');
  await drawer.getByRole('button', { name: 'Change sponsor 1', exact: true }).click(); await selectOrganization(drawer, 'Search sponsor 1', 'Sponsor Beta');
  await drawer.getByRole('button', { name: 'Add sponsor', exact: true }).click(); await selectOrganization(drawer, 'Search sponsor 2', 'Sponsor Alpha');
  await drawer.getByRole('button', { name: 'Remove sponsor 1', exact: true }).click();
  await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await drawer.getByRole('alert').filter({ hasText: 'Could not create the team' }).waitFor();
  const failed = structuredClone(model.teamPayload); equal(failed.image.filename, 'synthetic-logo.png', 'Team multipart contains image'); check(failed.image.bytes > 0, 'Multipart image contains actual bytes');
  equal(await drawer.getByLabel('Name', { exact: true }).inputValue(), 'New community team', 'Team failure retains name'); check(await preview.count(), 'Team failure retains image preview');
  await drawer.getByRole('button', { name: 'Use home shirt color', exact: true }).scrollIntoViewIfNeeded(); await targets(page); await fit(page); await shot(page, 'team-form-kit-320');
  await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await page.waitForURL(url => url.pathname === '/teams/New%20community%20team'); await drawer.waitFor({ state: 'hidden' }); await page.getByRole('region', { name: 'Team information' }).waitFor();
  equal(model.teamPayload, failed, 'Retry sends unchanged team multipart fields');
  const p = model.teamPayload;
  equal(p.men_team, 'false', 'Gender preserved'); equal(p.public_team, 'true', 'Team privacy preserved'); equal(p.belongs_to_organization, 'owner', 'Organization selection payload preserved'); equal(p.sponsors, '["sponsor-a"]', 'Sponsor replace/remove has no stale IDs');
  equal(p.tshirt_color, '#000000', 'Deliberate initial black is submitted'); equal(p.away_tshirt_color, '#2d67ba', 'Away kit preserved'); equal(p.shorts_color, '#eeeeee', 'Shorts preserved'); check(!('socks_color' in p), 'Untouched optional kit field stays absent');
  equal(p.founded_at, await page.evaluate(() => new Date('2020-03-04T00:00:00').toISOString()), 'Founded date preserved'); equal(p.categories, '[{"pk":"category-1","name":"Ball games"}]', 'Team categories preserved');
  equal([p.country_name, p.state_name, p.city_name, p.location], [data.country, data.state, data.city, data.place.pk], 'Team geography preserved');
  await clean(run);
}
async function organizationForm() {
  for (const changedCity of [false, true]) {
    const run = await setup({ authenticated: true }); const { page, model } = run; const drawer = await openCreate(page, 'organizations');
    await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await drawer.getByRole('alert').waitFor(); equal(model.writes.length, 0, 'Invalid organization sends no writes');
    await drawer.getByLabel('Name', { exact: true }).fill('New community club'); await manualVenue(page, drawer, { city: changedCity ? 'New city' : data.city });
    const before = model.writes.length;
    if (changedCity) { await imageValidation(page, drawer, 'Picture (optional)'); equal(model.writes.length, before, 'Invalid image MIME and size block organization multipart'); }
    await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await drawer.getByRole('alert').filter({ hasText: 'Could not create the organization' }).waitFor();
    const failed = structuredClone(model.organizationPayload); equal(await drawer.getByLabel('Name', { exact: true }).inputValue(), 'New community club', 'Organization failure retains name');
    await shot(page, 'organization-form-error-' + (changedCity ? 'new-city' : 'same-city'));
    await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await drawer.waitFor({ state: 'hidden' }); await page.getByRole('button', { name: 'About New community club', exact: true }).waitFor();
    equal(model.organizationPayload, failed, 'Organization retry preserves multipart'); equal(failed.pk_for_location, data.place.pk, 'Organization venue field preserved'); equal([failed.country, failed.state, failed.city], [data.country, data.state, changedCity ? 'New city' : data.city], 'Organization geography preserved');
    if (changedCity) equal(failed.image.filename, 'synthetic-logo.png', 'Organization image multipart preserved'); else check(!('image' in failed), 'Optional organization image can be omitted');
    equal(new URL(page.url()).searchParams.get('city'), changedCity ? 'New city' : data.city, 'Created organization establishes actual response geography'); equal(new URL(page.url()).searchParams.get('q'), '', 'Created organization clears stale search');
    equal(await page.evaluate(() => Boolean(history.state.usr?.createdOrganization || history.state.usr?.organizationResultsInvalidated)), false, 'Organization handoff flags are consumed');
    equal(model.countryReads, 2, 'Organization form preserves sole venue catalogue refresh owner');
    await fit(page); await shot(page, 'organization-created-' + (changedCity ? 'new-city' : 'same-city')); await clean(run);
  }
}
async function mapFailure() {
  const run = await setup(); const { page } = run;
  await page.goto(BASE + '/map' + data.query('activities').replace('view=list', 'view=map'));
  await page.getByText(/Map unavailable/).waitFor(); await until(() => page.locator('[data-result-id]').count());
  check(await page.getByRole('link', { name: data.activity.title, exact: true }).count(), 'Map failure keeps usable list alternative'); await fit(page); await shot(page, 'map-failure-list-390'); await clean(run);
}
// Pixels outside the synthetic pin must contain painted basemap detail, not a flat canvas.
async function basemapTexture(page, screenshot) {
  const region = await page.evaluate(() => {
    const canvas = document.querySelector('.maplibregl-canvas').getBoundingClientRect(), panel = document.querySelector('.discovery-results').getBoundingClientRect();
    const bottom = panel.left < canvas.right && panel.right > canvas.left ? panel.top : canvas.bottom;
    return { x: canvas.x, y: canvas.y, width: canvas.width, height: bottom - canvas.y - 32, pinY: (canvas.height + 40 - 240) / 2 };
  });
  return page.evaluate(({ png, region }) => new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(region.x, region.y, region.width, region.height).data, colors = new Set(); let edges = 0;
      for (let y = 20; y < region.height - 4; y += 4) for (let x = 12; x < region.width - 12; x += 4) {
        if (Math.abs(x - region.width / 2) < 70 && Math.abs(y - region.pinY) < 70) continue;
        const index = (y * region.width + x) * 4, next = index + 12;
        const rgb = [...pixels.slice(index, index + 3)]; colors.add(rgb.map(value => Math.floor(value / 16)).join(','));
        if (rgb.reduce((sum, value, channel) => sum + Math.abs(value - pixels[next + channel]), 0) > 35) edges++;
      }
      resolve({ colors: colors.size, edges });
    };
    image.src = 'data:image/png;base64,' + png;
  }), { png: screenshot.toString('base64'), region });
}

async function realMap() {
  const run = await setup({ realMap: true }); const { page, model } = run; model.one = true;
  let tileSuccess = 0, tileFailure = 0, sdkSuccess = 0; const urbanTextures = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.hostname.endsWith('maptiler.com') && /\.(pbf|webp|png|jpg)/.test(url.pathname)) response.ok() ? tileSuccess++ : tileFailure++;
    if (url.hostname === 'telegram.org' && response.ok()) sdkSuccess++;
  });
  await page.goto(BASE + '/map' + data.query('activities').replace('view=list', 'view=map'));
  await until(() => tileSuccess > 0, 'Real provider tile responses succeed');
  await page.waitForLoadState('networkidle');
  equal(await page.getByText(/Map unavailable/).count(), 0, 'Real WebGL map remains available');
  check(await page.evaluate(() => Boolean(window.Telegram?.WebApp)), 'Real Telegram SDK loads in browser');
  check(sdkSuccess > 0, 'Real SDK fetched without interception');
  const canvas = page.locator('.maplibregl-canvas'); await canvas.waitFor();
  async function pin() {
    try { await until(async () => {
      const box = await canvas.boundingBox();
      // fitBounds reserves 40px above and 240px below the one public synthetic point.
      await page.mouse.click(box.x + box.width / 2, box.y + (box.height + 40 - 240) / 2);
      return page.getByText('Open this result in the list for details.', { exact: true }).isVisible();
    }, 'Actual rendered pin is selectable after style/viewport change'); } catch (error) {
      await shot(page, 'real-map-failure-' + page.viewportSize().width);
      throw new Error(error.message + ': ' + JSON.stringify(await canvas.evaluate(el => ({ internalWidth: el.width, clientWidth: el.clientWidth, box: el.getBoundingClientRect().toJSON() }))));
    } checks++;
    await page.getByRole('button', { name: 'Close selection', exact: true }).click();
    await page.getByRole('button', { name: 'Close selection', exact: true }).waitFor({ state: 'hidden' });
  }
  await pin();
  for (const width of [390, 320, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 960 : 844 }); await settle(page);
    for (const theme of ['light', 'dark']) {
      const changed = await page.evaluate(theme => document.documentElement.classList.contains('dark') !== (theme === 'dark'), theme);
      const replacement = changed ? page.waitForResponse(response => { const url = new URL(response.url()); return url.hostname.endsWith('maptiler.com') && /\/maps\/.*\/style\.json$/.test(url.pathname); }) : null;
      await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme);
      if (replacement) { const response = await replacement; check(response.ok(), 'Replacement provider style succeeds'); await response.finished(); }
      await page.waitForLoadState('networkidle'); await settle(page);
      await page.waitForFunction(() => !document.body.textContent.includes('Loading map tiles…'), { timeout: 25000 });
      await pin();
      await page.waitForFunction(() => !document.body.textContent.includes('Loading map tiles…'), { timeout: 25000 });
      await page.waitForLoadState('networkidle'); await settle(page);
      const screenshot = await shot(page, 'real-map-' + width + '-' + theme);
      const texture = await basemapTexture(page, screenshot);
      urbanTextures.push({ width, theme, ...texture });
      check(texture.colors > 8 && texture.edges > 20, 'Urban basemap paints varied street texture outside the pin: ' + JSON.stringify(texture));
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await settle(page);
  let attribution;
  await until(async () => {
    attribution = await page.evaluate(() => {
      const panel = document.querySelector('.discovery-results').getBoundingClientRect(), attrib = document.querySelector('.maplibregl-ctrl-attrib').getBoundingClientRect();
      return { clear: attrib.bottom <= panel.top + 1, panelTop: panel.top, attributionBottom: attrib.bottom };
    });
    return attribution.clear;
  }, 'Attribution settles above compact controls');
  check(attribution.clear, 'Attribution stays above compact controls');
  const mountedCanvas = await canvas.elementHandle();
  await page.getByRole('button', { name: 'List', exact: true }).click(); await until(() => page.locator('[data-result-id]').count());
  equal(new URL(page.url()).searchParams.get('city'), data.city, 'Map to list preserves city');
  await page.getByRole('button', { name: 'Map', exact: true }).click(); check(await mountedCanvas.evaluate(el => el.isConnected), 'List to map retains mounted map');
  equal(new URL(page.url()).searchParams.get('q'), 'ball', 'Map/list preserves text filter');
  await page.getByRole('button', { name: 'Expand results', exact: true }).click();
  await until(async () => await page.locator('.discovery-map').evaluate(el => getComputedStyle(el).visibility === 'hidden'), 'Expanded results cover map and provider controls'); checks++;
  await page.getByRole('button', { name: 'Compact results', exact: true }).click(); await settle(page);
  const before = model.resultReads;
  await canvas.dragTo(canvas, { sourcePosition: { x: 100, y: 100 }, targetPosition: { x: 150, y: 130 } });
  equal(model.resultReads, before, 'Panning map does not change city-scoped results');
  check(tileSuccess > 0, 'Real tile successes recorded'); equal(tileFailure, 0, 'No provider tile failures');
  equal(model.writes.length, 0, 'Real provider case performs no content writes');
  fs.writeFileSync(path.join(OUT, 'real-provider.json'), JSON.stringify({ tileSuccess, tileFailure, sdkSuccess, urbanTextures }, null, 2)); await clean(run);
}

async function authControls() {
  const run = await setup(); const { page } = run;
  await page.goto(BASE + '/login'); await page.getByRole('button', { name: 'Send code', exact: true }).waitFor(); await targets(page);
  await page.getByLabel('Phone number').fill('+99890' + String(require('node:crypto').randomInt(1000000, 9999999)));
  await page.getByRole('button', { name: 'Send code', exact: true }).click(); await page.getByLabel('6-digit code').waitFor(); await targets(page);
  await clean(run);
}
async function themeContrast() {
  const run = await setup(); const { page } = run; const measurements = {};
  await page.goto(BASE + '/activities' + data.query('activities')); await page.getByRole('searchbox').waitFor();
  for (const theme of ['light', 'dark']) { await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme); measurements[theme] = await contrastPairs(page); }
  fs.writeFileSync(path.join(OUT, 'contrast.json'), JSON.stringify(measurements, null, 2)); await clean(run);
}

async function nativeKit() {
  for (const [label, field] of [['home shirt', 'tshirt_color'], ['away shirt', 'away_tshirt_color'], ['shorts', 'shorts_color'], ['socks', 'socks_color']]) {
    const run = await setup({ authenticated: true }); const { page, model } = run; const drawer = await openCreate(page, 'teams');
    await drawer.getByLabel('Name', { exact: true }).fill('Native black team'); await drawer.getByLabel('Founded date', { exact: true }).fill('2020-03-04'); await manualVenue(page, drawer);
    await drawer.getByRole('button', { name: 'Use ' + label + ' color', exact: true }).click();
    await drawer.getByRole('button', { name: 'Create', exact: true }).click(); await drawer.getByRole('alert').filter({ hasText: 'Could not create the team' }).waitFor();
    equal(model.teamPayload[field], '#000000', 'Native initial black is submitted for ' + label);
    for (const other of ['tshirt_color', 'away_tshirt_color', 'shorts_color', 'socks_color'].filter(other => other !== field)) check(!(other in model.teamPayload), 'Untouched kit remains optional');
    await discard(page, drawer); await clean(run);
  }
}

async function importFailure() {
  const run = await setup({ authenticated: true }); const { page, context, errors } = run;
  await context.route(url => url.pathname.endsWith('/NewTeamDrawer.tsx'), route => route.abort());
  await page.goto(BASE + '/teams' + data.query('teams'));
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const drawer = page.getByRole('dialog'); await drawer.getByRole('alert').filter({ hasText: 'Could not load this form' }).waitFor();
  check(await drawer.getByRole('button', { name: 'Reload form', exact: true }).isEnabled(), 'Failed import offers explicit reload');
  await drawer.getByRole('button', { name: 'Close', exact: true }).click(); await drawer.waitFor({ state: 'hidden' });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Activities', exact: true }).click();
  await page.getByRole('searchbox').waitFor(); check(errors.every(error => /Failed to fetch dynamically imported module/.test(error)), 'Only deliberate failed-import errors were observed'); errors.length = 0; await clean(run);
}

async function entryLoading() {
  const run = await setup({ authenticated: true }); const { page, context, resources } = run;
  await page.goto(BASE + '/activities' + data.query('activities')); await page.getByRole('searchbox').waitFor();
  const formModules = resources.filter(resource => /NewTeamDrawer|NewOrganizationDrawer|NewActivityDrawer/.test(resource));
  const bytes = await page.evaluate(() => performance.getEntriesByType('resource').filter(resource => /NewTeamDrawer|NewOrganizationDrawer|NewActivityDrawer/.test(new URL(resource.name).pathname)).reduce((total, resource) => total + resource.decodedBodySize, 0));
  fs.writeFileSync(path.join(OUT, 'entry-loading.json'), JSON.stringify({ initialFormModuleRequests: formModules.length, initialFormDecodedBytes: bytes }, null, 2));
  equal(formModules.length, 0, 'Discovery entry defers form modules until Create');
  let release; const gate = new Promise(resolve => { release = resolve; }); let requested = false;
  await context.route(url => url.pathname.endsWith('/NewTeamDrawer.tsx'), async route => { requested = true; await gate; await route.continue(); });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Teams', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'Loading team form' }).waitFor(); check(requested, 'Delayed form chunk requested on demand');
  release(); await page.getByRole('dialog').getByLabel('Name', { exact: true }).waitFor(); await discard(page, page.getByRole('dialog')); await clean(run);
}
async function stalePersistence() {
  for (const pending of ['venue', 'organization']) {
    const run = await setup({ authenticated: true }); const { page, context, model } = run;
    const drawer = await openCreate(page, 'organizations'); await drawer.getByLabel('Name', { exact: true }).fill('Discarded club');
    let release; const gate = new Promise(resolve => { release = resolve; }); let requested = false;
    const endpoint = pending === 'venue' ? '/api/locations/' : '/api/organizations/';
    await context.route(url => url.pathname === endpoint, async route => { if (route.request().method() !== 'POST') return route.fallback(); requested = true; await gate; await route.fulfill({ json: { error: 0, data: pending === 'venue' ? { pk: data.place.pk, name: data.place.name } : { ...data.organization, name: 'Discarded club' } } }); });
    if (pending === 'organization') { await manualVenue(page, drawer); await drawer.getByRole('button', { name: 'Create', exact: true }).click(); }
    else {
      await drawer.getByLabel('Venue name', { exact: true }).fill(data.place.name);
      if (!await drawer.getByLabel('Longitude', { exact: true }).isVisible()) await drawer.getByRole('button', { name: 'Enter location manually', exact: true }).click();
      for (const [label, value] of [['Longitude', '10'], ['Latitude', '20'], ['Country', data.country], ['State or region', data.state], ['City', data.city]]) await drawer.getByLabel(label, { exact: true }).fill(value);
      await drawer.getByRole('button', { name: 'Use this location', exact: true }).click();
    }
    await until(() => requested, 'Persistence request reaches controlled boundary'); await discard(page, drawer);
    await page.getByRole('button', { name: 'Create', exact: true }).click(); const replacement = page.getByRole('dialog'); await replacement.getByLabel('Name', { exact: true }).fill('Replacement draft');
    const before = pending === 'venue' ? model.countryReads : model.resultReads; release();
    await until(() => (pending === 'venue' ? model.countryReads : model.resultReads) > before, 'Discarded persistence still invalidates owned catalogue/results');
    equal(await replacement.getByLabel('Name', { exact: true }).inputValue(), 'Replacement draft', 'Old persistence cannot replace current draft');
    equal(await replacement.getByRole('button', { name: 'Change location', exact: true }).count(), 0, 'Old venue cannot select location in replacement');
    equal(new URL(page.url()).pathname, '/organizations', 'Old persistence cannot navigate away from replacement'); await discard(page, replacement); await clean(run);
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
  try {
    for (const [name, fn] of Object.entries({ copy, responsive, navigation, geography, 'auth-controls': authControls, 'contrast': themeContrast, 'auth-participation': authParticipation, 'team-join': teamJoin, 'modal-focus': modalFocus, accessibility, 'native-adapter': nativeAdapter, 'activity-form': activityForm, 'team-form': teamForm, 'native-kit': nativeKit, 'organization-form': organizationForm, 'map-failure': mapFailure, 'real-map': realMap, 'import-failure': importFailure, 'entry-loading': entryLoading, 'stale-persistence': stalePersistence })) await runCase(name, fn);
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ checks, results }, null, 2));
  console.log(`${results.filter(result => result.status === 'PASS').length}/${results.length} cases; ${checks} assertions`);
  process.exitCode = results.some(result => result.status === 'FAIL') || results.length === 0 ? 1 : 0;
})().catch(() => { console.error('Browser runner could not start; verify documented module/browser/server environment.'); process.exitCode = 1; });
