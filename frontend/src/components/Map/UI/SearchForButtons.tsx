import { Button } from '@/components/ui/button';

type Props = {
  setSearchFor: (searchFor: string) => void;
};
export const SearchForButtons = ({ setSearchFor }: Props) => {
  const searchForButtons = [
    { name: 'Activities', value: 'activities' },
    { name: 'Teams', value: 'teams' },
    { name: 'Organizations', value: 'organizations' },
  ];
  return (
    <div className="flex flex-col gap-4">
      {searchForButtons.map((button, index) => (
        <Button
          variant={'secondary'}
          key={index}
          value={button.value}
          onClick={() => setSearchFor(button.value)}
        >
          {button.name}
        </Button>
      ))}
    </div>
  );
};
