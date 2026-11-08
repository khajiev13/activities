import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import useFetchCategories from '@/hooks/useFetchCategories';
import AddNewCategory from './AddNewCategory';

export type CategoryItem = { pk: string; name: string };
export default function SelectCategories({ setCategories }: { setCategories: (categories: CategoryItem[]) => void }) {
  const [kind, setKind] = useState('');
  const [selected, setSelected] = useState<CategoryItem[]>([]);
  const { loading, fetchedCategories } = useFetchCategories(kind === 'indoor', kind === 'outdoor', kind === 'online');
  function update(next: CategoryItem[]) { setSelected(next); setCategories(next); }
  return <div className="space-y-4 text-base">
    <div className="flex flex-wrap gap-4">{[['outdoor', 'Outdoor activity'], ['indoor', 'Indoor activity'], ['online', 'Online activity']].map(([value, label]) => <div key={value} className="flex items-center gap-2 min-h-11"><Switch id={`category-${value}`} checked={kind === value} onCheckedChange={checked => { setKind(checked ? value : ''); update([]); }} /><Label htmlFor={`category-${value}`}>{label}</Label></div>)}</div>
    {selected.length > 0 && <p className="text-sm">Selected: {selected.map(category => category.name).join(', ')}</p>}
    {kind && <><div className="max-h-56 overflow-y-auto space-y-2" aria-label="Available categories">
      {loading && <p role="status" className="text-sm">Loading categories…</p>}
      {fetchedCategories.map(category => <label key={category.pk} className="flex items-center gap-3 min-h-11"><input type="checkbox" className="h-5 w-5" checked={selected.some(item => item.pk === category.pk)} onChange={event => update(event.target.checked ? [...selected, { pk: category.pk, name: category.name }] : selected.filter(item => item.pk !== category.pk))} />{category.name}</label>)}
      {!loading && !fetchedCategories.length && <p className="text-sm">No categories available for this type.</p>}
    </div><AddNewCategory is_indoor={kind === 'indoor'} is_outdoor={kind === 'outdoor'} is_online={kind === 'online'} setValue={() => {}} setCategories={created => update([...selected, ...created.filter(category => !selected.some(item => item.pk === category.pk))])} /></>}
  </div>;
}
