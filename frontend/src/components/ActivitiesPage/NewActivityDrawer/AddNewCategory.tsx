import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import axiosInstance from '@/axios';
import { CategoryItem } from './SelectCategories';
import { toast, Toaster } from 'sonner';

interface Category {
  name: string;
  is_outdoor: boolean;
  is_indoor: boolean;
  is_online: boolean;
}
interface Props {
  is_outdoor: boolean;
  is_indoor: boolean;
  is_online: boolean;
  setValue: (value: string) => void;
  setCategories: (categories: CategoryItem[]) => void;
}

export default function AddNewCategory({
  is_indoor,
  is_outdoor,
  is_online,
  setValue,
  setCategories,
}: Props) {
  const [name, setName] = useState<string>('');

  const sendPostRequest = async () => {
    const category: Category = {
      name: name,
      is_outdoor: is_outdoor,
      is_indoor: is_indoor,
      is_online: is_online,
    };
    console.log(category);
    await axiosInstance.post('api/categories/', category).then((res) => {
      const createdCategory: CategoryItem[] = [
        {
          pk: res.data.pk,
          name: res.data.name,
        },
      ];
      const createdCategoryString =
        createdCategory[0].pk + ' ' + createdCategory[0].name;
      setValue(createdCategoryString);
      setCategories(createdCategory);
      toast('Category created successfully!', {
        description: "It's been selected successfully for you",
      });
    });
  };

  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <Button className="w-full mt-4">Add New Category</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add a new category</DialogTitle>
            <DialogDescription>
              Write the name of the new category and click on "Add category".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                defaultValue="Volleyball"
                className="col-span-3"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Toaster />
            <DialogClose asChild>
              <Button onClick={sendPostRequest} type="submit">
                Add category
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
