import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import { Loader2 } from 'lucide-react';

export function SubmitLocation() {
  return (
    <BackgroundGradient className="rounded-[22px] max-w-2lg md:max-w-4xl p-4 sm:p-10 bg-white dark:bg-zinc-900">
      <form
        className="flex w-full flex-col items-start justify-start gap-3  max-w-sm  space-x-2"
        id="location-form"
      >
        <Input
          id="location-input"
          type="text"
          placeholder="Name"
          autoCapitalize="words"
          autoComplete="off"
        />
        <Button
          variant="secondary"
          className="mr-0"
          id="location-submit"
          type="submit"
        >
          <Loader2
            id="spinner-loading"
            className="mr-2 h-4 w-4 animate-spin hidden"
          />
          Add pin &#128205;
        </Button>
      </form>
    </BackgroundGradient>
  );
}
