import { SunriseIcon, SunsetIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
type DisplaySunriseSunsetProps = {
  sunrise: string;
  sunset: string;
  city: string;
};
import BadgeCityName from '@/components/BadgeCityName';

export function DisplaySunriseSunset({
  sunrise,
  sunset,
  city,
}: DisplaySunriseSunsetProps) {
  sunrise = sunrise.split(' ')[1];
  sunset = sunset.split(' ')[1];
  return (
    <Card className="flex flex-col w-full items-center">
      <h1 className="my-3">Sunrise and Sunset time for today</h1>
      <BadgeCityName cityName={city} />
      <Separator className="my-4" />
      <div className="flex justify-between w-full  gap-4 mb-4">
        <div className="flex justify-start items-center w-full">
          <SunriseIcon className="" size={50} color="orange" />
          <h3 className="m-auto">{sunrise}</h3>
        </div>
        <Separator orientation="vertical" className="p-0" />
        <div className="w-full flex justify-start items-center">
          <SunsetIcon size={50} color="orange" />
          <h3 className="m-auto">{sunset}</h3>
        </div>
      </div>

      {/* <div>{sunrise}</div>

      <div>{sunset}</div> */}
    </Card>
  );
}
