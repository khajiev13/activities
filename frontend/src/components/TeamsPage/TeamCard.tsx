import BadgeCityName from '../BadgeCityName';
import { BackgroundGradient } from '../ui/background-gradient';
import TeamKit from './TeamKit';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';

type TeamCardProps = {
  setUniformColors?: (name: string, color: string) => void;
  name: string;
  image?: File;
  location_name?: string;
};

const TeamCard: React.FC<TeamCardProps> = ({
  name,
  image,
  location_name,
  setUniformColors,
}) => {
  let imageUrl = undefined;
  if (image instanceof File) {
    imageUrl = URL.createObjectURL(image);
  }

  return (
    <div className="w-full flex justify-center">
      <BackgroundGradient
        containerClassName="rounded-[22px] max-w-sm w-full"
        className="rounded-[22px] max-w-sm p-0  bg-background flex items-center justify-center text-center w-full"
      >
        <ResizablePanelGroup
          direction="horizontal"
          className="max-w-md rounded-lg border-none"
        >
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="flex h-[200px] items-center justify-center p-6">
              <TeamKit colorPickerNeeded setUniformColors={setUniformColors} />
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
              <ResizablePanel defaultSize={75}>
                <div className="flex h-full items-center justify-center p-6">
                  <div>
                    <img
                      src={
                        imageUrl
                          ? imageUrl
                          : 'https://cdn.freebiesupply.com/logos/large/2x/chelsea-fc-2-logo-png-transparent.png'
                      }
                      alt="Team picture"
                      height="100"
                      width="100"
                      className="object-contain"
                    />
                    <h3 className="text-base sm:text-xl text-black mt-4 mb-2 dark:text-neutral-200">
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
