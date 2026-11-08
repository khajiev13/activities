/* Synthetic, public-looking data only. Authentication values are generated per context. */
const country = 'Example country';
const state = 'Example state';
const city = 'Example city';
const countries = [{ name: country, states: [
  { name: state, cities: [{ name: city }, { name: 'Shared city' }] },
  { name: 'Other state', cities: [{ name: 'Shared city' }] },
] }, { name: 'Other country', states: [{ name: state, cities: [{ name: 'Shared city' }] }] }];
const member = { uid: 'synthetic-player', username: 'sample-player', first_name: 'Sample', last_name: 'Player', image_url: '' };
const place = { pk: 'venue-1', name: 'Community pitch', points: { latitude: 20, longitude: 10 } };
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#477867"/><circle cx="80" cy="45" r="25" fill="#e8dbb7"/></svg>');
const activity = { pk: 'one', title: 'Community football', description: 'Meet local players for a friendly community game.', date_time: '2026-12-01T14:30:00Z', duration_in_minutes: 90, public: true,
  country: { name: country }, state: { name: state }, city: { name: city }, location: place, categories: [{ pk: 'category-1', name: 'Ball games' }], creator: member,
  people_joined: [], number_of_people_joined: 0, competition: { team_1: { name: 'Team Alpha', image_url: null }, team_2: { name: 'Team Beta', image_url: null } } };
const team = (name = 'Community United') => ({ name, founded_at: '2020-01-01', image_url: image, city_name: city, state_name: state, country_name: country,
  location: [place], men_team: true, public_team: true, categories: [], tshirt_color: [], away_tshirt_color: [], shorts_color: [], socks_color: [], members: [], sponsors: [], belongs_to_organization: [] });
const organization = { pk: 'org-1', name: 'Community club', created_at: '2026-11-08', image_url: image, country: { name: country }, state: { name: state }, city: { name: city }, location: place,
  teams_count: 1, number_of_people_joined: 1, number_of_teams_sponsored: 1, hosting_leagues_count: 0, hosting_activities_count: 1 };
