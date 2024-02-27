import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import SelectLocation from '../Map/SelectLocation';
import { LocationDetails } from '../Map/MapFunctions/AddLocation';
import { useEffect, useState } from 'react';
import SelectedLocation from '../ActivitiesPage/NewActivityDrawer/SelectedLocation';
import axiosInstance from '@/axios';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { Label } from '../ui/label';

type NewOrganizationDrawerProps = {
  setProgressBar: (value: number) => void;
};

export const MAX_FILE_SIZE = 1024 * 1024 * 5;
export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];
export const ACCEPTED_IMAGE_TYPES = ['jpeg', 'jpg', 'png', 'webp'];

const FormSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  pk_for_location: z.string().nullable(),
  image: z
    .any()
    .refine((files) => {
      return files?.[0]?.size <= MAX_FILE_SIZE;
    }, `Max image size is 5MB.`)
    .refine(
      (files) => ACCEPTED_IMAGE_MIME_TYPES.includes(files?.[0]?.type),
      'Only .jpg, .jpeg, .png and .webp formats are supported.'
    ),
});

const NewOrganizationDrawer: React.FC<NewOrganizationDrawerProps> = ({
  setProgressBar,
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [LocationDetails, setLocationDetails] =
    useState<LocationDetails | null>(null);
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      pk_for_location: null,
      image: undefined,
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    setLoading(true);

    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('pk_for_location', data.pk_for_location || '');
    if (data.image.length > 0) {
      formData.append('image', data.image[0]);
    }
    axiosInstance
      .post('api/organizations/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      .then((response) => {
        console.log(response);
        toast('Success!', {
          description: 'Organization has been created successfully!',
        });
        navigate(`/organizations/${response.data.pk}`);
      })
      .catch((error) => {
        console.error(error);
        toast('Error', {
          description: 'Something went wrong while creating an organization',
          style: { borderColor: 'red' },
        });
      });
  }
  useEffect(() => {
    setProgressBar(+30);
    console.log('location', LocationDetails);
    form.setValue('pk_for_location', LocationDetails?.location_pk as string);
    console.log('form.getValues()', form.getValues());
  }, [LocationDetails]);
  useEffect(() => {
    if (form.watch('name') && form.watch('pk_for_location')) {
      setProgressBar(100);
    } else if (form.watch('name') || form.watch('pk_for_location')) {
      setProgressBar(50);
    } else {
      setProgressBar(5);
    }
  }, [form.watch('name'), form.watch('pk_for_location')]);

  return (
    <ScrollArea className="pt-4 h-[408px] md:h-[600px]">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full space-y-6 "
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Name of organization" {...field} />
                </FormControl>
                <FormDescription>
                  This is your public display name.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {!LocationDetails ? (
            <>
              <SelectLocation
                setLocation={(LocationDetails: LocationDetails) => {
                  setLocationDetails(LocationDetails);
                }}
              />
              <FormDescription>
                Where is your organization located? This will help us to show
                your organization to the people around you.
              </FormDescription>
            </>
          ) : (
            <>
              <SelectedLocation
                country={LocationDetails.country}
                state={LocationDetails.state}
                city={LocationDetails.city}
                location={LocationDetails.location_name}
                countryCode={LocationDetails.country_code}
              />
            </>
          )}
          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="picture">Picture</Label>
                <FormControl>
                  <Input
                    {...form.register('image')}
                    type="file"
                    onBlur={field.onBlur}
                    name={field.name}
                    accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          {loading ? (
            <>
              <Button className="w-full" disabled>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait
              </Button>
            </>
          ) : (
            <Button className="w-full" type="submit">
              Create
            </Button>
          )}
        </form>
      </Form>
    </ScrollArea>
  );
};
export default NewOrganizationDrawer;
