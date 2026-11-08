import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import axiosInstance from '@/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Form } from '@/components/ui/form';
import SelectCategories from './NewActivityDrawer/SelectCategories';
import { IsCompetition } from './NewActivityDrawer/IsCompetition';
import { DisplaySunriseSunset } from './NewActivityDrawer/DisplaySunriseSunset';
import SelectLocation from '../SelectLocation';
import type { LocationDetails } from '../Map/MapFunctions/AddLocation';

const formSchema = z.object({
  title: z.string().min(3, 'Enter a title of at least 3 characters.'),
  description: z.string().min(10, 'Enter a description of at least 10 characters.'),
  public: z.boolean(), categories: z.array(z.object({ pk: z.string(), name: z.string() })), date_time: z.date(),
  country: z.object({ name: z.string().min(1) }), state: z.object({ name: z.string().min(1) }), city: z.object({ name: z.string().min(1) }),
  location: z.object({ pk: z.string().min(1) }), name_for_location: z.string(),
  sunrise_time_for_chosen_location: z.string().nullable(), sunset_time_for_chosen_location: z.string().nullable(), country_code_for_chosen_location: z.string().nullable(), timezone_for_chosen_location: z.string().nullable(),
  duration_in_minutes: z.number().finite().positive('Enter a duration greater than zero.'), is_competition: z.boolean(),
  competition: z.object({ team_1: z.object({ name: z.string() }), team_2: z.object({ name: z.string() }) }).optional(),
}).superRefine((values, context) => {
  if (!values.is_competition) return;
  const first = values.competition?.team_1.name.trim(); const second = values.competition?.team_2.name.trim();
  if (!first || !second) context.addIssue({ code: 'custom', path: ['competition'], message: 'Choose both teams for a competition.' });
  else if (first === second) context.addIssue({ code: 'custom', path: ['competition'], message: 'Choose two distinct teams for a competition.' });
});
type Values = z.infer<typeof formSchema>;
type Props = { setProgressBar: (progress: number) => void; onCreated?: () => void; onPersisted?: () => void };
function localDateTime(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}
export default function NewActivityDrawer({ setProgressBar, onCreated, onPersisted }: Props) {
  const navigate = useNavigate(); const route = useLocation(); const inFlight = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(formSchema), defaultValues: {
    title: '', description: '', public: true, categories: [], date_time: new Date(), duration_in_minutes: 60,
    country: { name: '' }, state: { name: '' }, city: { name: '' }, location: { pk: '' }, name_for_location: '',
    sunrise_time_for_chosen_location: '', sunset_time_for_chosen_location: '', country_code_for_chosen_location: '', timezone_for_chosen_location: '', is_competition: false,
  } });
  const values = form.watch();
  const setLocation = (location: LocationDetails) => {
    form.setValue('country', { name: location.country }); form.setValue('state', { name: location.state }); form.setValue('city', { name: location.city });
    form.setValue('location', { pk: location.location_pk }); form.setValue('name_for_location', location.location_name);
    form.setValue('country_code_for_chosen_location', location.country_code); form.setValue('timezone_for_chosen_location', location.timezone);
    form.setValue('sunrise_time_for_chosen_location', location.sunrise); form.setValue('sunset_time_for_chosen_location', location.sunset);
  };
  async function submit(data: Values) {
    if (!active.current || inFlight.current) return;
    inFlight.current = true; setLoading(true); setError(null); setProgressBar(50);
    try {
      const response = await axiosInstance.post('/api/activities/', data);
      if (typeof response.data?.pk !== 'string' || !response.data.pk) throw new Error('Incomplete activity response');
      onPersisted?.();
      if (!active.current) return;
      setProgressBar(100); onCreated?.(); navigate(`/activities/${encodeURIComponent(response.data.pk)}${route.search}`, { state: { from: route.pathname + route.search } });
    } catch { if (active.current) setError('Could not create the activity. Your draft is saved here. Please try again.'); }
    finally { inFlight.current = false; if (active.current) setLoading(false); }
  }
  return <Form {...form}><form noValidate onSubmit={form.handleSubmit(submit, () => { if (active.current) setError('Check the activity details, location, date, duration, and two distinct competition teams.'); })} className="space-y-6 p-4 text-base">
    <fieldset disabled={loading} className="space-y-6 min-w-0">
      <section aria-labelledby="activity-details" className="space-y-4"><h3 id="activity-details" className="font-semibold text-lg">Activity details</h3>
        <div><Label htmlFor="activity-title">Title</Label><Input id="activity-title" {...form.register('title')} className="text-base min-h-11" /></div>
        <div><Label htmlFor="activity-description">Description</Label><Textarea id="activity-description" {...form.register('description')} className="text-base min-h-28" /></div>
      </section>
      <section aria-labelledby="activity-categories"><h3 id="activity-categories" className="font-semibold text-lg mb-3">Categories</h3><SelectCategories setCategories={categories => form.setValue('categories', categories)} /></section>
      <section aria-labelledby="activity-location" className="space-y-3"><h3 id="activity-location" className="font-semibold text-lg">Location</h3>
        {values.location?.pk ? <><p>{values.name_for_location}</p><p className="text-sm">{values.city.name}, {values.state.name}, {values.country.name}</p><Button type="button" variant="outline" className="min-h-11" onClick={() => form.setValue('location', { pk: '' })}>Change location</Button></> : <SelectLocation setLocation={setLocation} />}
      </section>
      <section aria-labelledby="activity-schedule" className="space-y-4"><h3 id="activity-schedule" className="font-semibold text-lg">Date and duration</h3>
        <div><Label htmlFor="activity-date">Date and time</Label><Input id="activity-date" type="datetime-local" value={values.date_time && !Number.isNaN(values.date_time.getTime()) ? localDateTime(values.date_time) : ''} onChange={event => form.setValue('date_time', new Date(event.target.value))} className="text-base min-h-11" /><p className="text-sm text-muted-foreground">Uses your device's local time, as before.{values.timezone_for_chosen_location ? ` Venue timezone: ${values.timezone_for_chosen_location}.` : ''}</p></div>
        {values.sunrise_time_for_chosen_location && values.sunset_time_for_chosen_location && <DisplaySunriseSunset sunrise={values.sunrise_time_for_chosen_location} sunset={values.sunset_time_for_chosen_location} city={values.city.name} />}
        <div><Label htmlFor="activity-duration">Duration (minutes)</Label><Input id="activity-duration" type="number" min="1" {...form.register('duration_in_minutes', { valueAsNumber: true })} className="text-base min-h-11" /></div>
        <label className="flex items-center gap-3 min-h-11"><input type="checkbox" {...form.register('public')} className="h-5 w-5" />Public Activity</label><p className="text-sm text-muted-foreground">Everyone can join a public activity without a request.</p>
      </section>
      <section aria-labelledby="activity-competition"><h3 id="activity-competition" className="font-semibold text-lg mb-3">Competition</h3><IsCompetition setIsCompetition={value => { form.setValue('is_competition', value); if (!value) form.setValue('competition', undefined); }} setTeam1Prop={name => form.setValue('competition.team_1.name', name)} setTeam2Prop={name => form.setValue('competition.team_2.name', name)} /></section>
    </fieldset>
    <div className="sticky bottom-0 bg-background py-3 space-y-2 border-t">{error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}<Button type="submit" disabled={loading} className="w-full min-h-11" aria-label="Create">{loading ? 'Creating…' : 'Create'}</Button></div>
  </form></Form>;
}
