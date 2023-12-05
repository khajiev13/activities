'use client';
import { useState, useContext } from 'react';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import axiosInstance from '@/axios';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import Link from 'next/link';
import AlertDestructive from '@/components/ui/AlertDestructive';
import { AuthContext } from '@/context/AuthContext';
import axios from 'axios';

interface FormData {
  username: string;
  password: string;
}

export function LoginForm() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formData, setFormData] = useState<FormData>({
    username: '',
    password: '',
  });
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    try {
      event.preventDefault();
      setIsLoading(true);
      const credentials = await axiosInstance.post('api/users/token/get/', {
        username: formData.username,
        password: formData.password,
      });
      localStorage.setItem('access_token', credentials.data.access);
      localStorage.setItem('refresh_token', credentials.data.refresh);

      // Call the login function with the user data from the server response
      login(
        credentials.data.first_name,
        credentials.data.last_name,
        credentials.data.username
      );

      // Set the Authorization header with the new access token
      axiosInstance.defaults.headers['Authorization'] =
        'Bearer ' + credentials.data.access;

      navigate('/');
      console.log();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error getting tokens:', error);
        if (error.response) {
          setAlertMessage(error.response.data.detail);
          if (!alertMessage) {
            setAlertMessage('Please provide username and password!.');
          }
        } else {
          setAlertMessage('An unknown error occurred.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <form onSubmit={(event) => handleSubmit(event)}>
      <Card className="dark:bg-black border-none">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Login throgh your GitHub or Google account
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-6">
            <Button variant="outline">
              <Icons.gitHub className="mr-2 h-4 w-4" />
              Github
            </Button>
            <Button variant="outline">
              <Icons.google className="mr-2 h-4 w-4" />
              Google
            </Button>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid gap-2 relative">
            <Label htmlFor="email">Email</Label>
            <Input
              type="text"
              name="username"
              id="username"
              placeholder="Enter your email or username"
              className=" pl-12"
              onChange={handleInputChange}
            />
            <svg
              width="30"
              height="30"
              viewBox="0 0 30 30"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute top-7 left-2 "
            >
              <path
                d="M15 3C11.686 3 8.99998 5.686 8.99998 9V10C8.99998 13.314 11.686 16 15 16C18.314 16 21 13.314 21 10V9C21 5.686 18.314 3 15 3ZM14.998 19C10.992 19 5.85203 21.1668 4.37303 23.0898C3.45903 24.2788 4.32911 26 5.82811 26H24.1699C25.6689 26 26.539 24.2788 25.625 23.0898C24.146 21.1678 19.004 19 14.998 19Z"
                fill="#E0643C"
              />
            </svg>
          </div>
          <div className="grid gap-2 relative">
            <Label htmlFor="password">Password</Label>

            <Input
              type={showPassword ? 'text' : 'password'}
              name="password"
              id="password"
              placeholder="Enter your password"
              className="pl-12"
              onChange={handleInputChange}
            />
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute top-7 left-3 "
            >
              <path
                d="M12 1C8.67619 1 6 3.67619 6 7V8C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8V7C18 3.67619 15.3238 1 12 1ZM12 3C14.2762 3 16 4.72381 16 7V8H8V7C8 4.72381 9.72381 3 12 3ZM12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13Z"
                fill="#E0643C"
              />
            </svg>
            <button
              type="button"
              className="absolute right-6 top-8"
              onClick={(event) => {
                event.preventDefault();
                setShowPassword(!showPassword);
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.20703 2.79297L2.79297 4.20703L5.07617 6.49023C2.19934 8.8382 1 12 1 12C1 12 4 20 12 20C14.0756 20 15.806 19.4547 17.2422 18.6562L19.793 21.207L21.207 19.793L4.20703 2.79297ZM12 4C10.788 4 9.7058 4.19972 8.7168 4.51172L11.2773 7.07227C11.5143 7.03727 11.753 7 12 7C14.761 7 17 9.239 17 12C17 12.247 16.9627 12.4857 16.9277 12.7227L20.3574 16.1523C22.2044 14.1023 23 12 23 12C23 12 20 4 12 4ZM7.83398 9.24805L9.29688 10.7109C9.10816 11.1008 9 11.5366 9 12C9 13.657 10.343 15 12 15C12.4634 15 12.8992 14.8918 13.2891 14.7031L14.752 16.166C13.962 16.6898 13.0193 17 12 17C9.239 17 7 14.761 7 12C7 10.9807 7.31024 10.038 7.83398 9.24805Z"
                  fill="rgba(224, 100, 60, 1)"
                />
              </svg>
            </button>
          </div>
          <div className="flex flex-row justify-start items-center pl-1 text-foreground">
            <input
              type="checkbox"
              name="remember"
              id="remember"
              className="mr-3 ml-3 w-[18px] h-[18px] accent-maincolor "
            />
            <label
              htmlFor="remember"
              className=" text-xs font-normal font-['Inter'] "
            >
              Remember me!
            </label>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {alertMessage ? (
            <AlertDestructive
              title="Error while logging in"
              description={alertMessage || ''}
            />
          ) : null}
          {isLoading ? (
            <Button disabled className="w-full bg-maincolor text-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-foreground" />
              Please wait
            </Button>
          ) : (
            <Button
              type="submit"
              className="w-full bg-maincolor hover:bg-orange-700"
            >
              Login
            </Button>
          )}
          <div className="flex items-center gap-5">
            <p>Not a member yet?</p>
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: 'ghost' }))}
            >
              Register
            </Link>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}

