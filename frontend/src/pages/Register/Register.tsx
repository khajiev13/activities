import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { UserAuthForm } from '@/components/user-register-form';

export const metadata: Metadata = {
  title: 'Authentication',
  description: 'Authentication forms built using the components.',
};
import { AspectRatio } from '@/components/ui/aspect-ratio';
import DifferentSports from '@/assets/svgs/various-sports.svg';

export default function Register() {
  return (
    <>
      <div className="container relative h-screen flex flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex justify-center">
          <div className="absolute inset-0 bg-background" />
          <div className="flex justify-center items-center w-full h-full">
            <AspectRatio
              ratio={16 / 9}
              className="flex justify-center items-center w-full h-full"
            >
              <Image
                src={DifferentSports}
                alt="Image"
                className="rounded-md object-cover"
                width={600}
                height={600}
              />
            </AspectRatio>
          </div>
          <div className="relative z-20 mt-auto text-foreground">
            <blockquote className="space-y-2">
              <p className="text-lg">
                &ldquo;At Eventopia, we believe that in the myriad of events
                lies the heart of connection. Join our vibrant community where
                diversity thrives, passions unite, and every adventure is a
                chance to explore, learn, and grow. &rdquo;
              </p>
              <footer className="text-sm">Roma Khajiev</footer>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8 sm:w-11/12">
          <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                Create an account
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email below to create your account
              </p>
            </div>
            <UserAuthForm />
            <p className="px-8 text-center text-sm text-muted-foreground">
              By clicking continue, you agree to our{' '}
              <Link
                href="/terms"
                className="underline underline-offset-4 hover:text-primary"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="underline underline-offset-4 hover:text-primary"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
