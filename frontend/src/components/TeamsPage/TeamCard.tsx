import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import TeamKit from './TeamKit';
import TshirtSvg from '@/assets/svgs/TshirtSvg';
import AwayTshirtSvg from '@/assets/svgs/AwayTshirtSvg';
import ShortsSvg from '@/assets/svgs/ShortsSvg';
import SocksSvg from '@/assets/svgs/SocksSvg';

type TeamCardProps = {
  setUniformColors?: (name: string, color: string) => void;
  setTeamName?: (name: string) => void;
  name: string; image?: File; image_url?: string | null; location_name?: string;
  tshirt_color?: string; shorts_color?: string; socks_color?: string; away_tshirt_color?: string;
  color_picker_needed?: boolean; detail?: boolean;
};
const ignoreSelection = () => {};
export default function TeamCard({ name, image, image_url, location_name, setUniformColors, setTeamName,
  tshirt_color, shorts_color, socks_color, away_tshirt_color, color_picker_needed, detail }: TeamCardProps) {
  const [imageUrl, setImageUrl] = useState<string>();
  const location = useLocation();
  useEffect(() => {
    if (!image) { setImageUrl(undefined); return; }
    const url = URL.createObjectURL(image); setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  return <article className="mx-auto w-full max-w-xl rounded-2xl border bg-card p-4 space-y-4">
    <div className="flex flex-col items-center gap-3 text-center">
      {(imageUrl || image_url) && <img src={imageUrl || image_url || undefined} alt={`${name} team picture`} className="h-28 w-28 rounded-xl object-contain" />}
      <h2 className="text-xl font-semibold break-words w-full">{setTeamName ? <button type="button" className="min-h-12" onClick={() => setTeamName(name)}>{name}</button> : detail || color_picker_needed ? name : <Link className="inline-flex min-h-12 items-center" to={`/teams/${encodeURIComponent(name)}${location.search}`} state={{ from: location.pathname + location.search }}>{name}</Link>}</h2>
      {location_name && <p className="text-sm text-muted-foreground">{location_name}</p>}
    </div>
    <section aria-label="Team kit">
      <h3 className="font-semibold mb-3">Team kit</h3>
      {color_picker_needed ? <TeamKit colorPickerNeeded setUniformColors={setUniformColors} tshirt_color={tshirt_color} shorts_color={shorts_color} socks_color={socks_color} away_tshirt_color={away_tshirt_color} /> :
        <div className="flex flex-wrap justify-center gap-4">
          {[{ Icon: TshirtSvg, color: tshirt_color, label: 'Home shirt' }, { Icon: AwayTshirtSvg, color: away_tshirt_color, label: 'Away shirt' }, { Icon: ShortsSvg, color: shorts_color, label: 'Shorts' }, { Icon: SocksSvg, color: socks_color, label: 'Socks' }].map(({ Icon, color, label }) => <figure key={label} className="w-20 text-center"><Icon fill={color} width="80" height="80" selectClothing={ignoreSelection} /><figcaption className="text-xs text-muted-foreground">{label}</figcaption></figure>)}
        </div>}
    </section>
  </article>;
}
