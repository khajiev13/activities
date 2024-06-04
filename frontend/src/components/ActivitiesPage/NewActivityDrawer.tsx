'use client';
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
import { useForm, useWatch } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import SelectCategories from './NewActivityDrawer/SelectCategories';
import { CategoryItem } from './NewActivityDrawer/SelectCategories';
import SelectLocation from '../SelectLocation';
import { LocationDetails } from '../Map/MapFunctions/AddLocation';
import SelectedLocation from './NewActivityDrawer/SelectedLocation';
import { DatePickerWithPresets } from './NewActivityDrawer/DatePickerWithPresets';
import { DisplaySunriseSunset } from './NewActivityDrawer/DisplaySunriseSunset';
import { TimePickerComponent } from './NewActivityDrawer/TimePicker/TimePickerComponent';
import { Switch } from '@/components/ui/switch';
import { IsCompetition } from './NewActivityDrawer/IsCompetition';
import { useToast } from '../ui/use-toast';
import axiosInstance from '@/axios';
import DurationInput from './NewActivityDrawer/DurationMinutes';
import { MultiStepLoader as Loader } from '../ui/multi-step-loader';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
const loadingStates = [
  {
    text: 'Setting the stage at Eventopia',
  },
  {
    text: 'Gathering unique ideas for your activity',
  },
  {
    text: 'Inviting inspiring personalities',
  },
  {
    text: 'Crafting a memorable experience',
  },
  {
    text: 'Choosing the perfect venue',
  },
  {
    text: 'Sparking the excitement',
  },
  {
    text: 'Feeling the anticipation build',
  },
  {
    text: 'Welcome to your unique Eventopia activity',
  },
];

type NewActivityDrawerProps = {
  setProgressBar: (progress: number) => void;
};

const formSchema = z.object({
  title: z.string().min(3, {
    message: 'Title must be at least 3 characters.',
  }),
  description: z.string().min(10),
  public: z.boolean(),
  categories: z.array(
    z.object({
      pk: z.string(),
      name: z.string(),
    })
  ),
  date_time: z.date(),
  country: z.object({ name: z.string() }),
  sunrise_time_for_chosen_location: z.string().nullable(),
  sunset_time_for_chosen_location: z.string().nullable(),
  country_code_for_chosen_location: z.string().nullable(),
  timezone_for_chosen_location: z.string().nullable(),
  state: z.object({ name: z.string() }),
  city: z.object({ name: z.string() }),
  location: z.object({ pk: z.string() }).nullable(),
  name_for_location: z.string(),
  duration_in_minutes: z.number(),
  is_competition: z.boolean(),
  competition: z
    .object({
      team_1: z.object({ name: z.string() }),
      team_2: z.object({ name: z.string() }),
    })
    .optional(),
});

