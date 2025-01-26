import { useState } from 'react';
import SearchNavbar from '../../components/SearchNavbar';
import { OrganizationListingType } from '@/types/OrganizationsListingSchema.ts';

type Props = {};

function Organizations({}: Props) {
  const [organizations, setOrganizations] = useState<OrganizationListingType[]>(
    []
  );
  return (
    <div>
      <SearchNavbar
        search_for="organizations"
        setOrganizations={setOrganizations}
      />
      Organizations Page
      {organizations.map((organization) => {
        return <div>{organization.name}</div>;
      })}
    </div>
  );
}

export default Organizations;
