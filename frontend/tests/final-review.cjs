// Run with NODE_PATH pointing to an installed Playwright module; every API and map/geography call is intercepted.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const BASE = process.env.FINAL_REVIEW_BASE_URL || 'http://localhost:5173';
const envelope = data => JSON.stringify({ requestId: 'final-review', error: 0, data });
async function screenshot(page,name) {
 if(!process.env.FINAL_REVIEW_SCREENSHOT_DIR) return;
 await fs.mkdir(process.env.FINAL_REVIEW_SCREENSHOT_DIR,{recursive:true,mode:0o700});
 const path=require('node:path').join(process.env.FINAL_REVIEW_SCREENSHOT_DIR,name+'.png');
 await page.screenshot({path}); await fs.chmod(path,0o600);
}
async function phoneCase(browser) {
 const context = await browser.newContext(); const page = await context.newPage();
 await page.route(url => url.pathname.startsWith('/api/'), r => r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({requestId:'test',error:101,message:'Not authenticated'})}));
 let requests=0;
 await page.route('**/api/auth/otp/request', async r => { requests++; const phone=r.request().postDataJSON().phone; await r.fulfill({status:phone==='bad input'?422:200,contentType:'application/json',body:phone==='bad input'?JSON.stringify({requestId:'test',error:200,message:'Request validation failed'}):envelope({retry_after_seconds:0})}); });
 for (const phone of ['+998901234567','+998 90 123 45 67','90 123 45 67','+14155552671']) {
  await page.goto(BASE+'/login'); await page.getByLabel('Phone number').fill(phone); const before=requests;
  await page.getByRole('button',{name:'Send code',exact:true}).click();
  await assert.doesNotReject(()=>page.getByLabel('6-digit code').waitFor({timeout:3000}), 'valid phone must reach OTP endpoint');
  assert.equal(requests,before+1);
 }
 await page.goto(BASE+'/login'); await page.getByLabel('Phone number').fill('bad input'); await page.getByRole('button',{name:'Send code',exact:true}).click();
 await page.getByText('Unable to request a code. Check your phone number and try again.',{exact:true}).waitFor();
 await context.close(); console.log('PASS final-review I1 phone normalization-compatible form and safe invalid feedback');
}
const user = { uid: 'synthetic-user', username: 'synthetic-player', first_name: 'Test', last_name: 'Player', image_url: null };
const location = { pk: 'pitch', name: 'Synthetic pitch', points: { latitude: 39.9, longitude: 116.4 } };
const team = name => ({ name, image_url: null, founded_at: null, categories: [], men_team: true, public_team: true,
 country_name: 'China', state_name: 'Beijing', city_name: 'Beijing', location: [location],
 tshirt_color: [], shorts_color: [], socks_color: [], away_tshirt_color: [], members: [], sponsors: [], belongs_to_organization: [] });
const organization = name => ({ pk:'organization', name, image_url:null, created_at:'2026-11-08T00:00:00Z', location,
 country:{name:'China'},state:{name:'Beijing'},city:{name:'Beijing'},teams_count:0,number_of_people_joined:0,
 number_of_teams_sponsored:0,hosting_leagues_count:0,hosting_activities_count:0 });
