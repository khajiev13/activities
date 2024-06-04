import ShortsSvg from '@/assets/svgs/ShortsSvg.tsx';
import SocksSvg from '@/assets/svgs/SocksSvg';
import TshirtSvg from '@/assets/svgs/TshirtSvg';
import AwayTshirtSvg from '@/assets/svgs/AwayTshirtSvg';
import { useEffect, useState } from 'react';
import { TwitterPicker } from 'react-color';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel';

type Props = {
  colorPickerNeeded?: boolean;
  tshirt_color?: string;
  shorts_color?: string;
  socks_color?: string;
  away_tshirt_color?: string;
  setUniformColors?: (name: string, color: string) => void;
};

const TeamKit = ({
  colorPickerNeeded,
  setUniformColors,
  tshirt_color,
  socks_color,
  away_tshirt_color,
  shorts_color,
}: Props) => {
  const [clothes, setClothes] = useState([
    {
      name: 'tshirt',
      selected: false,
      color: tshirt_color ? tshirt_color : '',
    },
    {
      name: 'shorts',
      selected: false,
      color: shorts_color ? shorts_color : '',
    },
    { name: 'socks', selected: false, color: socks_color ? socks_color : '' },
    {
      name: 'awaytshirt',
      selected: false,
      color: away_tshirt_color ? away_tshirt_color : '',
    },
  ]);
  const selectClothing = (selectedName: string) => {
    setClothes(
      clothes.map((clothing) =>
        clothing.name === selectedName
          ? { ...clothing, selected: true }
          : { ...clothing, selected: false }
      )
    );
  };
  const selectColor = (selectedColor: any) => {
    setClothes(
      clothes.map((clothing) =>
        clothing.selected ? { ...clothing, color: selectedColor.hex } : clothing
      )
    );
  };

  useEffect(() => {
    const itemsWithoutSelected = clothes.map(({ selected, ...item }) => item);
    const filteredData = itemsWithoutSelected.filter(
      (item) => item.color !== ''
    );
    if (filteredData.length === 4) {
      filteredData.forEach((item) => {
        if (setUniformColors) {
          setUniformColors(item.name, item.color);
        }
      });
    }
  }, [clothes]);

  return (
    <div className="flex justify-center items-center flex-col relative w-full h-full min-h-44">
      <Popover>
        <PopoverTrigger asChild>
          <div className="z-20 absolute top-0">
            <Carousel className="left-[61px]">
              <CarouselContent>
                <CarouselItem key={1}>
                  <TshirtSvg
                    fill={clothes[0].color}
                    height="100"
                    width="100"
                    selectClothing={selectClothing}
                    selected={clothes[0].selected}
                  />
                </CarouselItem>
                <CarouselItem key={2}>
                  <AwayTshirtSvg
                    fill={clothes[3].color}
                    height="100"
                    width="100"
                    selectClothing={selectClothing}
                    selected={clothes[3].selected}
                  />
                </CarouselItem>
              </CarouselContent>
            </Carousel>
          </div>
        </PopoverTrigger>
        <PopoverTrigger asChild>
          <div className="absolute top-[63px] -translate-x-[0.5px]">
            <ShortsSvg
              fill={clothes[1].color}
              height="92"
              width="92"
              selectClothing={selectClothing}
              selected={clothes[1].selected}
            />
          </div>
        </PopoverTrigger>
        <PopoverTrigger asChild>
          <div className="absolute top-[130px] -translate-x-[0.5px]">
            <SocksSvg
              fill={clothes[2].color}
              height="50"
              width="50"
              selectClothing={selectClothing}
              selected={clothes[2].selected}
            />
          </div>
        </PopoverTrigger>
        {colorPickerNeeded && (
          <PopoverContent className="min-w-full min-h-full p-0">
            <TwitterPicker
              onChangeComplete={selectColor}
              styles={{
                default: {
                  input: {
                    height: '30px',
                  },
                },
              }}
              width="290px"
              triangle="hide"
              className="!bg-transparent !border-background !shadow-none"
              colors={[
                '#000000',
                '#FFFFFF',
                '#808080',
                '#0000FF',
                '#FF0000',
                '#008000',
                '#FFFF00',
                '#800080',
                '#FFA500',
                '#008080',
              ]}
            />
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
};

export default TeamKit;
