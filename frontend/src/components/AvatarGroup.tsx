import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

type Participant = {
  id: string;
  imageUrl: string;
  username: string;
  initials: string;
};

type AvatarGroupProps = {
  participants: Participant[];
  overflowCount: number;
};

export function AvatarGroup({ participants, overflowCount }: AvatarGroupProps) {
  return (
    <div className="flex -space-x-2">
      {participants.map((participant) => (
        <Avatar key={participant.id}>
          <AvatarImage
            src={participant.imageUrl}
            alt={`@${participant.username}`}
          />
          <AvatarFallback>{participant.initials}</AvatarFallback>
        </Avatar>
      ))}
      {overflowCount > 0 && (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white text-sm">
          +{overflowCount}
        </div>
      )}
    </div>
  );
}
