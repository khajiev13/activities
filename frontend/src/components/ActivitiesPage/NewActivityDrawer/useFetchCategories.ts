import { useEffect, useState } from 'react';
import axiosInstance from '@/axios';

type Category = {
  pk: string;
  name: string;
  is_indoor: boolean;
  is_outdoor: boolean;
};

const useFetchCategories = (
  isIndoor: boolean,
  isOutdoor: boolean,
  isOnline: boolean
) => {
  const [loading, setLoading] = useState(false);
  const [fetchedCategories, setFetchedCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (isOutdoor || isIndoor || isOnline) {
      setLoading(true);
      axiosInstance
        .get(
          `/api/categories/?is_indoor=${isIndoor}&is_outdoor=${isOutdoor}&is_online=${isOnline}`
        )
        .then((response) => {
          const newCategories = response.data.map((category: Category) => ({
            pk: category.pk,
            name: category.name,
          }));
          setFetchedCategories(newCategories);
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching categories:', error);
        });
    }
  }, [isIndoor, isOutdoor, isOnline]);

  return { loading, fetchedCategories };
};

export default useFetchCategories;
