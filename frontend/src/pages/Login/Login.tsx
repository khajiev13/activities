import { LoginForm } from '@/components/LoginPage/LoginForm';

export default function Login() {
  return <div className="mx-auto flex w-full max-w-md flex-col justify-center py-4 sm:py-10">
    <p className="mb-5 text-base text-muted-foreground">Join local activities and teams with your Eventopia account.</p>
    <LoginForm />
  </div>;
}
