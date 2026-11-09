import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import ActivityDetail from '../ActivityDetail';
import type { ActivityDetailsType } from '@/types/ActivitiesListSchema';

const activity: ActivityDetailsType = {
  pk: 'test', title: 'API activity', description: 'API description', date_time: '2026-11-08T12:00:00Z',
  duration_in_minutes: 60, public: true, country: { name: 'China' }, state: { name: 'Beijing' },
  city: { name: 'Beijing' }, location: { name: 'API pitch' }, categories: [{ name: 'Football' }],
  creator: { first_name: 'API', last_name: 'Organizer', username: 'organizer', image_url: '' },
  people_joined: [{ first_name: null, last_name: null, username: 'actual-attendee', image_url: null }],
  number_of_people_joined: 1,
  competition: { team_1: { name: 'Alpha', image_url: null }, team_2: { name: 'Beta', image_url: null } },
};

it('renders the supplied activity, real attendee fallback and competition with nullable images', () => {
  const html = renderToStaticMarkup(createElement(ActivityDetail, { activity }));
  for (const text of ['API activity', 'API description', 'API pitch', 'actual-attendee', 'Alpha', 'Beta']) expect(html).toContain(text);
  expect(html).not.toContain('Weekend Hike');
  expect(html).not.toContain('John Doe');
});

it('shows no attendees for an empty API collection and hides absent competition', () => {
  const html = renderToStaticMarkup(createElement(ActivityDetail, { activity: { ...activity, people_joined: [],
    number_of_people_joined: 0, competition: { team_1: { name: null, image_url: null }, team_2: { name: null, image_url: null } } } }));
  expect(html).toContain('No attendees yet.');
  expect(html).not.toContain('VS');
});
