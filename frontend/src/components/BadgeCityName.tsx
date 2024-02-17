import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

type BadgeCityNameProps = {
  cityName: string;
};

const BadgeCityName: React.FC<BadgeCityNameProps> = ({ cityName }) => {
  return (
    <Badge variant="secondary" className="flex justify-center ">
      <MapPin className=" h-6 w-6 gap-3" /> {cityName}
    </Badge>
  );
};

export default BadgeCityName;
