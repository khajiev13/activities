/* Headless regression of real app/SDK; every content/auth/provider/native boundary is synthetic. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const data = require('./fixtures/mobile-data.cjs');
const native = require('./fixtures/discovery-native.cjs');
const BASE = process.env.EVENTOPIA_BASE_URL || 'http://localhost:5173';
const OUT = path.resolve(process.env.SCREENSHOT_DIR || '.artifacts/full-map');
const selected = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const results = []; const observations = []; let checks = 0; let browser;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
async function until(fn, message = 'Expected rendered state') { const start = Date.now(); while (Date.now()-start < 20000) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 50)); } throw new Error(message); }
async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function shot(page, name) { if(!name.startsWith('failure-')) { await until(()=>page.evaluate(()=>!document.body.textContent.includes('Loading map tiles…')), 'Real map tiles settle before evidence screenshot'); await settle(page); } await page.screenshot({ path: path.join(OUT, name+'.png'), animations: 'disabled' }); }
async function setup(options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...options.context });
  const model = await data.install(context, { authenticated: true, realMap: true, ...options });
  await native.install(context, { cached: native.preference(), permission: 'prompt', ...options.native });
  const provider = await native.provider(context, options.provider);
  // Observation only, injected into the served dev response. SDK/map/rendering remain real.
  // No production file, export, test-only API or geometry is changed.
  await context.route(url => url.pathname === '/src/components/Map/BaseMap.tsx', async route => {
    const response = await route.fetch(); const body = await response.text();
    assert.ok(body.includes('callbacks.current.onMapLoad(map);'), 'Actual BaseMap observation boundary exists');
    await route.fulfill({ response, body: body.replace('callbacks.current.onMapLoad(map);', 'window.__observedMap = map; callbacks.current.onMapLoad(map);') });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000); const errors = [];
  page.on('pageerror', error => errors.push(error.name));
  return { context, model, provider, page, errors };
}
async function ready(run, url = '/map') { await run.page.goto(BASE+url); await run.page.locator('.discovery-city').waitFor(); await until(() => run.page.evaluate(() => Boolean(window.__observedMap?.isStyleLoaded())), 'Real SDK style loads'); await settle(run.page); }
async function close(page) { await page.getByRole('button', { name: 'Close', exact: true }).click(); await settle(page); }
async function clean(run) { equal(run.errors, [], 'No browser exceptions'); equal(run.model.unknown, [], 'No unknown fixture APIs'); check(run.provider.every(call => !call.credentials), 'Provider receives no app credentials'); equal(run.model.writes, [], 'Discovery performs no content writes'); await run.context.close(); }
async function camera(page) { await settle(page); return page.evaluate(() => { const map = window.__observedMap; const c = map.getCenter(); return { center: [c.lng,c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }; }); }
async function pan(page) {
  const start = await camera(page);
  // A settled real cluster can occupy the map center. Find an actual transparent
  // gap using fixed samples; never drag a marker/control or force pointer events.
  const point = await page.evaluate(() => {
    const y = Math.min(360, innerHeight / 2);
    return [[innerWidth / 2, y], [innerWidth * .35, y], [innerWidth * .65, y], [innerWidth / 2, y - 50]]
      .map(([x, y]) => ({ x, y }))
      .find(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('maplibregl-canvas'));
  });
  check(Boolean(point), 'Transparent gap hits actual canvas');
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(Math.min(page.viewportSize().width - 20, point.x + 65), point.y + 30, { steps: 10 }); await page.mouse.up();
  await until(async () => JSON.stringify(await camera(page)) !== JSON.stringify(start), 'Map gesture changes real camera');
  await until(() => page.evaluate(() => !window.__observedMap.isMoving())); return camera(page);
}
async function geometry(page, label) {
  await until(()=>page.evaluate(()=> { const root=document.querySelector('[data-discovery-geometry]'); const credits=[...root.querySelectorAll('.maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right')];const measured=Math.ceil(Math.max(30,...credits.flatMap(el=>[el,...el.querySelectorAll('a')].map(el=>el.getBoundingClientRect().height))));return credits.length===2&&parseInt(root.style.getPropertyValue('--discovery-credit-height'))===measured; }));
  await until(()=>page.evaluate(()=>{const root=document.querySelector('[data-discovery-geometry]');const dock=root.querySelector('[data-discovery-dock]').getBoundingClientRect();const action=root.querySelector('[data-discovery-actions]');const upper=(root.querySelector('[data-discovery-preview]')||(action&&!action.hidden?action:null))?.getBoundingClientRect();return upper&&[...root.querySelectorAll('.maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right')].every(el=>{const r=el.getBoundingClientRect();return r.top>=upper.bottom+9&&r.bottom<=dock.top-7;});}), 'Measured credits settle clear of actions and dock: '+label);
  await settle(page);
  const m = await page.evaluate(() => {
    const rect=el=> { const r=el.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    const hit=el=>[...el.getClientRects()].some(r=>r.width&&r.height&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)));
    const credits=[...document.querySelectorAll('.maplibregl-ctrl-bottom-left,.maplibregl-ctrl-bottom-right')];
    const actions=document.querySelector('[data-discovery-actions]'), preview=document.querySelector('[data-discovery-preview]');
    return { map:rect(document.querySelector('.discovery-map')), dock:rect(document.querySelector('[data-discovery-dock]')), top:rect(document.querySelector('[data-discovery-top]')), actions:actions&&!actions.hidden?rect(actions):null, preview:preview?rect(preview):null, credits:credits.map(rect), links:credits.flatMap(el=>[...el.querySelectorAll('a')]).filter(el=>el.getBoundingClientRect().width).map(el=>({text:el.getAttribute('aria-label')||el.textContent,box:rect(el),hit:hit(el)})), categories:[...document.querySelectorAll('.discovery-entities button')].map(el=>({box:rect(el),label:el.getAttribute('aria-label'),pressed:el.getAttribute('aria-pressed'),hit:hit(el)})), width:document.documentElement.scrollWidth };
  });
  equal(m.width,page.viewportSize().width,'No page horizontal overflow: '+label);
  check(m.map.width===page.viewportSize().width,'Map spans viewport: '+label);
  check(m.categories.every(item=>item.box.width>=48&&item.box.height>=48&&item.label&&item.hit),'Three exposed48px named categories: '+label);
  equal(m.categories.filter(item=>item.pressed==='true').length,1,'Exactly one category pressed');
  check(m.credits.length===2&&m.links.some(link=>link.text==='MapTiler logo'),'Actual SDK logo and credit links inserted');
  check(m.credits.every(credit=>credit.bottom<=m.dock.y-7),'Credits clear dock: '+label);
  const upper=m.preview||m.actions; check(upper&&m.credits.every(credit=>credit.y>=upper.bottom+9),'Credits clear actions/preview: '+label);
  check(m.links.every(link=>link.hit),'SDK credits remain clickable: '+label);
  check(m.dock.bottom<=m.map.bottom-11,'Dock stays within bottom inset');
  observations.push({label,...m}); return m;
}
async function geometryMatrix() {
  for (const [width,height] of [[320,568],[320,844],[390,844],[1280,960]]) {
    const size=width+'x'+height;
    const run=await setup({context:{viewport:{width,height}},native:{safeTop:64,safeBottom:34,viewportHeight:height}}); const {page}=run;
    await ready(run); await page.getByRole('link',{name:'MapTiler logo'}).waitFor();
    const initial=await geometry(page,'shell-'+size); equal(initial.map.height,height,'Map fills matching usable viewport');
    check(initial.top.y+64<=initial.categories[0].box.y,'Top safe inset respected');
    check(initial.dock.bottom<=initial.map.bottom-45,'Bottom safe inset34 plus12 respected');
    await shot(page,'shell-'+size); const panned=await pan(page); equal(run.model.resultReads,1,'Pan does not request a different city');
    for (const entity of ['teams','organizations','activities']) {
      await page.getByRole('button',{name:entity[0].toUpperCase()+entity.slice(1),exact:true}).click();
      await page.getByRole('button',{name:new RegExp('^Results: \\d+ '+entity)}).waitFor();
      equal(new URL(page.url()).searchParams.get('entity'),entity,'Category changes query');
      equal(await camera(page),panned,'Category keeps real pan');
      await geometry(page,entity+'-'+size);
    }
    // SDK compact attribution expands through its own control, never a fake node.
    const attrib=page.locator('.maplibregl-ctrl-attrib'); const summary=attrib.locator('summary');
    if(await summary.isVisible()) { await summary.click(); await until(()=>attrib.evaluate(el=>el.classList.contains('maplibregl-compact-show')||el.open), 'Actual SDK attribution expands'); }
    await geometry(page,'expanded-attribution-'+size); await shot(page,'expanded-'+size);
    await page.getByRole('button',{name:'Organizations',exact:true}).click(); await page.getByRole('button',{name:/^Results:/}).click();
    await page.getByRole('button',{name:'About Community club'}).click();
    await until(()=>page.locator('[data-discovery-preview]').isVisible());
    const preview=await geometry(page,'preview-'+size); check(!preview.actions,'Preview replaces action row'); await shot(page,'preview-'+size);
    await page.getByRole('button',{name:'Close preview'}).click(); await clean(run);
  }
}
async function surfaceKeyboard() {
  const run=await setup({native:{safeTop:64,safeBottom:34}});const {page}=run;await ready(run);
  await page.getByRole('button',{name:'Search activities',exact:true}).click();
  equal(await page.getByRole('dialog').count(),1,'One search surface');check(await page.locator('[data-discovery-background]').evaluate(el=>el.inert&&el.getAttribute('aria-hidden')==='true'),'Map hidden/inert while covered');
  check(await page.getByRole('searchbox').evaluate(el=>document.activeElement===el),'Search receives focus');
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');check(await page.getByRole('dialog').evaluate(el=>el.contains(document.activeElement)),'Tab trapped in covering surface');}
  await page.evaluate(()=>window.__native.back());await until(()=>page.getByRole('button',{name:'Search activities',exact:true}).evaluate(el=>document.activeElement===el),'Native Back closes search and returns focus');checks++;
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'Choose a city',exact:true}).click();
  equal(await page.getByRole('dialog').count(),1,'City replaces Profile');await page.evaluate(()=>window.__native.back());await page.getByRole('heading',{name:'Profile',exact:true}).waitFor();check(true,'Native Back returns city to Profile');await page.evaluate(()=>window.__native.back());await until(()=>page.getByRole('button',{name:'Profile',exact:true}).evaluate(el=>document.activeElement===el),'Nested Profile returns dock focus');checks++;
  await page.locator('.discovery-city').click();await page.evaluate(()=>window.__native.viewport(360,42));await page.getByLabel('Search cities and places',{exact:true}).fill('Shared');
  const field=page.getByLabel('Search cities and places',{exact:true});await field.scrollIntoViewIfNeeded();await field.focus();await settle(page);
  const exposed=await field.evaluate(el=>{const r=el.getBoundingClientRect();return r.y>=42&&r.bottom<=402&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});check(exposed,'Short visual viewport+offset exposes focused city field');
  const cb=await page.getByRole('button',{name:'Close',exact:true}).boundingBox();check(cb.y>=42&&cb.y+cb.height<=402,'Close reachable above simulated keyboard');await shot(page,'short-city-keyboard');await close(page);
  await page.evaluate(()=>window.__native.viewport(844,0));await page.getByRole('button',{name:'Create',exact:true}).focus();await page.keyboard.press('Enter');const drawer=page.getByRole('dialog');await drawer.getByLabel('Title',{exact:true}).fill('Retained keyboard draft');
  await page.evaluate(()=>window.__native.viewport(360,42));await drawer.getByLabel('Duration (minutes)',{exact:true}).scrollIntoViewIfNeeded();await drawer.getByLabel('Duration (minutes)',{exact:true}).focus();await settle(page);await shot(page,'short-create-keyboard');
  check(await drawer.getByLabel('Duration (minutes)',{exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();return r.y>=42&&r.bottom<=402&&el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Create focused field exposed at keyboard offset');
  await page.evaluate(()=>window.__native.back());await page.getByRole('button',{name:'Keep editing',exact:true}).click();equal(await drawer.getByLabel('Title',{exact:true}).inputValue(),'Retained keyboard draft','Native rejected close retains draft');
  await page.evaluate(()=>window.__native.back());await page.getByRole('button',{name:'Discard draft',exact:true}).click();await drawer.waitFor({state:'hidden'});check(true,'Native accepted discard closes Create');await clean(run);
}
async function textAndLegacy() {
  const run=await setup();const {page}=run;const long='Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch';
  await ready(run,'/activities'+data.query('activities'));await close(page);await page.getByRole('button',{name:'Teams',exact:true}).click();
  equal(new URL(page.url()).pathname,'/map','Legacy category switch normalizes to map');equal(new URL(page.url()).searchParams.get('view'),'map','Legacy category switch does not reopen Results');
  equal(new URL(page.url()).searchParams.get('q'),'ball','Legacy category keeps search');equal(new URL(page.url()).searchParams.get('city'),data.city,'Legacy category keeps city');equal(await page.getByRole('dialog').count(),0,'Resting map remains uncovered');
  await page.goto(BASE+'/map?'+new URLSearchParams({level:'city',country:data.country,state:data.state,city:long,entity:'teams',view:'map'}));await page.locator('.discovery-city').waitFor();await until(()=>page.evaluate(()=>Boolean(window.__observedMap?.isStyleLoaded())), 'Long-label real SDK loads');await page.getByRole('link',{name:'MapTiler logo'}).waitFor();await page.evaluate(()=>document.documentElement.style.fontSize='32px');await settle(page);
  equal(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize),'32px','True200% root text');await geometry(page,'200percent-long-city');await shot(page,'text200-long-city');
  await page.locator('.discovery-city').click();await page.getByLabel('Search cities and places').fill('Shared');equal(await page.getByRole('button',{name:/^Shared city,/}).count(),3,'Duplicate names retain all three parent tuples');await close(page);await clean(run);
}
async function cityCamera() {
  const run=await setup({provider:{row:native.row('No records city',data.state,[2.3522,48.8566],2988507)}});const {page,model}=run;await ready(run);const panned=await pan(page);model.empty=true;
  await page.locator('.discovery-city').click();await page.getByLabel('Search cities and places').fill('No records');await page.getByRole('button',{name:`No records city, ${data.state}, ${data.country}`,exact:true}).click();
  await until(()=>page.getByRole('dialog').count().then(n=>!n),'City select closes immediately');await page.getByRole('button',{name:'Results: 0 activities',exact:true}).waitFor();
  const moved=await camera(page);check(Math.abs(moved.center[0]-panned.center[0])>1,'City without records moves actual camera');
  const projected=await page.evaluate(()=>{const p=window.__observedMap.project([2.3522,48.8566]);return{x:p.x,y:p.y};});check(projected.x>0&&projected.x<390&&projected.y>150&&projected.y<600,'Selected public center is in visible map');
  equal(new URL(page.url()).searchParams.get('city'),'No records city','Manual provider city publishes query');check(!new URL(page.url()).searchParams.has('loc'),'Manual selection removes following');
  const again=await pan(page);await page.getByRole('button',{name:'Profile',exact:true}).click();await close(page);equal(await camera(page),again,'Profile return keeps pan');
  await page.getByRole('button',{name:'Search activities',exact:true}).click();await page.getByRole('searchbox').fill('empty');await page.getByRole('button',{name:'Show on map'}).click();equal(await camera(page),again,'Query change keeps pan');
  await page.getByRole('button',{name:'Center map',exact:true}).click();check(JSON.stringify(await camera(page))!==JSON.stringify(again),'Explicit Center map resets pan once');
  await page.reload();await page.locator('.discovery-city').waitFor();equal(new URL(page.url()).searchParams.get('city'),'No records city','Reload remembers city');await clean(run);
}
async function following() {
  const run=await setup({native:{cached:native.preference('auto'),permission:'granted'}});const {page}=run;await ready(run);await until(()=>page.evaluate(()=>window.__native.calls===1),'Granted automatic launch resolves once');
  equal(new URL(page.url()).searchParams.get('loc'),'auto','Automatic mode marks URL');const panned=await pan(page);
  await page.evaluate(()=>window.__native.resume(100));equal(await page.evaluate(()=>window.__native.calls),1,'Paired foreground events within throttle do not duplicate');
  await page.evaluate(()=>window.__native.resume());await until(()=>page.evaluate(()=>window.__native.calls===2));equal(await camera(page),panned,'Same-city automatic check preserves pan');
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.evaluate(()=>window.__native.resume());equal(await page.evaluate(()=>window.__native.calls),2,'Automatic paused under Profile');await close(page);await until(()=>page.evaluate(()=>window.__native.calls===3));
  await page.evaluate(()=>{window.Telegram.WebApp.LocationManager.isAccessGranted=false;window.__native.resume();});equal(await page.evaluate(()=>window.__native.calls),3,'Revoked permission never prompts GPS');check(await page.getByRole('status').filter({hasText:'Location access is denied'}).isVisible(),'Revocation gives recovery notice');
  await page.locator('.discovery-city').click();await page.getByRole('button',{name:`Shared city, Other state, ${data.country}`,exact:true}).click();await page.evaluate(()=>window.__native.resume());equal(await page.evaluate(()=>window.__native.calls),3,'Manual city persists across resume');
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.evaluate(()=>window.Telegram.WebApp.LocationManager.isAccessGranted=true);await page.getByRole('button',{name:'Use current location',exact:true}).click();await until(()=>page.getByText('Following your city',{exact:true}).count().then(n=>n>0));equal(await page.evaluate(()=>window.__native.calls),4,'Explicit Profile resume requests one fix');
  await page.getByRole('button',{name:'Forget remembered places',exact:true}).click();const stored=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),native.key);equal({mode:stored.mode,place:stored.place,recent:stored.recent,welcomeSeen:stored.welcomeSeen},{mode:'off',place:null,recent:[],welcomeSeen:true},'Forget persists disabled following and dismissed welcome');
  await close(page);await page.evaluate(()=>window.__native.resume());equal(await page.evaluate(()=>window.__native.calls),4,'Forget prevents resume GPS');await page.reload();await page.locator('.discovery-city').waitFor();equal(await page.getByRole('dialog').count(),0,'Forget reload does not reopen welcome');equal(await page.evaluate(()=>window.__native.calls),0,'Forget reload makes no GPS request');
  const privacy=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage},url:location.href}));check(!/latitude|longitude|accuracy|initData/.test(privacy),'No precise GPS/auth data persisted or URL encoded');await clean(run);
}
async function staleRaces() {
  // Late native restore cannot replace newer accepted manual city.
  const run=await setup({native:{delayedRead:true,stored:native.preference('auto',native.place('Late storage city'),Date.now()+1000)}});const {page}=run;await page.goto(BASE+'/map',{waitUntil:'domcontentloaded'});await page.locator('.discovery-city').click();await page.getByRole('button',{name:`Shared city, Other state, ${data.country}`,exact:true}).click();await page.evaluate(()=>window.__native.pendingRead?.());await settle(page);equal(new URL(page.url()).searchParams.get('city'),'Shared city','New manual city defeats delayed newer-native restore');equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).mode,native.key),'manual','Newer manual persistence wins');await clean(run);
  // Bounded restore is staged while covered, then reconciled on Map.
  const staged=await setup({native:{delayedRead:true,stored:native.preference('manual',native.place('Stored return city'),Date.now()+1000)}});await staged.page.goto(BASE+'/map',{waitUntil:'domcontentloaded'});await staged.page.locator('.discovery-city').waitFor();await staged.page.getByRole('button',{name:'Profile',exact:true}).click();await staged.page.evaluate(()=>window.__native.pendingRead?.());await settle(staged.page);equal(new URL(staged.page.url()).searchParams.get('city'),data.city,'Covered restore does not publish');await close(staged.page);await until(()=>Promise.resolve(new URL(staged.page.url()).searchParams.get('city')==='Stored return city'));check(true,'Staged storage reconciles on Map');await clean(staged);
  // Late search/provider result cannot replace query2 or manual intent.
  let release;const gate=new Promise(resolve=>{release=resolve;});let held=false;
  const search=await setup({provider:{handle:async(route,url)=>{if(url.searchParams.get('name_startsWith')==='slow'){held=true;await gate;await route.fulfill({json:{geonames:[native.row('Stale search city')]}}).catch(()=>{});return true;}return false;}}});await ready(search);await search.page.locator('.discovery-city').click();await search.page.getByLabel('Search cities and places').fill('slow');await until(()=>held);await search.page.getByLabel('Search cities and places').fill('Shared');await search.page.getByRole('button',{name:`Shared city, Other state, ${data.country}`,exact:true}).click();release();await settle(search.page);equal(new URL(search.page.url()).searchParams.get('city'),'Shared city','Late search cannot overwrite accepted city');equal(await search.page.getByRole('dialog').count(),0,'Stale search does not reopen city');await clean(search);
  let providerRelease;const providerGate=new Promise(resolve=>{providerRelease=resolve;});let providerHeld=false;
  const gps=await setup({native:{permission:'granted'},provider:{handle:async(route,url)=>{if(url.pathname.includes('findNearby')){providerHeld=true;await providerGate;await route.fulfill({json:{geonames:[native.row()]}}).catch(()=>{});return true;}return false;}}});await ready(gps);await gps.page.locator('.discovery-city').click();await gps.page.getByRole('button',{name:'Use current location',exact:true}).click();await until(()=>providerHeld);await gps.page.getByRole('button',{name:`Shared city, Other state, ${data.country}`,exact:true}).click();providerRelease();await settle(gps.page);equal(new URL(gps.page.url()).searchParams.get('city'),'Shared city','Late GPS provider result cannot replace manual city');check(!new URL(gps.page.url()).searchParams.has('loc'),'Late provider cannot resume automatic mode');await clean(gps);
}
async function authAndMissingCenter() {
  const run=await setup({native:{cached:native.preference('auto'),permission:'granted'}});const {page,model}=run;await ready(run);await until(()=>page.evaluate(()=>window.__native.calls===1),'Automatic launch finishes before auth test');
  const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),native.key);
  await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'Log out',exact:true}).click();await page.getByRole('link',{name:'Log in',exact:true}).waitFor();
  equal(await page.evaluate(()=>window.__native.calls),1,'Logout causes no location fix');equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),native.key),before,'Logout retains coarse preference');
  await page.getByRole('link',{name:'Log in',exact:true}).click();await page.getByRole('button',{name:'Try again',exact:true}).waitFor();model.authenticated=true;await page.getByRole('button',{name:'Try again',exact:true}).click();await page.locator('.discovery-city').waitFor();
  equal(await page.evaluate(()=>window.__native.calls),1,'Login alone does not request another location');equal(new URL(page.url()).searchParams.get('loc'),'auto','Login return keeps explicit follow marker');equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),native.key),before,'Login retains coarse preference');await clean(run);
  const missing=await setup({provider:{row:native.row('Wrong center city')}});await ready(missing);const panBefore=await pan(missing.page);await missing.page.locator('.discovery-city').click();await missing.page.getByRole('button',{name:`Shared city, Other state, ${data.country}`,exact:true}).click();await missing.page.getByRole('status').filter({hasText:'Could not find this place’s center'}).waitFor();
  equal(await camera(missing.page),panBefore,'Missing center preserves real camera');check(await missing.page.getByRole('button',{name:'Center map',exact:true}).count()===2,'Missing center exposes explicit retry alongside normal Center');equal(new URL(missing.page.url()).searchParams.get('city'),'Shared city','Missing center still accepts coarse geography');await clean(missing);
}
async function versionsAndFailure() {
  for(const version of [8,9]) {const run=await setup({native:{version,permission:'denied',storageFailure:true}});await ready(run);check(await run.page.evaluate(()=>window.__native.reads).then(reads=>version>=9?reads>0:reads===0),'DeviceStorage only used on API9+');equal(await run.page.evaluate(()=>window.__native.calls),0,'Manual boot with denied permission never requests GPS');await run.page.locator('.discovery-city').click();await run.page.getByRole('button',{name:`Shared city, Other state, ${data.country}`,exact:true}).click();if(version>=9){await run.page.getByRole('button',{name:'Profile',exact:true}).click();await run.page.getByText('Your choice may not be remembered on this device.').waitFor();check(true,'Failed native persistence remains nonblocking and visible');}equal(new URL(run.page.url()).searchParams.get('city'),'Shared city','Storage failure does not undo selection');await clean(run);}
  const failure=await setup({native:{permission:'granted'},provider:{failure:true}});await ready(failure);await failure.page.getByRole('button',{name:'Profile',exact:true}).click();await failure.page.getByRole('button',{name:'Use current location',exact:true}).click();await failure.page.getByRole('status').filter({hasText:'Device location is unavailable'}).waitFor();const mode=await failure.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).mode,native.key);observations.push({label:'explicit-resume-provider-failure',mode});equal(mode,'auto','A successful explicit device fix persists following despite provider failure');check(new URL(failure.page.url()).searchParams.get('loc')==='auto','Failed city resolution retains the follow URL marker');await close(failure.page);await failure.page.evaluate(()=>window.__native.resume());await until(()=>failure.page.evaluate(()=>window.__native.calls===2));equal(await failure.page.locator('.discovery-city').innerText(),data.city+'\nFollowing your city','Failed resumed resolution retains the prior coarse city and shows following');await clean(failure);
}
async function runCase(name,fn){if(selected&&!selected.split(',').includes(name))return;const before=checks;try{await fn();results.push({name,status:'PASS',checks:checks-before});console.log('PASS '+name+' ('+(checks-before)+' checks)');}catch(error){results.push({name,status:'FAIL',checks:checks-before,message:error.message.replace(/https?:\/\/\S+/g,'[URL]').slice(0,1800)});console.error('FAIL '+name+': '+results.at(-1).message);for(const context of browser.contexts())for(const page of context.pages())await shot(page,'failure-'+name).catch(()=>{});}finally{for(const context of browser.contexts())await context.close();}}
(async()=>{fs.mkdirSync(OUT,{recursive:true});browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});try{for(const [name,fn]of Object.entries({'geometry-matrix':geometryMatrix,'surface-keyboard':surfaceKeyboard,'text-legacy':textAndLegacy,'city-camera':cityCamera,following,'stale-races':staleRaces,'versions-failure':versionsAndFailure,'auth-missing-center':authAndMissingCenter}))await runCase(name,fn);}finally{await browser.close();}fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({checks,results,observations},null,2));console.log(`${results.filter(r=>r.status==='PASS').length}/${results.length} cases; ${checks} assertions`);process.exitCode=results.some(r=>r.status==='FAIL')||!results.length?1:0;})().catch(error=>{console.error(error.name+': '+error.message.replace(/https?:\/\/\S+/g,'[URL]'));process.exitCode=1;});
