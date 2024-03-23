import React, { useEffect, useState } from 'react';
import axiosInstance from '@/axios';
import { Building2, LucideCheckCircle } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Skeleton } from './ui/skeleton';
import { useNavigate } from 'react-router-dom';

interface Organization {
  pk: string;
  name: string;
}

interface Props {
  onSelect: (pk: string) => void;
}

export const SelectedOrganizationComp: React.FC<Organization> = ({
  name,
  pk,
}) => {
  const navigate = useNavigate();

  return (
    <div
      className="flex items-center hover:cursor-pointer m-0 p-0"
      key={pk}
      onClick={() => navigate(`/organizations/${pk}`)}
    >
      <LucideCheckCircle className="h-8 w-8 mr-2 text-primary" />
      <Building2 className=" h-5 w-5" />
      <h1>{name}</h1>
    </div>
  );
};

const SelectOrganization: React.FC<Props> = ({ onSelect }) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  // Fetch organizations from the backend on component mount
  useEffect(() => {
    setLoading(true);
    axiosInstance
      .get('api/organizations/list/')
      .then((response) => {
        setOrganizations(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error('There was an error fetching the organizations:', error);
      });
  }, []);

  // Function to handle organization selection
  const handleSelectChange = (pk: string, name: string) => {
    const newOrganization: Organization = { pk, name };
    setSelectedOrganization(newOrganization);
    onSelect(pk);
  };

  return (
    <>
      {loading ? (
        <div className="rounded-lg border shadow-md p-4">
          {/* Simulate the CommandInput */}
          <Skeleton className="h-10 mb-4" />
          {/* Simulate the list items */}
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center mb-2">
              <Skeleton className="h-4 w-4 mr-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : !selectedOrganization ? (
        <Command className="rounded-lg border shadow-md my-2">
          <CommandInput placeholder="Search an organization..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Organizations">
              {organizations.map((org) => (
                <CommandItem
                  onClick={() => {
                    alert('clicked');
                  }}
                  key={org.pk}
                >
                  <Building2
                    onClick={() => {
                      alert('clicked');
                    }}
                    className="mr-2 h-4 w-4"
                  />
                  <span
                    onClick={() => {
                      handleSelectChange(org.pk, org.name);
                    }}
                    className="w-full"
                  >
                    {org.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      ) : (
        <SelectedOrganizationComp
          pk={selectedOrganization.pk}
          name={selectedOrganization.name}
        />
      )}
    </>
  );
};

export default SelectOrganization;
