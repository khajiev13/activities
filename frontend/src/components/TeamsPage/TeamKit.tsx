import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import TshirtSvg from '@/assets/svgs/TshirtSvg';
import AwayTshirtSvg from '@/assets/svgs/AwayTshirtSvg';
import ShortsSvg from '@/assets/svgs/ShortsSvg';
import SocksSvg from '@/assets/svgs/SocksSvg';

type Props = {
  colorPickerNeeded?: boolean;
  tshirt_color?: string; shorts_color?: string; socks_color?: string; away_tshirt_color?: string;
  setUniformColors?: (name: string, color: string) => void;
};
const ignoreSelection = () => {};
export default function TeamKit({ colorPickerNeeded, tshirt_color, shorts_color, socks_color, away_tshirt_color, setUniformColors }: Props) {
  const id = useId();
  const [colors, setColors] = useState<Record<string, string>>({ tshirt: tshirt_color || '', shorts: shorts_color || '', socks: socks_color || '', awaytshirt: away_tshirt_color || '' });
  function chooseColor(name: string, color: string) {
    setColors(current => ({ ...current, [name]: color }));
    setUniformColors?.(name, color);
  }
  return <div className="grid grid-cols-2 gap-4 min-w-0">{[
    { name: 'tshirt', label: 'Home shirt', Icon: TshirtSvg }, { name: 'awaytshirt', label: 'Away shirt', Icon: AwayTshirtSvg },
    { name: 'shorts', label: 'Shorts', Icon: ShortsSvg }, { name: 'socks', label: 'Socks', Icon: SocksSvg },
  ].map(({ name, label, Icon }) => <div key={name} className="rounded-lg border p-3 min-w-0 space-y-2">
    <Icon fill={colors[name]} width="64" height="64" selectClothing={ignoreSelection} />
    <label htmlFor={`${id}-${name}`} className="block text-base">{label}</label>
    {colorPickerNeeded && <input id={`${id}-${name}`} type="color" className="w-full h-12 rounded border bg-background" value={colors[name] || '#000000'} onChange={event => chooseColor(name, event.target.value)} />}
    {colorPickerNeeded && <Button type="button" variant="outline" aria-label={`Use ${label.toLowerCase()} color`} className="w-full min-h-11 text-base whitespace-normal px-2 py-2" onClick={() => chooseColor(name, colors[name] || '#000000')}>Use color</Button>}
    <p className="text-xs text-muted-foreground">{colors[name] || 'No color chosen'}</p>
  </div>)}</div>;
}
