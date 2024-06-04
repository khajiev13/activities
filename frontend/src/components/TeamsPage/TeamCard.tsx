import BadgeCityName from '../BadgeCityName';
import { BackgroundGradient } from '../ui/background-gradient';
import TeamKit from './TeamKit';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useNavigate } from 'react-router-dom';

type TeamCardProps = {
  setUniformColors?: (name: string, color: string) => void;
  setTeamName?: (name: string) => void;
  name: string;
  image?: File;
  image_url?: string;
  location_name?: string;
  tshirt_color?: string;
  shorts_color?: string;
  socks_color?: string;
  away_tshirt_color?: string;
  color_picker_needed?: boolean;
};

const TeamCard: React.FC<TeamCardProps> = ({
  name,
  image,
  location_name,
  setUniformColors,
  tshirt_color,
  shorts_color,
  socks_color,
  away_tshirt_color,
  color_picker_needed,
  image_url,
  setTeamName,
}) => {
  let imageUrl = undefined;
  if (image instanceof File) {
    imageUrl = URL.createObjectURL(image);
  }
  const navigate = useNavigate();

  return (
    <div
      className="w-full flex justify-center z-40"
      onClick={() => {
        if (setTeamName) setTeamName(name);
      }}
    >
      <BackgroundGradient
        containerClassName="rounded-[22px] max-w-sm w-full"
        className="rounded-[22px] max-w-sm p-0  bg-primary flex items-center justify-center text-center w-full z-40"
      >
        <ResizablePanelGroup
          direction="horizontal"
          className="max-w-md rounded-lg border-none"
        >
          <ResizablePanel defaultSize={30} minSize={30}>
            <div className="flex h-[200px] items-center justify-center p-6">
              <TeamKit
                colorPickerNeeded={color_picker_needed}
                setUniformColors={setUniformColors}
                tshirt_color={tshirt_color}
                shorts_color={shorts_color}
                away_tshirt_color={away_tshirt_color}
                socks_color={socks_color}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />

          <ResizablePanel defaultSize={50}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={25}>
                <div className="flex h-full items-center justify-center p-6">
                  {location_name ? (
                    <BadgeCityName cityName={location_name} />
                  ) : (
                    ''
                  )}
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={75} onClick={() => navigate(name)}>
                <div className="flex h-full items-center justify-center p-6">
                  <div>
                    <img
                      src={imageUrl ? imageUrl : image_url}
                      alt="Team picture"
                      height="100"
                      width="100"
                      className="object-contain"
                    />
                    <h3 className="text-base sm:text-sm text-black mt-4 mb-2 dark:text-neutral-200">
                      {name}
                    </h3>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </BackgroundGradient>
    </div>
  );
};

export default TeamCard;
