// @vitest-environment jsdom
import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import TeamCard from '../TeamCard';
import { CompetitionDisplay } from '../../CompetitionDisplay';

afterEach(cleanup);

for (const image of [null, 'https://example.test/team.png']) {
  it(`renders team card image only with a source (${image ? 'present' : 'absent'})`, () => {
    const { container } = render(createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, createElement(TeamCard, { name: 'Synthetic team', image_url: image })));
    const html = container.innerHTML;
    expect(html).toContain('Synthetic team');
    if (image) expect(html).toContain('src="https://example.test/team.png"');
    else expect(html).not.toContain('<img');
  });
  it(`renders competition team images only with sources (${image ? 'present' : 'absent'})`, () => {
    const { container } = render(createElement(CompetitionDisplay, { team1: { name: 'Alpha', image_url: image }, team2: { name: 'Beta', image_url: image } }));
    const html = container.innerHTML;
    expect(html).toContain('Alpha'); expect(html).toContain('Beta');
    expect((html.match(/<img/g) ?? []).length).toBe(image ? 2 : 0);
  });
}
