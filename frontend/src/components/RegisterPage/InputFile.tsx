import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface InputFileProps {
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const InputFile: React.FC<InputFileProps> = ({ onChange }) => {
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor="picture">Profile picture</Label>
      <Input
        id="picture"
        type="file"
        onChange={onChange}
        accept="image/*"
        name="image"
      />
    </div>
  );
};
