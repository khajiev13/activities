import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectLocation from '../SelectLocation';
import type { LocationDetails } from '../Map/MapFunctions/AddLocation';
import axiosInstance from '@/axios';
import { MAX_FILE_SIZE, ACCEPTED_IMAGE_MIME_TYPES } from '@/components/imageUpload';

type NewOrganizationDrawerProps = {
  setProgressBar: (value: number) => void;
  onCreated?: () => void;
  onPersisted?: () => void;
};
const FormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  pk_for_location: z.string().min(1, 'Choose a location.'),
  image: z.custom<FileList | undefined>()
    .refine(files => !files?.length || files[0].size <= MAX_FILE_SIZE, 'Max image size is 5MB.')
    .refine(files => !files?.length || ACCEPTED_IMAGE_MIME_TYPES.includes(files[0].type), 'Only .jpg, .jpeg, .png and .webp formats are supported.'),
});

export default function NewOrganizationDrawer({ setProgressBar, onCreated, onPersisted }: NewOrganizationDrawerProps) {
  const navigate = useNavigate(); const active = useRef(true); const submitting = useRef(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationDetails | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const form = useForm<z.infer<typeof FormSchema>>({ resolver: zodResolver(FormSchema), defaultValues: { name: '', pk_for_location: '', image: undefined } });
  async function submit(data: z.infer<typeof FormSchema>) {
    if (!active.current || submitting.current) return;
    submitting.current = true; setLoading(true); setError(null); setProgressBar(50);
    try {
      const formData = new FormData();
      formData.append('name', data.name); formData.append('pk_for_location', data.pk_for_location);
      formData.append('country', location?.country || ''); formData.append('state', location?.state || ''); formData.append('city', location?.city || '');
      if (data.image?.length) formData.append('image', data.image[0]);
      const response = await axiosInstance.post('/api/organizations/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (typeof response.data?.pk !== 'string' || !response.data.pk) throw new Error('Incomplete organization response');
      onPersisted?.();
      if (!active.current) return;
      setProgressBar(100);
      navigate('/organizations', { state: { createdOrganization: response.data, organizationResultsInvalidated: Boolean(onPersisted) } });
      onCreated?.();
    } catch { if (active.current) setError('Could not create the organization. Your draft is saved here. Please try again.'); }
    finally { submitting.current = false; if (active.current) setLoading(false); }
  }
  return <Form {...form}><form noValidate onSubmit={form.handleSubmit(submit, () => { if (active.current) setError('Check the organization name, location, and optional image (JPG, PNG or WebP, up to 5MB).'); })} className="space-y-6 p-4 text-base">
    <fieldset disabled={loading} className="min-w-0 space-y-6">
      <section aria-labelledby="organization-details" className="space-y-4"><h3 id="organization-details" className="text-lg font-semibold">Organization details</h3>
        <div><Label htmlFor="organization-name">Name</Label><Input id="organization-name" {...form.register('name')} className="min-h-11 text-base" /><p className="text-sm text-muted-foreground">This is your public display name.</p></div>
        <div><Label htmlFor="organization-image">Picture (optional)</Label><Input id="organization-image" type="file" accept="image/jpeg,image/png,image/webp" {...form.register('image')} className="min-h-11 text-base" /><p className="text-sm text-muted-foreground">JPG, PNG or WebP, up to 5MB.</p></div>
      </section>
      <section aria-labelledby="organization-location" className="space-y-3"><h3 id="organization-location" className="text-lg font-semibold">Location</h3>
        {location ? <><p className="break-words">{location.location_name}</p><p className="text-sm">{location.city}, {location.state}, {location.country}</p><Button type="button" variant="outline" className="min-h-11" onClick={() => { setLocation(null); form.setValue('pk_for_location', ''); }}>Change location</Button></> : <SelectLocation setLocation={selected => { if (!active.current) return; setLocation(selected); form.setValue('pk_for_location', selected.location_pk); }} />}
        <p className="text-sm text-muted-foreground">Choose where people can find your organization.</p>
      </section>
    </fieldset>
    <div className="sticky bottom-0 border-t bg-background py-3 space-y-2">{error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}<Button type="submit" aria-label="Create" disabled={loading} className="w-full min-h-11">{loading ? 'Creating…' : 'Create'}</Button></div>
  </form></Form>;
}
