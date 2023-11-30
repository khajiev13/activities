import React, { useEffect, useRef } from 'react';
import lottie from 'lottie-web';
import animationDataHockey from '../illustrations/warp-hockey-player.json';

interface AnimationHockeyPlayerProps {
  height: string | number;
  width: string | number;
}

const AnimationHockeyPlayer: React.FC<AnimationHockeyPlayerProps> = ({
  height,
  width,
}) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current) {
      lottie.loadAnimation({
        container: container.current,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: animationDataHockey,
      });
    }
  }, []);

  return (
    <div
      ref={container}
      style={{ width, height }}
      className="pointer-events-none"
    />
  );
};

export default AnimationHockeyPlayer;
