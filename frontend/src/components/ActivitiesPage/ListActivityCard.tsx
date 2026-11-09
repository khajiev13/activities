import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { CompetitionDisplay } from '../CompetitionDisplay';
import type { ActivityCardPropsType } from '@/types/ActivitiesListSchema';

export function ListActivityCard(props: ActivityCardPropsType & { className?: string }) {
  const location = useLocation();
  return <article className={`rounded-2xl border bg-card p-4 space-y-3 ${props.className || ''}`}>
    <h2 className="text-lg font-semibold"><Link className="inline-flex min-h-12 items-center" to={`/activities/${encodeURIComponent(props.pk)}${location.search}`} state={{ from: location.pathname + location.search }}>{props.title}</Link></h2>
    <p className="text-sm text-muted-foreground">{new Date(props.date_time).toLocaleString()} · {props.duration_in_minutes} minutes</p>
    <p>{props.description}</p>
    <p>{props.location.name} · {props.city.name}, {props.state.name}, {props.country.name}</p>
    <p className="text-sm">{props.public ? 'Public activity' : 'Private activity'} · {props.number_of_people_joined} people joined</p>
    <div className="flex flex-wrap gap-2">{props.categories.map(category => <Badge key={category.pk} variant="secondary">{category.name}</Badge>)}</div>
    {props.competition.team_1.name && props.competition.team_2.name && <CompetitionDisplay team1={{ name: props.competition.team_1.name, image_url: props.competition.team_1.image_url }} team2={{ name: props.competition.team_2.name, image_url: props.competition.team_2.image_url }} />}
    <div className="flex items-center gap-2 text-sm text-muted-foreground">{props.creator.image_url && <img src={props.creator.image_url} alt="" className="h-8 w-8 rounded-full object-cover" />}<p>Organized by {props.creator.first_name} {props.creator.last_name} (@{props.creator.username})</p></div>
    {props.people_joined.length > 0 && <ul className="flex flex-wrap gap-3" aria-label="Attendees">{props.people_joined.map((person, index) => <li className="flex items-center gap-2" key={person.username || index}>{person.image_url && <img src={person.image_url} alt="" className="h-8 w-8 rounded-full object-cover" />}{[person.first_name, person.last_name].filter(Boolean).join(' ') || person.username || 'Participant'}</li>)}</ul>}
  </article>;
}
export default ListActivityCard;