async function createPage(browser, kind) {
 const context = await browser.newContext({viewport:{width:1440,height:1100}}); const page=await context.newPage();
 await page.route(url=>url.pathname.startsWith('/api/'),r=>r.fulfill({contentType:'application/json',body:envelope([])}));
 await page.route('**/api/auth/refresh',r=>r.fulfill({contentType:'application/json',body:envelope({access_token:'synthetic-transport-fixture'})}));
 await page.route('**/api/users/me',r=>r.fulfill({contentType:'application/json',body:envelope(user)}));
 await page.route('https://api.maptiler.com/**', r=>new URL(r.request().url()).pathname.endsWith('/style.json')
  ?r.fulfill({contentType:'application/json',body:JSON.stringify({version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#181818'}}]})}):r.abort());
 await page.route('https://secure.geonames.org/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(new URL(r.request().url()).pathname.includes('timezoneJSON')
  ?{countryCode:'CN',sunrise:'06:00',sunset:'18:00',timezoneId:'Asia/Shanghai'}:{geonames:[{countryName:'China',adminName1:'Beijing',name:'Beijing'}]})}));
 await page.route('**/api/locations/',r=>r.fulfill({status:201,contentType:'application/json',body:envelope(location)}));
 await page.route('**/api/categories/**',r=>r.fulfill({contentType:'application/json',body:envelope([{pk:'football',name:'Football',is_outdoor:true,is_indoor:false,is_online:false}])}));
 await page.goto(BASE+'/'+kind); await page.getByRole('button',{name:'User menu'}).waitFor();
 await page.locator('button:has(svg.lucide-plus)').first().click();
 return {page,context};
}
async function fillDrawer(page,kind,name) {
 await page.getByPlaceholder(kind==='teams'?'Write your team name':'Name of organization').fill(name);
 if(kind==='teams') {
 await page.getByRole('switch',{name:'Outdoor activity',exact:true}).click();
  await page.getByText('Select categories',{exact:true}).click();
  await page.getByRole('option',{name:'Football',exact:true}).click(); await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Pick a date'}).click();
  await page.getByRole('combobox').last().click(); await page.getByRole('option',{name:'Today',exact:true}).click(); await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'No',exact:true}).nth(0).click(); await page.getByRole('tab',{name:'No',exact:true}).nth(1).click();
 } else await page.locator('input[type=file]').setInputFiles({name:'image.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});
 await page.locator('.maplibregl-canvas').click({position:{x:200,y:150}});
 await page.locator('#location-input').fill(location.name); await page.locator('#location-submit').click();
 await page.locator('#location-input').waitFor({state:'hidden'});
}
async function drawerRetryCase(browser,kind) {
 const {page,context}=await createPage(browser,kind);
 let posts=0; let release; let fail=true;
 const submitted=[];
 await page.route('**/api/'+kind+'/',async r=>{posts++;submitted.push(r.request().postDataBuffer()); await new Promise(resolve=>release=resolve);
  await r.fulfill({status:fail?409:201,contentType:'application/json',body:fail?JSON.stringify({requestId:'test',error:400,message:'Synthetic conflict'}):envelope(kind==='teams'?team('Corrected team'):organization('Corrected organization'))});
 });
 if(kind==='teams') await page.route(url=>url.pathname.startsWith('/api/teams/') && !url.pathname.includes('/search/') && url.pathname!=='/api/teams/',r=>r.fulfill({contentType:'application/json',body:envelope(team('Corrected team'))}));
 await fillDrawer(page,kind,'Original '+kind);
 await page.getByRole('button',{name:'Create',exact:true}).click();
 await page.waitForFunction(()=>!!document.querySelector('button svg.animate-spin'),null,{timeout:1500});
 const busy=page.getByRole('button',{name:'Please wait',exact:true});
 assert.equal(await busy.isDisabled(),true,'busy submit must be disabled immediately');
 if(kind==='organizations') await screenshot(page,'organization-busy');
 await page.locator('form').last().evaluate(form=>{form.requestSubmit();form.requestSubmit();form.requestSubmit();});
 for(let i=0;i<100 && !release;i++) await page.waitForTimeout(20);
 assert.equal(posts,1,'repeated submissions must produce one request');
 release();
 await page.getByRole('button',{name:'Create',exact:true}).waitFor({timeout:3000});
 assert.equal(await page.getByPlaceholder(kind==='teams'?'Write your team name':'Name of organization').inputValue(),'Original '+kind,'failed create must preserve values');
 fail=false;
 await page.getByPlaceholder(kind==='teams'?'Write your team name':'Name of organization').fill(kind==='teams'?'Corrected team':'Corrected organization');
 await page.getByRole('button',{name:'Create',exact:true}).click();
 await page.waitForFunction(()=>!!document.querySelector('button svg.animate-spin'));
 await assert.doesNotReject(async()=>{for(let i=0;i<100 && posts!==2;i++)await page.waitForTimeout(20);assert.equal(posts,2);});
 release();
 if(kind==='teams') await page.waitForURL(url=>decodeURIComponent(url.pathname)==='/teams/Corrected team');
 else await page.getByText('Corrected organization',{exact:true}).waitFor();
 await context.close(); console.log('PASS final-review I5 '+kind+' immediate guard, conflict retry and preserved values');
}
async function delimiterCase(browser) {
 for (const name of ['Review #1','Review ?1']) {
  const {page,context}=await createPage(browser,'teams');
  let requestedName;
  await page.route('**/api/teams/',r=>r.fulfill({status:201,contentType:'application/json',body:envelope(team(name))}));
  await page.route(url=>url.pathname.startsWith('/api/teams/') && url.pathname!=='/api/teams/',r=>{requestedName=decodeURIComponent(new URL(r.request().url()).pathname.slice('/api/teams/'.length,-1)); return r.fulfill({contentType:'application/json',body:envelope(team(name))});});
  await fillDrawer(page,'teams',name); await page.getByRole('button',{name:'Create',exact:true}).click();
  await page.getByRole('heading',{name:'Members',exact:true}).waitFor();
  const url=new URL(page.url());
  assert.equal(decodeURIComponent(url.pathname),'/teams/'+name,'success redirect must retain the full delimiter-bearing name');
  assert.equal(url.hash,''); assert.equal(url.search,''); assert.equal(requestedName,name,'detail endpoint must receive the complete name');
  await context.close();
 }
 console.log('PASS final-review I6 encoded delimiter redirect and detail fetch');
}
async function kitCase(browser,mode) {
 const {page,context}=await createPage(browser,'teams');
 await page.route(url=>url.pathname.startsWith('/api/teams/') && url.pathname!=='/api/teams/',r=>r.fulfill({contentType:'application/json',body:envelope(team('Kit test'))}));
 const expected = mode==='none' ? {} : mode==='partial' ? {shorts_color:'#ff0000',socks_color:'#0000ff'}
  : {away_tshirt_color:'#008000',socks_color:'#0000ff',tshirt_color:'#ffffff',shorts_color:'#ff0000'};
 let submitted; let release;
 await page.route('**/api/teams/',async r=>{submitted=r.request().postDataBuffer().toString();await new Promise(resolve=>release=resolve);await r.fulfill({status:201,contentType:'application/json',body:envelope(team('Kit test'))});});
 await fillDrawer(page,'teams','Kit test');
 const garment = {shorts_color:'svg[viewBox="0 0 1600 1600"]',socks_color:'svg[width="50"]',tshirt_color:'svg[viewBox="0 0 1024 1024"]',away_tshirt_color:'svg[viewBox="0 0 1024 1024"]'};
 for (const [name,color] of Object.entries(expected)) {
  const svg=page.locator(garment[name]);
  // The away shirt is the second carousel slide. A DOM click exercises its real React handler without a swipe-dependent harness.
  if(name==='away_tshirt_color') await svg.nth(1).dispatchEvent('click');
  else if(name==='tshirt_color') await svg.first().dispatchEvent('click');
  else await svg.click();
  await page.locator('.twitter-picker').waitFor();
  await page.locator('.twitter-picker').getByTitle(color.toUpperCase(),{exact:true}).click();
  await page.waitForFunction(({selector,index,color,part})=>{const svg=document.querySelectorAll(selector)[index];const probe=document.createElement('span');probe.style.color=color;document.body.append(probe);const expected=getComputedStyle(probe).color;probe.remove();const target=svg.querySelector(part);return !!(target.style.fill || target.getAttribute('fill')) && getComputedStyle(target).fill===expected;},{selector:garment[name],index:name==='away_tshirt_color'?1:0,color,part:name==='shorts_color'?'#path29':name==='socks_color'?'rect':'path'});
  await page.keyboard.press('Escape');
 }
 await page.getByRole('button',{name:'Create',exact:true}).click();
 for(let i=0;i<100 && !release;i++)await page.waitForTimeout(20);
 assert(submitted,'kit form must submit');
 if(mode==='partial') await screenshot(page,'team-kit-partial');
 for(const name of ['tshirt_color','shorts_color','socks_color','away_tshirt_color']) {
  const match=submitted.match(new RegExp('name="'+name+'"\\r\\n\\r\\n([^\\r]+)'));
  assert.equal(match?.[1],expected[name], 'submitted '+name+' must follow the selected garment');
 }
 assert.equal(await page.getByText("Please choose the kit colors for your team's kit",{exact:true}).count(),0,'optional kit omission must not produce an error');
 release(); await page.getByRole('heading',{name:'Members',exact:true}).waitFor();
 await context.close(); console.log('PASS final-review M1 kit '+mode+' named optional submission');
}
(async()=> { const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',timeout:20000}); try {
 const selected=process.env.FINAL_REVIEW_CASE || 'all';
 if(selected==='all') {
  await phoneCase(browser);
  await drawerRetryCase(browser,'organizations');
  await drawerRetryCase(browser,'teams');
  await delimiterCase(browser);
  for(const mode of ['none','partial','all']) await kitCase(browser,mode);
 }
 if(selected==='phone') await phoneCase(browser);
 if(selected==='organization-retry') await drawerRetryCase(browser,'organizations');
 if(selected==='team-retry') await drawerRetryCase(browser,'teams');
 if(selected==='delimiter') await delimiterCase(browser);
 if(selected.startsWith('kit-')) await kitCase(browser,selected.slice(4));
 } finally { await browser.close(); } })().catch(e=>{console.log('FAIL final-review '+e.message.replace(/https?:\/\/\S+/g,'[url]').slice(0,300));process.exitCode=1;});
