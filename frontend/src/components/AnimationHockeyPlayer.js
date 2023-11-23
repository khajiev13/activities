import { useEffect, useRef } from 'react';
import lottie from 'lottie-web';
import animationDataHockey from '../illustrations/warp-hockey-player.json';

function AnimationHockeyPlayer({ height, width }) {
  const container = useRef();

  useEffect(() => {
    lottie.loadAnimation({
      container: container.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: animationDataHockey,
    });
  }, []);

  return (
    <div ref={container} style={{ width, height }} className="pointer-events-none" />
  );
}

export default AnimationHockeyPlayer;