{
  /* <div className="[font-family:'Murecho-Bold',Helvetica] font-bold text-[#282828] text-[32px] tracking-[0] leading-[normal] mt-12">
          Log in.
        </div>

        <p className="mt-2 [font-family:'Murecho-Regular',Helvetica] font-normal text-[#d9d9d9] text-[16px] tracking-[0] leading-[20px]">
          Log in with your data that you entered
          <br />
          during your registration
        </p>

        <form action="" method="post" className="mt-9">
          <div
            className="username-input bg-white rounded-[5px] border-0.5 border-neutral-600 w-full
            h-[54px] flex flex-row justify-center items-center relative"
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 30 30"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-2 "
            >
              <path
                d="M15 3C11.686 3 8.99998 5.686 8.99998 9V10C8.99998 13.314 11.686 16 15 16C18.314 16 21 13.314 21 10V9C21 5.686 18.314 3 15 3ZM14.998 19C10.992 19 5.85203 21.1668 4.37303 23.0898C3.45903 24.2788 4.32911 26 5.82811 26H24.1699C25.6689 26 26.539 24.2788 25.625 23.0898C24.146 21.1678 19.004 19 14.998 19Z"
                fill="#E0643C"
              />
            </svg>

            <input
              type="text"
              name="username"
              id="username"
              placeholder="Enter your email or username"
              className="border-none h-full w-full rounded-[5px] pl-10"
              onChange={handleInputChange}
            />
          </div>
          <div className="password-input bg-white bg-opacity-5 rounded-[5px] border-0.5  border-neutral-600 w-full h-[54px] flex flex-row justify-center items-center relative mt-5">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute left-2"
            >
              <path
                d="M12 1C8.67619 1 6 3.67619 6 7V8C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8V7C18 3.67619 15.3238 1 12 1ZM12 3C14.2762 3 16 4.72381 16 7V8H8V7C8 4.72381 9.72381 3 12 3ZM12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13Z"
                fill="#E0643C"
              />
            </svg>

            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              id="password"
              placeholder="Enter your password"
              className="border-none h-full w-full rounded-[5px] pl-10"
              onChange={handleInputChange}
            />
            <button
              type="button"
              className="absolute right-6"
              onClick={(event) => {
                event.preventDefault();
                setShowPassword(!showPassword);
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.20703 2.79297L2.79297 4.20703L5.07617 6.49023C2.19934 8.8382 1 12 1 12C1 12 4 20 12 20C14.0756 20 15.806 19.4547 17.2422 18.6562L19.793 21.207L21.207 19.793L4.20703 2.79297ZM12 4C10.788 4 9.7058 4.19972 8.7168 4.51172L11.2773 7.07227C11.5143 7.03727 11.753 7 12 7C14.761 7 17 9.239 17 12C17 12.247 16.9627 12.4857 16.9277 12.7227L20.3574 16.1523C22.2044 14.1023 23 12 23 12C23 12 20 4 12 4ZM7.83398 9.24805L9.29688 10.7109C9.10816 11.1008 9 11.5366 9 12C9 13.657 10.343 15 12 15C12.4634 15 12.8992 14.8918 13.2891 14.7031L14.752 16.166C13.962 16.6898 13.0193 17 12 17C9.239 17 7 14.761 7 12C7 10.9807 7.31024 10.038 7.83398 9.24805Z"
                  fill="#D9D9D9"
                />
              </svg>
            </button>
          </div>
          <div className="bg-white w-full h-[54px] flex flex-row justify-center items-center relative ">
            {/* CHecklist and forgot password button */
}

//   <button
//     type="submit"
//     className="active:scale-[.98] active:duration-75 hover:scale-[1.02] ease-in-out transtition-all bg-maincolor w-full h-[54px] rounded-3xl mt-6 text-[#ffff]"
//     onClick={(event) => {
//       event.preventDefault();
//       handleSubmit(event);
//     }}
//   >
//     Login
//   </button>
// </form> */}
