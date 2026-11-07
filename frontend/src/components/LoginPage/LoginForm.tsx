import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AlertDestructive from '@/components/ui/AlertDestructive';
import { AuthContext } from '@/auth/AuthContext';
import { requestOtp } from '@/api/authApi';
import { formatUzPhone } from '@/auth/phone';

export function LoginForm() {
  const [phone, setPhone] = useState('+998');
  const [code, setCode] = useState('');
  const [codeStep, setCodeStep] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, status } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const returnTo = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') ? from : '/';

  useEffect(() => {
    if (status === 'authenticated') navigate(returnTo, { replace: true });
  }, [status, navigate, returnTo]);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestOtp(phone);
      setRetryAt(Date.now() + result.retry_after_seconds * 1000);
      setCode('');
      setCodeStep(true);
    } catch (cause) {
      if (axios.isAxiosError(cause) && cause.response?.data?.error === 202) {
        setRetryAt(Date.now() + (cause.response.data.retry_after ?? 60) * 1000);
        setError('Please wait before requesting another code.');
      } else {
        setError('Unable to request a code. Check your phone number and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!codeStep) { await sendCode(); return; }
    setBusy(true);
    setError(null);
    try {
      if (await login(phone, code)) navigate(returnTo, { replace: true });
    } catch {
      setCode('');
      setError('Invalid or expired code. Please try again or request a new code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Card className="dark:bg-black border-none">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>{codeStep ? `Enter the code for ${formatUzPhone(phone)}` : 'Enter your phone number to receive a code in Telegram.'}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {codeStep ? <>
            <Label htmlFor="code">6-digit code</Label>
            <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            <p className="text-sm text-muted-foreground">If this number is registered, we sent a code to your Telegram. Not registered or no message? Open <a className="underline" href="https://t.me/eventopiarobot" target="_blank" rel="noreferrer">@eventopiarobot</a> and press Start.</p>
            <Button type="button" variant="outline" disabled={busy || remaining > 0} onClick={sendCode}>{remaining > 0 ? `Resend in ${remaining}s` : 'Resend'}</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => { setCodeStep(false); setCode(''); setError(null); }}>Change phone number</Button>
          </> : <>
            <Label htmlFor="phone">Phone number</Label>
            <Input id="phone" name="phone" disabled={busy} type="tel" inputMode="tel" autoComplete="tel" pattern="\+998[0-9]{9}" required value={phone} onChange={event => setPhone(event.target.value)} />
          </>}
          {error && <AlertDestructive title="Unable to log in" description={error} />}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full bg-maincolor hover:bg-orange-700" disabled={busy || status === 'loading' || (!codeStep && remaining > 0)}>{busy ? 'Please wait…' : codeStep ? 'Login' : remaining > 0 ? `Request code in ${remaining}s` : 'Send code'}</Button>
          <p className="text-sm">Not a member yet? <Link className="underline" to="/register">Sign up in Telegram</Link></p>
        </CardFooter>
      </Card>
    </form>
  );
}
