import React from 'react';
import AnimationHockeyPlayer from '../../components/AnimationHockeyPlayer';
import { LoginForm } from '@/components/LoginForm';

const Login: React.FC = () => {
  return (
    <div className="App bg-black flex p-0 m-0 h-screen w-full flex-row">
      <div className="w-1/4 flex-grow flex flex-col px-8 md:px-24 mt-5 align-center justify-center">
        {/* Logo at the corner */}
        <div className="relative z-20 flex items-center text-lg font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-6 w-6"
          >
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
          Eventopia
        </div>
        <LoginForm />
      </div>
      {/* Right side of the window */}
      <div className="w-56-percent px-4 light:bg-skin-color dark:bg-slate-900 min-h-full lg:flex hidden justify-center items-center flex-col ">
        <h1 className="font-murecho font-bold text-maincolor text-[32px] text-center tracking-[0] leading-[normal] mb-2">
          Eventopia - a place where different events take place!
        </h1>
        <p className="w-[563px] text-foreground font-murecho font-normal text-[#3b3b3b] text-[18px] text-center tracking-[0] leading-[26px]">
          It was a platform for people to make friends and attend different
          kinds of activities. Let’s start our interesting experience!
        </p>
        <AnimationHockeyPlayer height={500} width={590} />
      </div>
    </div>
  );
};

export default Login;
