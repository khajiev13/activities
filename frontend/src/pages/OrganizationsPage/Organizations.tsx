import { useEffect, useState } from 'react';
import SearchNavbar from '../../components/SearchNavbar';
import { OrganizationListingType } from '@/types/OrganizationsListingSchema.ts';

import { useLocation } from 'react-router-dom';
import { OrganizationListingCard } from '@/components/OrganizationsPage/OrganizationListingCard';

type Props = {};

function Organizations({}: Props) {
  const location = useLocation();
  const [organizations, setOrganizations] = useState<OrganizationListingType[]>(
    []
  );
  useEffect(() => {
    if (location.state?.createdOrganization) setOrganizations([location.state.createdOrganization]);
  }, [location.state]);
  return (
    <div>
      <SearchNavbar
        search_for="organizations"
        setOrganizations={setOrganizations}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {organizations.map((organization) => <OrganizationListingCard key={organization.pk} organization={organization} />)}
      </div>
    </div>
  );
}

export default Organizations;
