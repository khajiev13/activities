import React, { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Label } from '../ui/label';
import { Input } from '@/components/ui/input';
import { DrawerClose } from '../ui/drawer';
import { ScrollArea } from '../ui/scroll-area';
import TeamCard from './TeamCard';
import {
  MAX_FILE_SIZE,
  ACCEPTED_IMAGE_MIME_TYPES,
  ACCEPTED_IMAGE_TYPES,
} from '@/components/OrganizationsPage/NewOrganizationDrawer';
import SelectCategories, {
  CategoryItem,
} from '../ActivitiesPage/NewActivityDrawer/SelectCategories';
import { DatePickerWithPresets } from '../ActivitiesPage/NewActivityDrawer/DatePickerWithPresets';
import axiosInstance from '@/axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
type NewTeamDrawerProps = {
  setProgressBar: (progress: number) => void;
};

const formSchema = z.object({
  name: z.string().min(3, {
    message: 'Name must be at least 3 characters.',
  }),
  men_team: z.boolean(),
  founded_at: z.date(),
  image: z
    .any()
    .refine((files) => {
      return files?.[0]?.size <= MAX_FILE_SIZE;
    }, `Max image size is 5MB.`)
    .refine(
      (files) => ACCEPTED_IMAGE_MIME_TYPES.includes(files?.[0]?.type),
      'Only .jpg, .jpeg, .png and .webp formats are supported.'
    ),
  categories: z.array(
    z
      .object({
        pk: z.string(),
        name: z.string(),
      })
      .required()
  ),
});

const NewTeamDrawer: React.FC<NewTeamDrawerProps> = ({ setProgressBar }) => {
  const [loading, setLoading] = React.useState<boolean>(false);
  const navigate = useNavigate();
  const [date, setDate] = React.useState<Date>();
  useEffect(() => {
    setProgressBar(5);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      men_team: true,
      founded_at: undefined,
      categories: [],
      image: undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(values);
    setLoading(true);

    const formData = new FormData();
    formData.append('name', values.name);
    values.categories.forEach((category) => {
      let obj = JSON.stringify(category);
      formData.append('categories', obj);
    });
    if (values.image.length > 0) {
      formData.append('image', values.image[0]);
    }
    formData.append('founded_at', values.founded_at.toISOString());

    axiosInstance
      .post('api/teams/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      .then((response) => {
        console.log(response);
        toast('Success!', {
          description: 'Team has been created successfully!',
        });
        navigate(`/teams/${response.data.name}`);
      })
      .catch((error) => {
        console.error(error);
        toast('Error', {
          description: 'Something went wrong while creating a team',
          style: { borderColor: 'red' },
        });
      });
  }

  useEffect(() => {
    if (date) {
      form.setValue('founded_at', date);
    }
    let progress = 0;
    if (form.getValues('name')) progress += 20;
    if (form.getValues('image').length > 0) progress += 20;
    if (form.getValues('categories').length > 0) progress += 20;
    if (form.getValues('founded_at')) progress += 20;
    if (form.getValues('men_team')) progress += 20;
    setProgressBar(progress);
  }, [
    form.watch('name'),
    form.watch('image'),
    form.watch('categories'),
    form.watch('founded_at'),
    date,
  ]);

  return (
    <ScrollArea className="pt-4 h-[408px] md:h-[600px]">
      <TeamCard
        name={form.getValues('name')}
        image={form.getValues('image') && form.getValues('image')?.[0]}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Write your team name" {...field} />
                </FormControl>
                <FormDescription></FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="image">Logo of the team</Label>
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
          <FormField
            control={form.control}
            name="categories"
            render={({ field }) => (
              <FormItem className="w-full mb-3">
                <SelectCategories
                  setCategories={(newCategories: CategoryItem[]) => {
                    form.setValue('categories', newCategories);
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <DatePickerWithPresets updateFormData={setDate} />

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

export default NewTeamDrawer;
