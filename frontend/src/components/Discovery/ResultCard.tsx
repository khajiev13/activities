import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useOptionalDiscovery } from '@/discovery/DiscoveryContext';
import { Building2, CalendarDays, Users } from 'lucide-react';
import type { DiscoveryResults } from '@/discovery/types';
type Props = { entity: 'activities'; item: DiscoveryResults['activities'][number]; onSelect?: () => void }
  | { entity: 'teams'; item: DiscoveryResults['teams'][number]; onSelect?: () => void }
  | { entity: 'organizations'; item: DiscoveryResults['organizations'][number]; onSelect?: () => void };
export function ResultCard(props: Props) {
  const location = useLocation();
  const discovery = useOptionalDiscovery();
  const [imageFailed, setImageFailed] = useState(false);
  const returnTo = location.pathname + location.search;
  let title: string; let image: string | null = null; let place: string; let metadata: string; let href: string | undefined;
  let id: string;
  if (props.entity === 'activities') {
    const item = props.item; id = item.pk; title = item.title; place = `${item.location.name} · ${item.city.name}`;
    const date = new Date(item.date_time); metadata = `${Number.isNaN(date.getTime()) ? item.date_time : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${item.number_of_people_joined} joined`;
    href = `/activities/${encodeURIComponent(item.pk)}${location.search}`;
  } else if (props.entity === 'teams') {
    const item = props.item; id = item.name; title = item.name; image = item.image_url; place = `${item.location[0]?.name ?? item.state_name} · ${item.city_name}`;
    metadata = item.categories.map(category => category.name).join(' · ') || (item.public_team ? 'Public team' : 'Private team');
    href = `/teams/${encodeURIComponent(item.name)}${location.search}`;
  } else {
    const item = props.item; id = item.pk; title = item.name; image = item.image_url; place = `${item.location.name} · ${item.city.name}`;
    metadata = `Since ${item.created_at.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} · ${item.teams_count} ${item.teams_count === 1 ? 'team' : 'teams'} · ${item.number_of_people_joined} ${item.number_of_people_joined === 1 ? 'member' : 'members'} · ${item.hosting_activities_count} ${item.hosting_activities_count === 1 ? 'activity' : 'activities'}`;
  }
  const Icon = props.entity === 'activities' ? CalendarDays : props.entity === 'teams' ? Users : Building2;
  return <article className="discovery-card" data-result-id={id} data-selected={discovery?.selected === id || undefined}>
    <div className="discovery-card-image">{image && !imageFailed ? <img src={image} alt="" onError={() => setImageFailed(true)} /> : <Icon size={24} aria-hidden="true" />}</div>
    <div className="discovery-card-copy"><h3>{href ? <Link onClick={() => discovery?.setSelected(id)} to={href} state={{ from: returnTo }}>{title}</Link> : <button onClick={props.onSelect} aria-label={`About ${title}`}>{title}</button>}</h3><p>{place}</p><p>{metadata}</p></div>
  </article>;
}