const NewActivityDrawer: React.FC<NewActivityDrawerProps> = ({
  setProgressBar,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // 1. Define your form.
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      public: true,
      categories: [],
      date_time: new Date(),
      is_competition: false,
      location: null,
      sunrise_time_for_chosen_location: null,
      sunset_time_for_chosen_location: null,
      competition: undefined,
    },
  });
  // Use the watch function to subscribe to the pk_for_location field
  const pkForLocation = useWatch({
    control: form.control,
    name: 'location.pk', // Make sure this matches the name used in your form
  });

  useEffect(() => {
    // If pkForLocation has a value, show the toast
    if (pkForLocation) {
      toast({
        title: 'Location selected',
        description: 'You have selected a location',
      });
    }
  }, [pkForLocation]); // Re-run the effect when pkForLocation changes

  const [date, setDate] = React.useState<Date>();
  // We have to use this useEffects because I could not set date_time and duration directly in the form.setValue
  useEffect(() => {
    if (date) {
      // Call the function or method here
      const newDate = new Date(date);
      // Convert the date to an ISO string in UTC
      const utcDate = newDate.toISOString();
      form.setValue('date_time', new Date(utcDate));
      // ...
    }
  }, [date]);

  // 2. Define a submit handler.
  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    // Check if competition and both teams are selected and show a toast if not
    if (
      values.is_competition &&
      values.competition &&
      (!values.competition.team_1.name || !values.competition.team_2.name)
    ) {
      toast({
        variant: 'destructive',
        title: 'Please choose teams',
        description: 'You must choose both teams for a competition',
      });

      return;
    }

    axiosInstance.post('/api/activities/', values).then((response) => {
      setTimeout(() => {
        setLoading(false);
        // Navigate to the activity page
        navigate(`/activities/${response.data.pk}`);
      }, 10000);
    });
    // ✅ This will be type-safe and validated.
    console.log(values);
  }
  return (
    <div>
      <Loader
        loadingStates={loadingStates}
        loading={loading}
        duration={1000}
        loop={false}
      />

      <Carousel className="w-full" setProgressBar={setProgressBar}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <CarouselContent className="h-full md:max-h-full">
              <CarouselItem key={1} className="h-full">
                <Card className="lg:text-4xl h-full min-h-[410px]">
                  <CardContent className="flex aspect-square items-start p-6  w-full flex-col h-full ">
                    {/* In this card, we only put 3 inputs */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Write your title" {...field} />
                          </FormControl>
                          <FormDescription></FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="w-full h-3/5">
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              className="h-full"
                              placeholder="Type your description here."
                              {...field}
                            />
                          </FormControl>
                          <FormDescription></FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </CarouselItem>
              <CarouselItem className="h-[300px]" key={2}>
                <SelectCategories
                  setCategories={(newCategories: CategoryItem[]) => {
                    form.setValue('categories', newCategories);
                  }}
                />
              </CarouselItem>
              <CarouselItem key={3}>
                <div className="p-1">
                  <Card className="lg:text-4xl h-full min-h-[410px]">
                    <CardContent className="flex flex-col aspect-square items-center justify-start lg:justify-center p-6 gap-4">
                      <FormLabel>Where does the event take place?</FormLabel>
                      {form.getValues('location.pk') ? (
                        <SelectedLocation
                          country={form.getValues('country.name')}
                          state={form.getValues('state.name')}
                          city={form.getValues('city.name')}
                          location={form.getValues('name_for_location')}
                          countryCode={
                            form.getValues(
                              'country_code_for_chosen_location'
                            ) ?? undefined
                          }
                        />
                      ) : (
                        <SelectLocation
                          setLocation={(LocationDetails: LocationDetails) => {
                            form.setValue(
                              'country.name',
                              LocationDetails.country
                            );
                            form.setValue('state.name', LocationDetails.state);
                            form.setValue('city.name', LocationDetails.city);
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

                            form.setValue(
                              'location.pk',
                              LocationDetails.location_pk
                            );
                            form.setValue(
                              'name_for_location',
                              LocationDetails.location_name
                            );
                          }}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
              <CarouselItem key={4}>
                <div className="p-1">
                  <Card>
                    <CardContent className="flex flex-col gap-6 aspect-square items-start  p-6">
                      {form.getValues('sunrise_time_for_chosen_location') ? (
                        <DisplaySunriseSunset
                          sunrise={
                            form.getValues(
                              'sunrise_time_for_chosen_location'
                            ) || 'Select a location first'
                          }
                          sunset={
                            form.getValues('sunset_time_for_chosen_location') ||
                            'Select a location first'
                          }
                          city={form.getValues('city.name')}
                        />
                      ) : (
                        <div>
                          Choose a location to see the sunrise and sunset times
                        </div>
                      )}

                      <DatePickerWithPresets updateFormData={setDate} />
                      <TimePickerComponent setDate={setDate} date={date} />
                      <FormField
                        control={form.control}
                        name="public"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">
                                Public Activity
                              </FormLabel>
                              <FormDescription>
                                If the activity is public, everyone can join it
                                anytime without a request.
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
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
              <CarouselItem key={5}>
                <div className="p-1">
                  <Card className="lg:text-4xl h-full min-h-[410px]">
                    <CardContent className="flex gap-4 flex-col aspect-square items-start justify-start p-6">
                      <IsCompetition
                        setTeam1Prop={(team_name: string) => {
                          form.setValue('competition.team_1.name', team_name);
                        }}
                        setTeam2Prop={(team_name: string) => {
                          form.setValue('competition.team_2.name', team_name);
                        }}
                        setIsCompetition={(isCompetition: boolean) => {
                          form.setValue('is_competition', isCompetition);
                        }}
                      />
                      <FormLabel className="mb-3">
                        How long does the activity last (Minutes)?
                      </FormLabel>
                      <DurationInput
                        setDuration={(value: number) => {
                          form.setValue('duration_in_minutes', value);
                        }}
                      />
                    </CardContent>
                  </Card>
                </div>
              </CarouselItem>
            </CarouselContent>
            <Button
              variant={'secondary'}
              className="w-full"
              type="submit"
              onClick={() => {
                console.log(form.formState.errors);
              }}
              disabled={!form.formState.isValid}
            >
              Create
            </Button>
            <CarouselPrevious />
            <CarouselNext />
          </form>
        </Form>
      </Carousel>
    </div>
  );
};

export default NewActivityDrawer;
