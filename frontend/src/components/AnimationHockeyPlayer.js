import Lottie from 'react-lottie';
import animationDataHockey from '../illustrations/warp-hockey-player.json';
import React from 'react';

function AnimationHockeyPlayer({ height, width }) {
  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationDataHockey,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };
  return (
    <div classname="pointer-events-none">
      <Lottie options={defaultOptions} height={height} width={width} />
    </div>
  );
}

export default AnimationHockeyPlayer;
