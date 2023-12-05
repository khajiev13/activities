'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChangeEvent, FormEvent, useState, useContext } from 'react';
import axiosInstance from '../axios';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AlertDestructive from '@/components/ui/AlertDestructive';
import { AuthContext } from '@/context/AuthContext';

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

interface FormData {
  username: string;
  password: string;
  confirmPassword: string;
  first_name: string;
  last_name: string;
  date: string;
  gender: string;
  email: string;
}

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    username: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    date: 'mm/dd/yyyy',
    gender: '',
    email: '',
  });

  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const { login } = useContext(AuthContext);
  //I couldn't do it with handle change so I would write this function instead
  const handleSelect = (name: string, value: string) => {
    setFormData((prevState) => ({
      ...prevState,
      [name]: value.trim(),
    }));
  };
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prevState) => ({
      ...prevState,
      [e.target.name]: e.target.value.trim(),
    }));
  };
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log(formData, 'Form data');
    setTimeout(() => {
      setIsLoading(false);
      if (!alertMessage) {
        setAlertMessage(
          "Couldn't sign up. Please double check your information"
        );
      }
    }, 6000);
    if (formData.password !== formData.confirmPassword) {
      setAlertMessage('Passwords do not match');
      return;
    }
    axiosInstance
      .post('api/users/', formData)
      .then((response) => {
        console.log(response, 'Registration response');
        // User registration was successful, get the tokens
        axiosInstance
          .post('api/users/token/get/', {
            username: formData.username,
            password: formData.password,
          })
          .then((response) => {
            console.log('Success getting tokens:', response.data);
            // Save the tokens in the local storage
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);
            console.log(
              response.data.first_name,
              response.data.last_name,
              response.data.username
            );
            login(
              response.data.first_name,
              response.data.last_name,
              response.data.username
            );
            navigate('/');
          })
          .catch((error) => {
            if (axios.isAxiosError(error)) {
              if (error.response) {
                setAlertMessage(error.response.data.message);
              } else {
                setAlertMessage('An unknown error occurred.');
              }
            }
          });
      })
      .catch((error) => {
        if (axios.isAxiosError(error)) {
          console.error('Error getting tokens:', error);
          if (error.response) {
            setAlertMessage(error.response.data.message);
          } else {
            setAlertMessage('An unknown error occurred.');
          }
        }
      });
  };

  return (
    <div className={cn('grid gap-6', className)} {...props}>
      <form onSubmit={handleSubmit}>
        <div className="grid gap-2">
          <div className="combine flex gap-8">
            <div className="grid gap-1">
              <Label className="sr-only" htmlFor="firstName">
                First Name
              </Label>
              <Input
                id="firstName"
                name="first_name"
                placeholder="First Name"
                type="text"
                autoCapitalize="words"
                autoComplete="given-name"
                autoCorrect="off"
                disabled={isLoading}
                value={formData.first_name}
                onChange={handleChange}
              />
            </div>
            <div className="grid gap-1">
              <Label className="sr-only" htmlFor="lastName">
                Last Name
              </Label>
              <Input
                id="lastName"
                placeholder="Last Name"
                type="text"
                autoCapitalize="words"
                autoComplete="family-name"
                autoCorrect="off"
                disabled={isLoading}
                value={formData.last_name}
                name="last_name"
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              value={formData.email}
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              onChange={handleChange}
            />
          </div>
          <div className="username">
            <Label className="sr-only" htmlFor="username">
              Username
            </Label>
            <Input
              id="username"
              placeholder="Username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>
          <div className="combine flex gap-8">
            <div className="date-picker">
              <Label className="sr-only" htmlFor="date">
                Date
              </Label>
              <Input
                id="date"
                placeholder="Date"
                type="date"
                name="date"
                value={formData.date}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                disabled={isLoading}
                onChange={handleChange}
                className="dark:bg-dark-foreground dark:text-dark-background"
              />
            </div>
            <div className="gender">
              <Select
                value={formData.gender}
                name="gender"
                onValueChange={(value) => handleSelect('gender', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Gender</SelectLabel>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Male">Male</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="passwords">
            <Label className="sr-only" htmlFor="password">
              Password
            </Label>
            <Input
              id="password"
              placeholder="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>
          <div className="confirm-password">
            <Label className="sr-only" htmlFor="confirmPassword">
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              placeholder="Confirm Password"
              type="password"
              name="confirmPassword"
              onChange={handleChange}
              disabled={isLoading}
            />
          </div>
          {alertMessage ? (
            <AlertDestructive
              title="Error while signing up"
              description={alertMessage || ''}
            />
          ) : null}
          <Button
            className="bg-maincolor hover:bg-orange-700"
            disabled={isLoading}
            type="submit"
          >
            {isLoading && (
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            )}
            Sign Up
          </Button>
        </div>
      </form>
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
      <Button variant="outline" type="button" disabled={isLoading}>
        {isLoading ? (
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icons.google className="mr-2 h-4 w-4" />
        )}{' '}
        Google
      </Button>
    </div>
  );
}
