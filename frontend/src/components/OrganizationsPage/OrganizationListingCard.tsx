import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OrganizationListingType } from '@/types/OrganizationsListingSchema';

export const OrganizationListingCard = ({ organization }: { organization: OrganizationListingType }) => (
  <Card aria-label={organization.name}>
    <CardHeader><CardTitle>{organization.name}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {organization.image_url && <img src={organization.image_url} alt={organization.name} className="h-24 w-24 object-contain" />}
      <p>{organization.location.name}, {organization.city.name}, {organization.state.name}, {organization.country.name}</p>
    </CardContent>
  </Card>
);
