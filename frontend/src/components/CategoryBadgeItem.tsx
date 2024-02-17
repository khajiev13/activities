import React from 'react';
import { Badge } from '@/components/ui/badge';
import { HashIcon } from 'lucide-react';

interface BadgeItemProps {
  /**
   * The unique key for the list item
   */
  pk: string;
  /**
   * The name to be displayed within the badge
   */
  name: string;
}

const BadgeItem: React.FC<BadgeItemProps> = ({ pk, name }) => (
  <li key={pk} className="mr-2">
    <Badge className="flex items-center ">
      <HashIcon className="h-5 w-5" />
      {name}
    </Badge>
  </li>
);

export default BadgeItem;
