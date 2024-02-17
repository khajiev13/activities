import { Skeleton } from '@/components/ui/skeleton';
import { CommandItem } from '@/components/ui/command';

export default function CategoryLoadingSkeleton() {
  return (
    <div>
      <CommandItem>
        <Skeleton className="h-4 w-full" />
      </CommandItem>
    </div>
  );
}
