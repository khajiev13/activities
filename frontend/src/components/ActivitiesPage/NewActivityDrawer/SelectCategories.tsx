('use client');
import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import BadgeItem from '@/components/CategoryBadgeItem';
import { Card, CardContent } from '@/components/ui/card';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import useFetchCategories from './useFetchCategories';
import CategoryLoadingSkeleton from './CategoryLoadingSkeleton';
import AddNewCategory from './AddNewCategory';

export type CategoryItem = {
  pk: string;
  name: string;
};

interface Props {
  setCategories: (categories: CategoryItem[]) => void;
}

const SelectCategories: React.FC<Props> = ({ setCategories }) => {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState<string[]>([]);
  const [isOutdoor, setIsOutdoor] = React.useState<boolean>(false);
  const [isIndoor, setIsIndoor] = React.useState<boolean>(false);
  const [isOnline, setIsOnline] = React.useState<boolean>(false);

  // If user turned the switch on for outdoor activities, we need to fetch the categories for outdoor activities
  const { loading, fetchedCategories } = useFetchCategories(
    isIndoor,
    isOutdoor,
    isOnline
  );
  const onSwitchChange = (onSwitchName: string) => (checked: boolean) => {
    fetchedCategories.length = 0;
    if (onSwitchName === 'outdoor') {
      setIsOutdoor(checked);
    } else if (onSwitchName === 'indoor') {
      setIsIndoor(checked);
    } else if (onSwitchName === 'online') {
      setIsOnline(checked);
    }
    // Empty the selected categories because we wanna clear everything when the user changes the indoor and outdoor switches
    setValue([]);
  };
  return (
    <div className="p-1">
      <Card className="lg:text-4xl h-full min-h-[410px]">
        <CardContent className="flex aspect-square  p-6 flex-col gap-5">
          <div className="flex items-center justify-around">
            <div className="flex items-center">
              <Switch
                id="outdoor"
                disabled={isIndoor || isOnline}
                onCheckedChange={onSwitchChange('outdoor')}
              />
              <Label htmlFor="outdoor">Outdoor activity</Label>
            </div>
            <div className="flex items-center">
              <Switch
                disabled={isOutdoor || isOnline}
                id="indoor"
                onCheckedChange={onSwitchChange('indoor')}
              />
              <Label htmlFor="indoor">Indoor activity</Label>
            </div>
            <div className="flex items-center">
              <Switch
                disabled={isIndoor || isOutdoor}
                id="online"
                onCheckedChange={onSwitchChange('online')}
              />
              <Label htmlFor="online">Online activity</Label>
            </div>
          </div>
          <ul className="flex flex-wrap gap-3">
            {value.map((val) => {
              const [pk, name] = val.split(' ');
              return BadgeItem({ pk: pk, name: name });
            })}
          </ul>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild className="w-full min-w-full">
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-[200px] justify-between"
                disabled={isOutdoor || isIndoor || isOnline ? false : true}
              >
                Select categories
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[310px] md:w-[475px] lg:w-[475px] p-0">
              <Command>
                <CommandInput placeholder="Search categories..." />
                <CommandEmpty>No category found.</CommandEmpty>
                <CommandGroup className="max-h-[200px] overflow-y-auto scroll-auto min-h-fit ">
                  {loading && (
                    <>
                      <CategoryLoadingSkeleton />
                      <CategoryLoadingSkeleton />
                      <CategoryLoadingSkeleton />
                      <CategoryLoadingSkeleton />
                      <CategoryLoadingSkeleton />
                    </>
                  )}
                  {fetchedCategories.map((category: CategoryItem) => (
                    <CommandItem
                      key={category.pk}
                      value={category.pk + ' ' + category.name}
                      onSelect={(currentValue) => {
                        const newValue = value.includes(currentValue)
                          ? value.filter((val) => val !== currentValue)
                          : [...value, currentValue];

                        const filteredNewValues = newValue.map((val) => {
                          const [pk, name] = val.split(' ');
                          return { pk, name };
                        });
                        setCategories(filteredNewValues); // Update the categories state with the new array
                        setValue(newValue); // We need to update the value state to update the UI and Check component below checks the value state to show the check icon
                        setOpen(true);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value.includes(
                            category.pk + ' ' + category.name.toLowerCase()
                          )
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      {category.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <AddNewCategory
                  is_outdoor={isOutdoor}
                  is_indoor={isIndoor}
                  is_online={isOnline}
                  setValue={(value: string) => {
                    setValue((prevValue) => [...prevValue, value]);
                  }}
                  setCategories={(newCategories: CategoryItem[]) => {
                    setCategories([...newCategories, ...newCategories]);
                  }}
                />
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>
    </div>
  );
};

export default SelectCategories;
