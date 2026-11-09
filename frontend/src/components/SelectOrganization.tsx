import { useEffect, useState } from 'react';
import axiosInstance from '@/axios';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from './ui/button';

type Organization = { pk: string; name: string };
type Props = { onSelect: (pk: string) => void; label?: string; disabled?: boolean };
export const SelectedOrganizationComp = ({ name }: Organization) => <p className="min-w-0 break-words">{name}</p>;

export default function SelectOrganization({ onSelect, label = 'Organization', disabled = false }: Props) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selected, setSelected] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setFailed(false);
    axiosInstance.get('/api/organizations/list/').then(response => { if (active) setOrganizations(response.data); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  if (loading) return <p role="status" className="text-sm">Loading organizations…</p>;
  if (failed) return <div className="space-y-2"><p role="alert">Could not load organizations.</p><Button type="button" disabled={disabled} variant="outline" className="min-h-11" onClick={() => setAttempt(value => value + 1)}>Retry organizations</Button></div>;
  return selected ? (
    <div className="space-y-2 min-w-0">
      <SelectedOrganizationComp {...selected} />
      <Button type="button" disabled={disabled} variant="outline" className="min-h-11" onClick={() => setSelected(null)}>
        Change {label.toLowerCase()}
      </Button>
    </div>
  ) : (
    <Command label={`Search ${label.toLowerCase()}`} className="rounded-lg border my-2">
      <CommandInput
        aria-label={`Search ${label.toLowerCase()}`}
        placeholder="Search an organization…"
        disabled={disabled}
        className="min-h-11 text-base"
      />
      <CommandList className="max-h-56">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Organizations">
          {organizations.map(org => (
            <CommandItem
              key={org.pk}
              value={`${org.name} ${org.pk}`}
              disabled={disabled}
              className="min-h-11 whitespace-normal break-words text-base"
              onSelect={() => { setSelected(org); onSelect(org.pk); }}
            >
              {org.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
