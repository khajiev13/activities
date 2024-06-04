'use client';
import { motion } from 'framer-motion';
import { Highlight } from '../ui/hero-highlight';
import { Button } from '../ui/button';
import Link from 'next/link';
export function LeftHeader() {
  return (
    <div className="flex flex-col items-center justify-center h-[40rem] ">
      <motion.h1
        initial={{
          opacity: 0,
          y: 20,
        }}
        animate={{
          opacity: 1,
          y: [20, -5, 0],
        }}
        transition={{
          duration: 0.5,
          ease: [0.4, 0.0, 0.2, 1],
        }}
        className="text-2xl px-4 md:text-4xl lg:text-5xl font-bold text-neutral-700 dark:text-white max-w-4xl leading-relaxed lg:leading-snug text-center mx-auto "
      >
        With Eventopia, Finding activities,teams and people around you is easy.
        <br />
        Eventopia - where{' '}
        <Highlight className="text-black dark:text-white">
          different events take place!
        </Highlight>
      </motion.h1>
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 space-x-0 md:space-x-4 mt-10">
        <Button>
          <Link href={'activities'}>Find activities</Link>
        </Button>
        <Button variant={'outline'}>
          <Link href={'teams'}>Find teams</Link>
        </Button>
      </div>
    </div>
  );
}
