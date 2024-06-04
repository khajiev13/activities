import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type DurationInputProps = {
  setDuration: (value: number) => void;
};

const DurationInput = ({ setDuration }: DurationInputProps) => {
  const [minutes, setMinutes] = useState(0);

  const increment = () => setMinutes((prev) => prev + 1);
  const decrement = () => setMinutes((prev) => (prev > 0 ? prev - 1 : 0));
  useEffect(() => {
    setDuration(Number(minutes));
  }, [minutes]);

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <Button
        variant="ghost"
        onClick={decrement}
        style={{ marginRight: '8px' }}
        type="button"
      >
        -
      </Button>
      <Input
        type="number"
        value={minutes}
        onChange={(e) => {
          setMinutes(Number(e.target.value));
        }}
        min={0}
        style={{ textAlign: 'center' }}
      />
      <Button
        variant="ghost"
        type="button"
        onClick={increment}
        style={{ marginLeft: '8px' }}
      >
        +
      </Button>
    </div>
  );
};

export default DurationInput;
