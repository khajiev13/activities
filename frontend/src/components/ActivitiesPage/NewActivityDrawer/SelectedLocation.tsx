import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import ReactCountryFlag from 'react-country-flag';

interface SelectedLocationProps {
  country: string;
  state: string;
  city: string;
  location: string;
  countryCode?: string;
}

export function SelectedLocation({
  country,
  state,
  city,
  location,
  countryCode,
}: SelectedLocationProps) {
  // Setup the country code

  return (
    <div className="w-full">
      <Select disabled defaultValue={country}>
        <Label className="px-3 py-2">Country</Label>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            <SelectLabel>Location</SelectLabel>
            <SelectItem defaultChecked value={country}>
              {country}
              {countryCode && (
                <ReactCountryFlag
                  countryCode={countryCode}
                  svg
                  style={{
                    width: '2em',
                    height: '2em',
                    marginLeft: '0.5em',
                  }}
                />
              )}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select disabled defaultValue={state}>
        <Label className="px-3 py-2">State or City</Label>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            <SelectLabel>Location</SelectLabel>
            <SelectItem defaultChecked value={state}>
              {state}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select disabled defaultValue={city}>
        <Label className="px-3 py-2">City or Area</Label>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            <SelectLabel>Location</SelectLabel>
            <SelectItem defaultChecked value={city}>
              {city}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select disabled defaultValue={location}>
        <Label className="px-3 py-2">Name</Label>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectGroup>
            <SelectLabel>Location</SelectLabel>
            <SelectItem defaultChecked value={location}>
              {location}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export default SelectedLocation;
