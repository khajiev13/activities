import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import TeamCard from '../TeamCard';
import { CompetitionDisplay } from '../../CompetitionDisplay';

for (const image of [null, 'https://example.test/team.png']) {
  it(`renders team card image only with a source (${image ? 'present' : 'absent'})`, () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, {}, createElement(TeamCard, { name: 'Synthetic team', image_url: image })));
    expect(html).toContain('Synthetic team');
    if (image) expect(html).toContain('src="https://example.test/team.png"');
    else expect(html).not.toContain('<img');
  });
  it(`renders competition team images only with sources (${image ? 'present' : 'absent'})`, () => {
    const html = renderToStaticMarkup(createElement(CompetitionDisplay, { team1: { name: 'Alpha', image_url: image }, team2: { name: 'Beta', image_url: image } }));
    expect(html).toContain('Alpha'); expect(html).toContain('Beta');
    expect((html.match(/<img/g) ?? []).length).toBe(image ? 2 : 0);
  });
}
