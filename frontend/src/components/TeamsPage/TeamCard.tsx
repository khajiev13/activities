import { BackgroundGradient } from '../ui/background-gradient';

type TeamCardProps = {
  name: string;
  image?: File;
};

const TeamCard: React.FC<TeamCardProps> = ({ name, image }) => {
  let imageUrl = undefined;
  if (image instanceof File) {
    imageUrl = URL.createObjectURL(image);
  }

  return (
    <div className="w-full flex justify-center">
      <BackgroundGradient
        containerClassName="rounded-[22px] max-w-sm"
        className="rounded-[22px] max-w-sm p-4 sm:p-10  bg-background flex flex-col items-center justify-center text-center "
      >
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
      </BackgroundGradient>
    </div>
  );
};

export default TeamCard;
