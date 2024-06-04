import { LeftHeader } from './LeftHeader';
import Globe from '@/components/HomePage/Globe';
const Header = () => {
  return (
    <div className="grid md:grid-cols-4 grid-cols-2 p-0 m-0">
      <div className="md:col-span-2 col-span-1">
        <LeftHeader />
      </div>
      <div className="md:col-span-2 col-span-1">
        <Globe />
      </div>
    </div>
  );
};

export default Header;