const organizations = [{ pk: 'owner', name: 'Community organization with a long descriptive name' }, { pk: 'sponsor-a', name: 'Sponsor Alpha' }, { pk: 'sponsor-b', name: 'Sponsor Beta' }];
const query = entity => '?' + new URLSearchParams({ level: 'city', country, state, city, entity, view: 'list', q: 'ball' });
function multipart(request) {
  const boundary = request.headers()['content-type'].split('boundary=')[1];
  const fields = {};
  for (const part of request.postDataBuffer().toString('latin1').split('--' + boundary)) {
    const name = part.match(/name="([^"]+)"/); if (!name) continue;
    const file = part.match(/filename="([^"]+)"/);
    fields[name[1]] = file ? { filename: file[1], bytes: part.split('\r\n\r\n')[1]?.length - 2 } : part.split('\r\n\r\n')[1]?.replace(/\r\n$/, '');
  }
  return fields;
}
async function install(context, options = {}) {
  // A public central-London test point makes provider street rendering visible.
  const resultPlace = options.realMap ? { ...place, points: { latitude: 51.5074, longitude: -0.1278 } } : place;
  const model = { authenticated: Boolean(options.authenticated), joined: false, teamJoined: false, failLeave: false, failTeamJoin: true, failVenue: false,
    failActivity: true, failTeam: true, failOrganization: true, failResults: false, empty: false, one: false, failOrganizations: false,
    requests: [], writes: [], countryReads: 0, resultReads: 0, unknown: [], activityPayload: null, teamPayload: null, organizationPayload: null };
  // Never inspect, log or serialize auth request bodies/headers. Tokens exist only in memory.
  const session = require('node:crypto').randomBytes(24).toString('hex');
  await context.route(url => url.pathname.startsWith('/api/'), async route => {
    const req = route.request(), path = new URL(req.url()).pathname, decoded = decodeURIComponent(path);
    const ok = data => route.fulfill({ json: { error: 0, data } });
    const fail = () => route.fulfill({ status: 503, json: { error: 500, data: null } });
    if (path.startsWith('/api/auth/')) {
      if (req.method() !== 'POST' || !['/api/auth/refresh', '/api/auth/otp/request', '/api/auth/otp/verify', '/api/auth/logout', '/api/auth/telegram/webapp'].includes(path)) {
        model.unknown.push(path); return route.fulfill({ status: 404, json: { error: 404, data: null } });
      }
      if (path.endsWith('/otp/request')) return ok({ retry_after_seconds: 0 });
      if (path.endsWith('/otp/verify')) { model.authenticated = true; return ok({ access_token: session, user: member }); }
      if (path.endsWith('/logout')) { model.authenticated = false; return ok({}); }
      if (model.authenticated) return ok({ access_token: session, user: member });
      return route.fulfill({ status: 401, json: { error: 101, data: null } });
    }
    model.requests.push({ path: decoded, search: new URL(req.url()).searchParams.get('search_by'), method: req.method() });
    if (req.method() === 'GET' && path === '/api/users/me') return ok(member);
    if (req.method() === 'GET' && path === '/api/countries/list/') { model.countryReads++; return ok(countries); }
    if (req.method() === 'GET' && /^\/api\/(activities|teams|organizations)\/(city|state|country)\/[^/]+\/$/.test(path)) {
      model.resultReads++;
      if (model.failResults) return fail();
      if (model.empty) return ok([]);
      if (path.includes('/teams/')) return ok(Array.from({ length: model.one ? 1 : 25 }, (_, i) => ({ ...team('Community team ' + String(i).padStart(2, '0')), location: [{ ...resultPlace, points: options.pinReturn && i !== 6 ? { latitude: 999, longitude: 0 } : resultPlace.points }] })));
      if (path.includes('/organizations/')) return ok([model.createdOrganization || organization]);
      return ok(Array.from({ length: model.one ? 1 : 25 }, (_, i) => ({ ...activity, location: { ...resultPlace, points: options.pinReturn && i !== 12 ? { latitude: 999, longitude: 0 } : resultPlace.points }, pk: i === 12 || model.one ? 'one' : String(i), title: i === 12 || model.one ? activity.title : 'Local game ' + i })));
    }
    if (req.method() === 'GET' && path === '/api/categories/') return ok([{ pk: 'category-1', name: 'Ball games' }]);
    if (req.method() === 'GET' && path === '/api/organizations/list/') return model.failOrganizations ? fail() : ok(organizations);
    if (req.method() === 'GET' && /^\/api\/teams\/search\/[^/]+\/$/.test(path)) return ok([team(decoded.includes('Beta') ? 'Team Beta' : 'Team Alpha')]);
    if (req.method() === 'POST') {
      model.writes.push(decoded);
      if (path === '/api/locations/') { if (model.failVenue) { model.failVenue = false; return fail(); } return ok({ pk: place.pk, name: place.name }); }
      if (path === '/api/activities/') { model.activityPayload = req.postDataJSON(); if (model.failActivity) { model.failActivity = false; return fail(); } return ok({ pk: 'created-activity' }); }
      if (path === '/api/teams/') { model.teamPayload = multipart(req); if (model.failTeam) { model.failTeam = false; return fail(); } return ok({ name: model.teamPayload.name }); }
      if (path === '/api/organizations/') { model.organizationPayload = multipart(req); if (model.failOrganization) { model.failOrganization = false; return fail(); }
        model.createdOrganization = { ...organization, name: model.organizationPayload.name, country: { name: model.organizationPayload.country }, state: { name: model.organizationPayload.state }, city: { name: model.organizationPayload.city } };
        return ok(model.createdOrganization); }
      if (/^\/api\/teams\/[^/]+\/join\/$/.test(path)) { model.teamJoinPayload = req.postDataJSON(); if (model.failTeamJoin) return fail(); model.teamJoined = true; return ok({}); }
      if (/^\/api\/activities\/[^/]+\/join\/$/.test(path)) { model.joined = true; return ok({}); }
      if (/^\/api\/activities\/[^/]+\/leave\/$/.test(path)) { if (model.failLeave) return fail(); model.joined = false; return ok({}); }
    }
    if (req.method() === 'GET' && path === '/api/activities/created-activity') return ok({ ...activity, ...model.activityPayload, pk: 'created-activity', location: place, creator: member, competition: activity.competition });
    if (req.method() === 'GET' && /^\/api\/activities\/[^/]+$/.test(path)) return ok({ ...activity, people_joined: model.joined ? [member] : [], number_of_people_joined: model.joined ? 1 : 0 });
    if (req.method() === 'GET' && /^\/api\/teams\/[^/]+\/$/.test(path)) return ok({ ...team(decoded.split('/')[3]), members: model.teamJoined ? [{ ...member, name_on_jersey: 'PLAYER', player_number: 8, role: 'Midfielder' }] : [] });
    model.unknown.push(decoded); return route.fulfill({ status: 404, json: { error: 404, data: null } });
  });
  return model;
}
module.exports = { country, state, city, countries, member, place, activity, organization, team, image, query, install };
