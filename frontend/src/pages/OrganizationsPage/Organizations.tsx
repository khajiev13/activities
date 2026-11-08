import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DiscoveryPage } from '@/components/Discovery/DiscoveryPage';
import { useDiscovery } from '@/discovery/DiscoveryContext';
import { serializeDiscovery } from '@/discovery/query';
import { OrganizationListingSchema } from '@/types/OrganizationsListingSchema';

export default function Organizations() {
  const location = useLocation(); const navigate = useNavigate();
  const { state, reload } = useDiscovery();
  const created = useMemo(() => {
    const parsed = OrganizationListingSchema.safeParse(location.state?.createdOrganization);
    return parsed.success ? parsed.data : null;
  }, [location.state]);
  const consumed = useRef<string | null>(null);
  useEffect(() => {
    if (!created || consumed.current === location.key) return;
    consumed.current = location.key;
    // Consume the existing form handoff before mounting the chooser/list. Its
    // real place tuple establishes the directory context; old search must not hide it.
    navigate({ pathname: location.pathname, search: serializeDiscovery({ ...state,
      geo: { level: 'city', country: created.country.name, state: created.state.name, city: created.city.name },
      entity: 'organizations', view: 'list', query: '',
    }) }, { replace: true, state: { ...location.state, createdOrganization: undefined } });
    reload();
  }, [created, location.key, location.pathname, location.state, navigate, state, reload]);
  if (created) return <p role="status">Opening the created organization…</p>;
  return <DiscoveryPage entity="organizations" />;
}
