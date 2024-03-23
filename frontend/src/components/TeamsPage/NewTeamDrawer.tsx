import React, { useEffect, useState } from 'react';
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
import { Loader2, Plus, Minus } from 'lucide-react';
import { LocationDetails } from '../Map/MapFunctions/AddLocation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import SelectLocation from '../SelectLocation';
import SelectOrganization from '../SelectOrganization';
import { Switch } from '../ui/switch';
import SelectGender from '../SelectGender';
type NewTeamDrawerProps = {
  setProgressBar: (progress: number) => void;
};

const clothingItemSchema = z.object({
  name: z.string(),
  color: z.string(),
});

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
  uniform_colors: z.array(clothingItemSchema),
  sponsors: z.array(z.string()),
  belongs_to_organization: z.string(),
  public_team: z.boolean(),
  name_for_location: z.string(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
  pk_for_location: z.string(),
  country_code_for_chosen_location: z.string(),
  timezone_for_chosen_location: z.string(),
  sunrise_time_for_chosen_location: z.string(),
  sunset_time_for_chosen_location: z.string(),
});

const NewTeamDrawer: React.FC<NewTeamDrawerProps> = ({ setProgressBar }) => {
  const [loading, setLoading] = React.useState<boolean>(false);
  const [sponsorCount, setSponsorCount] = useState<number>(1);

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
      public_team: false,
      founded_at: undefined,
      categories: [{ name: '', pk: '' }],
      image: undefined,
      city: '',
      state: '',
      country: '',
      timezone_for_chosen_location: '',
      sunrise_time_for_chosen_location: '',
      sunset_time_for_chosen_location: '',
      country_code_for_chosen_location: '',
      name_for_location: '',

      belongs_to_organization: '',
      pk_for_location: '',

      sponsors: [''],
      uniform_colors: [],
    },
  });
  useEffect(() => {
    console.log(form.formState.errors);

    // Check if there are any errors
    if (Object.keys(form.formState.errors).length > 0) {
      // Assign the error to pop up
      toast('Error', {
        description: 'Please fill in the form correctly!',
        style: { borderColor: 'red' },
      });
    }
  }, [form.formState.errors]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setLoading(true);
    console.log('Submitting');
    console.log(form.formState.isValid);
    console.log(form.formState.errors);
    console.log(values);

    const formData = new FormData();

    // Append simple fields directly
    formData.append('name', values.name);
    formData.append('men_team', values.men_team.toString());
    formData.append('founded_at', values.founded_at.toISOString());
    formData.append('belongs_to_organization', values.belongs_to_organization);
    formData.append('public_team', values.public_team.toString());
    formData.append('country_name', values.country.toString() || '');
    formData.append('state_name', values.state.toString());
    formData.append('city_name', values.city.toString());
    formData.append('location', values.pk_for_location.toString());

    // For arrays and objects, JSON.stringify might be needed
    formData.append('categories', JSON.stringify(values.categories));
    console.log('values.uniform_colors', values.uniform_colors);
    try {
      formData.append(
        'tshirt_color',
        values.uniform_colors[0].color.toString()
      );
      formData.append(
        'shorts_color',
        values.uniform_colors[1].color.toString()
      );
      formData.append('socks_color', values.uniform_colors[2].color.toString());
      formData.append(
        'away_tshirt_color',
        values.uniform_colors[3].color.toString()
      );
      // rest of your code...
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes('Cannot read properties of undefined')
      ) {
        toast('Error', {
          description: "Please choose the kit colors for your team's kit",
          style: { borderColor: 'red' },
        });
      } else {
        // Handle any other errors
        console.error(error);
      }
    }

    formData.append('sponsors', JSON.stringify(values.sponsors));

    // Handling the image
    if (values.image && values.image.length > 0) {
      formData.append('image', values.image[0]);
    }

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
        if (error.response && error.response.status === 400) {
          toast('Error', {
            description: error.response.data.message,
            style: { borderColor: 'red' },
          });
        } else {
          toast('Error', {
            description:
              'Something went wrong while creating a team. Probably the picture exists in the database',
            style: { borderColor: 'red' },
          });
        }
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
    form.watch('pk_for_location'),
    form.watch('belongs_to_organization'),
    form.watch('sponsors'),
    form.watch('men_team'),
    date,
  ]);

  return (
    <>
      <TeamCard
        setUniformColors={(name: string, color: string) => {
          const uniformColors = form.getValues('uniform_colors');
          const index = uniformColors.findIndex((item) => item.name === name);

          if (index !== -1) {
            // If a color with the given name exists, update it
            uniformColors[index].color = color;
          } else {
            // If no color with the given name exists, add a new one
            uniformColors.push({ name, color });
          }

          form.setValue('uniform_colors', uniformColors);
        }}
        name={form.getValues('name')}
        image={form.getValues('image') && form.getValues('image')?.[0]}
        location_name={form.getValues('state') + ' ' + form.getValues('city')}
      />
      <ScrollArea className="pt-4 h-[260px]  md:h-[368px] flex-grow ">
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
            <SelectGender
              setGender={(gender: boolean) => {
                form.setValue('men_team', gender);
              }}
              male={form.getValues('men_team')}
            />
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem className="mb-4">
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
              render={() => (
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
            <FormLabel>When was your team found?</FormLabel>

            <DatePickerWithPresets className="mb-4" updateFormData={setDate} />
            {!form.getValues('pk_for_location') && (
              <SelectLocation
                setLocation={(LocationDetails: LocationDetails) => {
                  form.setValue('country', LocationDetails.country);
                  form.setValue('state', LocationDetails.state);
                  form.setValue('city', LocationDetails.city);
                  form.setValue(
                    'country_code_for_chosen_location',
                    LocationDetails.country_code
                  );
                  form.setValue(
                    'timezone_for_chosen_location',
                    LocationDetails.timezone
                  );
                  form.setValue(
                    'sunrise_time_for_chosen_location',
                    LocationDetails.sunrise
                  );
                  form.setValue(
                    'sunset_time_for_chosen_location',
                    LocationDetails.sunset
                  );

                  form.setValue('pk_for_location', LocationDetails.location_pk);
                  form.setValue(
                    'name_for_location',
                    LocationDetails.location_name
                  );
                }}
              />
            )}

            <Tabs defaultValue="organization" className="w-full">
              <div className="flex items-center mt-4 w-full p-0 m-0">
                <FormLabel>
                  Does your team belong to any organization?
                </FormLabel>
                <TabsList className="ml-auto">
                  <TabsTrigger
                    value="yes"
                    className="text-zinc-600 dark:text-zinc-200"
                    onClick={() => {
                      form.setValue('belongs_to_organization', '');
                    }}
                  >
                    Yes
                  </TabsTrigger>
                  <TabsTrigger
                    value="no"
                    className="text-zinc-600 dark:text-zinc-200"
                    onClick={() => {
                      form.setValue('belongs_to_organization', '');
                    }}
                  >
                    No
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="yes">
                <SelectOrganization
                  onSelect={(selectedValue: string) => {
                    form.setValue('belongs_to_organization', selectedValue);
                  }}
                />
              </TabsContent>
            </Tabs>
            <FormField
              control={form.control}
              name="public_team"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 my-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Public Team</FormLabel>
                    <FormDescription>
                      If the team is public, everyone can join it anytime
                      without a request.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Tabs defaultValue="organization" className="w-full">
              <div className="flex items-center mt-4 w-full p-0 m-0">
                <FormLabel>Do you have any sponsors?</FormLabel>
                <TabsList className="ml-auto">
                  <TabsTrigger
                    value="yes"
                    className="text-zinc-600 dark:text-zinc-200"
                    onClick={() => {
                      form.setValue('sponsors', []);
                    }}
                  >
                    Yes
                  </TabsTrigger>
                  <TabsTrigger
                    value="no"
                    className="text-zinc-600 dark:text-zinc-200"
                    onClick={() => {
                      form.setValue('sponsors', []);
                    }}
                  >
                    No
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="yes">
                {Array.from({ length: sponsorCount }, (_) => (
                  <SelectOrganization
                    onSelect={(selectedValue: string) => {
                      form.setValue(
                        'sponsors',
                        form.getValues('sponsors').concat(selectedValue)
                      );
                    }}
                  />
                ))}
                {form.getValues('sponsors').length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={(event) => {
                        event.preventDefault();
                        setSponsorCount(sponsorCount + 1);
                      }}
                      className="my-4 p-0"
                    >
                      <Plus className="h-5 w-9" />
                    </Button>
                    {form.getValues('sponsors').length > 1 && (
                      <Button
                        variant={'destructive'}
                        onClick={(event) => {
                          event.preventDefault();
                          const sponsors = form.getValues('sponsors');
                          if (sponsors.length > 0 && sponsorCount > 1) {
                            form.setValue('sponsors', sponsors.slice(0, -1));
                            setSponsorCount(sponsorCount - 1);
                          }
                        }}
                        className="my-4 p-0"
                      >
                        <Minus className="h-5 w-9" />
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {loading ? (
              <>
                <Button className="w-full">
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
    </>
  );
};

export default NewTeamDrawer;
