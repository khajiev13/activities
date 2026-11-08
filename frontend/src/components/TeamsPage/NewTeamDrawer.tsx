import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MAX_FILE_SIZE, ACCEPTED_IMAGE_MIME_TYPES } from '@/components/imageUpload';
import SelectCategories from '../ActivitiesPage/NewActivityDrawer/SelectCategories';
import axiosInstance from '@/axios';
import type { LocationDetails } from '../Map/MapFunctions/AddLocation';
import SelectLocation from '../SelectLocation';
import SelectOrganization from '../SelectOrganization';
import TeamKit from './TeamKit';

type Props = { setProgressBar: (progress: number) => void; onCreated?: () => void; onPersisted?: () => void };
const formSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters.'), men_team: z.boolean(), public_team: z.boolean(), founded_at: z.date(),
  image: z.custom<FileList | undefined>()
    .refine(files => !files?.length || files[0].size <= MAX_FILE_SIZE, 'Max image size is 5MB.')
    .refine(files => !files?.length || ACCEPTED_IMAGE_MIME_TYPES.includes(files[0].type), 'Only .jpg, .jpeg, .png and .webp formats are supported.'),
  categories: z.array(z.object({ pk: z.string(), name: z.string() })),
  uniform_colors: z.array(z.object({ name: z.string(), color: z.string() })), sponsors: z.array(z.string()), belongs_to_organization: z.string(),
  location: z.custom<LocationDetails>().refine(location => Boolean(location?.location_pk && location.country && location.state && location.city), 'Choose a location.'),
});
type Values = z.infer<typeof formSchema>;
function localDate(date: Date | undefined) { return date && !Number.isNaN(date.getTime()) ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` : ''; }

export default function NewTeamDrawer({ setProgressBar, onCreated, onPersisted }: Props) {
  const navigate = useNavigate(); const route = useLocation(); const active = useRef(true); const submitting = useRef(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [hasOrganization, setHasOrganization] = useState(false);
  const [preview, setPreview] = useState<string>(); const [sponsorIds, setSponsorIds] = useState<number[]>([]); const nextSponsor = useRef(0);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const form = useForm<Values>({ resolver: zodResolver(formSchema), defaultValues: { name: '', men_team: true, public_team: false, image: undefined, categories: [], uniform_colors: [], sponsors: [], belongs_to_organization: '' } });
  const values = form.watch(); const image = values.image?.[0];
  useEffect(() => { if (!image) { setPreview(undefined); return; } const url = URL.createObjectURL(image); setPreview(url); return () => URL.revokeObjectURL(url); }, [image]);
  async function submit(data: Values) {
    if (!active.current || submitting.current) return;
    submitting.current = true; setLoading(true); setError(null); setProgressBar(50);
    try {
      const formData = new FormData();
      formData.append('name', data.name); formData.append('men_team', String(data.men_team)); formData.append('founded_at', data.founded_at.toISOString());
      formData.append('belongs_to_organization', data.belongs_to_organization); formData.append('public_team', String(data.public_team));
      formData.append('country_name', data.location.country); formData.append('state_name', data.location.state); formData.append('city_name', data.location.city); formData.append('location', data.location.location_pk);
      formData.append('categories', JSON.stringify(data.categories)); formData.append('sponsors', JSON.stringify(data.sponsors.filter(Boolean)));
      const colorFields: Record<string, string> = { tshirt: 'tshirt_color', shorts: 'shorts_color', socks: 'socks_color', awaytshirt: 'away_tshirt_color' };
      data.uniform_colors.forEach(({ name, color }) => { if (color && colorFields[name]) formData.append(colorFields[name], color); });
      if (data.image?.length) formData.append('image', data.image[0]);
      const response = await axiosInstance.post('/api/teams/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (typeof response.data?.name !== 'string' || !response.data.name) throw new Error('Incomplete team response');
      onPersisted?.();
      if (!active.current) return;
      setProgressBar(100); onCreated?.(); navigate(`/teams/${encodeURIComponent(response.data.name)}${route.search}`, { state: { from: route.pathname + route.search } });
    } catch { if (active.current) setError('Could not create the team. Your draft is saved here. Please try again.'); }
    finally { submitting.current = false; if (active.current) setLoading(false); }
  }
  return <Form {...form}><form noValidate onSubmit={form.handleSubmit(submit, () => { if (active.current) setError('Check the team name, founded date, location, and optional image (JPG, PNG or WebP, up to 5MB).'); })} className="space-y-6 p-4 text-base">
    <fieldset disabled={loading} className="space-y-6 min-w-0">
      <section aria-label="Team preview" className="flex items-center gap-3 rounded-lg border p-3 min-w-0">{preview && <img src={preview} alt="Team logo preview" className="h-16 w-16 rounded object-contain" />}<div className="min-w-0"><p className="font-semibold break-words">{values.name || 'Your team'}</p>{values.location?.location_pk && <p className="text-sm break-words">{values.location.city}, {values.location.state}</p>}</div></section>
      <section aria-labelledby="team-details" className="space-y-4"><h3 id="team-details" className="text-lg font-semibold">Team details</h3>
        <div><Label htmlFor="team-name">Name</Label><Input id="team-name" {...form.register('name')} className="min-h-11 text-base" /></div>
        <fieldset className="space-y-2"><legend className="font-medium">Team gender</legend><div className="flex flex-wrap gap-4">{[[true, 'Men’s team'], [false, 'Women’s team']].map(([male, label]) => <label key={String(male)} className="flex items-center gap-2 min-h-11"><input type="radio" name="team-gender" checked={values.men_team === male} onChange={() => form.setValue('men_team', male === true)} className="h-5 w-5" />{label}</label>)}</div></fieldset>
        <div><Label htmlFor="team-founded">Founded date</Label><Input id="team-founded" type="date" value={localDate(values.founded_at)} onChange={event => form.setValue('founded_at', new Date(`${event.target.value}T00:00:00`))} className="min-h-11 text-base" /></div>
        <div><Label htmlFor="team-image">Logo of the team (optional)</Label><Input id="team-image" type="file" accept="image/jpeg,image/png,image/webp" {...form.register('image')} className="min-h-11 text-base" /><p className="text-sm text-muted-foreground">JPG, PNG or WebP, up to 5MB.</p></div>
        <label className="flex items-center gap-3 min-h-11"><input type="checkbox" {...form.register('public_team')} className="h-5 w-5" />Public Team</label><p className="text-sm text-muted-foreground">Everyone can join a public team without a request.</p>
      </section>
      <section aria-labelledby="team-categories"><h3 id="team-categories" className="text-lg font-semibold mb-3">Categories</h3><SelectCategories setCategories={categories => form.setValue('categories', categories)} /></section>
      <section aria-labelledby="team-location" className="space-y-3"><h3 id="team-location" className="text-lg font-semibold">Location</h3>{values.location?.location_pk ? <><p>{values.location.location_name}</p><p className="text-sm">{values.location.city}, {values.location.state}, {values.location.country}</p><Button type="button" variant="outline" className="min-h-11" onClick={() => form.setValue('location', { ...form.getValues('location'), location_pk: '' })}>Change location</Button></> : <SelectLocation setLocation={location => { if (active.current) form.setValue('location', location); }} />}</section>
      <section aria-labelledby="team-kit" className="space-y-3"><h3 id="team-kit" className="text-lg font-semibold">Team kit</h3><TeamKit colorPickerNeeded setUniformColors={(name, color) => form.setValue('uniform_colors', [...form.getValues('uniform_colors').filter(item => item.name !== name), { name, color }])} /></section>
      <section aria-labelledby="team-organization" className="space-y-3"><h3 id="team-organization" className="text-lg font-semibold">Organization</h3><label className="flex items-center gap-3 min-h-11"><input type="checkbox" checked={hasOrganization} onChange={event => { setHasOrganization(event.target.checked); form.setValue('belongs_to_organization', ''); }} className="h-5 w-5" />Belongs to an organization</label>{hasOrganization && <SelectOrganization disabled={loading} onSelect={pk => form.setValue('belongs_to_organization', pk)} />}</section>
      <section aria-labelledby="team-sponsors" className="space-y-3"><h3 id="team-sponsors" className="text-lg font-semibold">Sponsors</h3>{sponsorIds.map((id, index) => <fieldset key={id} aria-label={`Sponsor ${index + 1}`} className="min-w-0 rounded-lg border p-3 space-y-2"><legend className="text-sm">Sponsor {index + 1}</legend><SelectOrganization label={`Sponsor ${index + 1}`} disabled={loading} onSelect={pk => { const sponsors = [...form.getValues('sponsors')]; sponsors[index] = pk; form.setValue('sponsors', sponsors); }} /><Button type="button" variant="outline" className="min-h-11" onClick={() => { setSponsorIds(ids => ids.filter(item => item !== id)); form.setValue('sponsors', form.getValues('sponsors').filter((_, slot) => slot !== index)); }}>Remove sponsor {index + 1}</Button></fieldset>)}<Button type="button" variant="outline" className="min-h-11" onClick={() => { setSponsorIds(ids => [...ids, nextSponsor.current++]); form.setValue('sponsors', [...form.getValues('sponsors'), '']); }}>Add sponsor</Button></section>
    </fieldset>
    <div className="sticky bottom-0 border-t bg-background py-3 space-y-2">{error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}<Button type="submit" aria-label="Create" disabled={loading} className="w-full min-h-11">{loading ? 'Creating…' : 'Create'}</Button></div>
  </form></Form>;
}
