import React from 'react';
import femaleIcon from '@/assets/svgs/female.svg';
import maleIcon from '@/assets/svgs/male.svg';
import { FormLabel } from './ui/form';

// Assuming the setGender function signature looks something like this
interface SelectGenderProps {
  male: boolean;
  setGender: (gender: true | false) => void;
}

const SelectGender: React.FC<SelectGenderProps> = ({ setGender, male }) => {
  return (
    <>
      <FormLabel>Choose gender for the team</FormLabel>
      <div className="flex items-center justify-center space-x-4">
        <button
          aria-label="Select male"
          className={`focus:outline-none p-1 ${
            male === true ? 'border-2 border-primary rounded-full' : ''
          }`}
          onClick={(event) => {
            setGender(true);
            event.preventDefault();
          }}
        >
          <img src={maleIcon} alt="Male" className="w-12 h-12" />
        </button>
        <button
          aria-label="Select female"
          className={`focus:outline-none p-1 ${
            male === false ? 'border-2 border-primary rounded-full' : ''
          }`}
          onClick={(event) => {
            setGender(false);
            event.preventDefault();
          }}
        >
          <img src={femaleIcon} alt="Female" className="w-12 h-12" />
        </button>
      </div>
    </>
  );
};

export default SelectGender;
