import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
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
      <div className="container relative h-screen flex flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0 ">
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'absolute right-4 top-4 md:right-8 md:top-8'
          )}
        >
          Login
        </Link>
        <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex justify-center">
          <div className="absolute inset-0 bg-zinc-900" />
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
          <div className="relative z-20 mt-auto">
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
        <div className="lg:p-8">
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

// import React, { ChangeEvent, FormEvent, useState } from 'react';
// import axiosInstance from '../../axios';
// import { useNavigate } from 'react-router-dom';

// interface FormData {
//   username: string;
//   password: string;
//   first_name: string;
//   last_name: string;
//   age: string;
//   gender: string;
//   email: string;
// }

// const Register: React.FC = () => {
//   const navigate = useNavigate();
//   const [formData, setFormData] = useState<FormData>({
//     username: 'justin',
//     password: '7191710r',
//     first_name: 'Justin',
//     last_name: 'Kadirov',
//     age: '23',
//     gender: 'Male',
//     email: 'raxmon1710@gmail.com',
//   });

//   const handleSubmit = (e: FormEvent) => {
//     e.preventDefault();

//     axiosInstance
//       .post('api/users/', formData)
//       .then((response) => {
//         console.log(response, 'Registration response');
//         // User registration was successful, get the tokens
//         axiosInstance
//           .post('api/users/token/get/', {
//             username: formData.username,
//             password: formData.password,
//           })
//           .then((response) => {
//             console.log('Success getting tokens:', response.data);
//             // Save the tokens in the local storage
//             localStorage.setItem('access_token', response.data.access);
//             localStorage.setItem('refresh_token', response.data.refresh);
//             navigate('/');
//           })
//           .catch((error) => {
//             console.error('Error getting tokens:', error);
//           });
//       })
//       .catch((error) => {
//         alert(error.response.data.detail);
//       });
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-4">
//       <input
//         type="text"
//         name="username"
//         value={formData.username}
//         onChange={handleChange}
//         className="block w-full p-2 border border-gray-300 rounded"
//         placeholder="Username"
//       />
//       <input
//         type="password"
//         name="password"
//         value={formData.password}
//         onChange={handleChange}
//         className="block w-full p-2 border border-gray-300 rounded"
//         placeholder="Password"
//       />
//       <input
//         type="text"
//         name="first_name"
//         value={formData.first_name}
//         onChange={handleChange}
//         className="block w-full p-2 border border-gray-300 rounded"
//         placeholder="First Name"
//       />
//       <input
//         type="text"
//         name="last_name"
//         value={formData.last_name}
//         onChange={handleChange}
//         className="block w-full p-2 border border-gray-300 rounded"
//         placeholder="Last Name"
//       />
//       <input
//         type="number"
//         name="age"
//         value={formData.age}
//         onChange={handleChange}
//         className="block w-full p-2 border border-gray-300 rounded"
//         placeholder="Age"
//       />
//       <select
//         name="gender"
//         value={formData.gender}
//         onChange={handleChange}
//         className="block w-full p-2 border border-gray-300 rounded"
//       >
//         <option value="">Select Gender</option>
//         <option value="Male">Male</option>
//         <option value="Female">Female</option>
//       </select>
//       <input
//         type="email"
//         name="email"
//         value={formData.email}
//         onChange={handleChange}
//         className="block w-full p-2 border border-gray-300 rounded"
//         placeholder="Email"
//       />
//       <button
//         type="submit"
//         className="block w-full p-2 bg-blue-500 text-white rounded"
//       >
//         Submit
//       </button>
//     </form>
//   );
// };

// export default Register;
