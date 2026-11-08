import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AlertDestructive from '@/components/ui/AlertDestructive';
import { AuthContext } from '@/auth/AuthContext';
import { isInTelegram, requestOtp } from '@/api/authApi';
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

  const returned = useRef(false);
  const returnState = location.state?.returnState;
  const returnHistoryIndex = location.state?.returnHistoryIndex;
  useEffect(() => {
    if (status !== 'authenticated' || returned.current) return;
    returned.current = true;
    const currentIndex = window.history.state?.idx;
    if (returnTo === from && Number.isInteger(returnHistoryIndex) && returnHistoryIndex >= 0 && typeof currentIndex === 'number' && currentIndex > returnHistoryIndex) {
      navigate(returnHistoryIndex - currentIndex);
    } else navigate(returnTo, { replace: true, state: returnState });
  }, [status, navigate, returnTo, from, returnHistoryIndex, returnState]);

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
      await login(phone, code);
    } catch {
      setCode('');
      setError('Invalid or expired code. Please try again or request a new code.');
    } finally {
      setBusy(false);
    }
  };

  if (isInTelegram()) return <TelegramLoginForm />;

  return (
    <form onSubmit={submit}>
      <Card className="border bg-card rounded-2xl">
        <CardHeader className="space-y-2 p-4 sm:p-6">
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>{codeStep ? `Enter the code for ${formatUzPhone(phone)}` : 'Enter your phone number to receive a code in Telegram.'}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 pt-0 sm:p-6 sm:pt-0">
          {codeStep ? <>
            <Label htmlFor="code">6-digit code</Label>
            <Input className="min-h-12 text-base" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            <p className="text-sm text-muted-foreground">If this number is registered, we sent a code to your Telegram. Not registered or no message? Open <a className="underline" href="https://t.me/eventopiarobot" target="_blank" rel="noreferrer">@eventopiarobot</a> and press Start.</p>
            <Button type="button" variant="outline" className="min-h-12 text-base" disabled={busy || remaining > 0} onClick={sendCode}>{remaining > 0 ? `Resend in ${remaining}s` : 'Resend'}</Button>
            <Button type="button" variant="ghost" className="min-h-12 text-base" disabled={busy} onClick={() => { setCodeStep(false); setCode(''); setError(null); }}>Change phone number</Button>
          </> : <>
            <Label htmlFor="phone">Phone number</Label>
            <Input className="min-h-12 text-base" id="phone" name="phone" disabled={busy} type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={event => setPhone(event.target.value)} />
          </>}
          {error && <AlertDestructive title="Unable to log in" description={error} />}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 p-4 pt-0 sm:p-6 sm:pt-0">
          <Button type="submit" className="min-h-12 w-full text-base" disabled={busy || status === 'loading' || (!codeStep && remaining > 0)}>{busy ? 'Please wait…' : codeStep ? 'Login' : remaining > 0 ? `Request code in ${remaining}s` : 'Send code'}</Button>
          <p className="text-sm">Not a member yet? <Link className="underline" to="/register" state={location.state}>Sign up in Telegram</Link></p>
        </CardFooter>
      </Card>
    </form>
  );
}

function TelegramLoginForm() {
  const { status, telegramIssue, retryTelegramLogin, shareTelegramContact } = useContext(AuthContext);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [contactShared, setContactShared] = useState(false);

  const retry = async () => {
    setBusy(true);
    setMessage(null);
    try { await retryTelegramLogin(); }
    finally { setBusy(false); }
  };
  const share = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await shareTelegramContact();
      if (result === 'cancelled') setMessage('Contact sharing was cancelled. You can try again when you are ready.');
      if (result === 'pending') {
        setContactShared(true);
        setMessage('Your contact is still being saved. Please try again in a moment.');
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Unable to share your contact. Please try again.');
    } finally { setBusy(false); }
  };

  const loading = busy || status === 'loading';
  return <Card className="border bg-card rounded-2xl">
    <CardHeader className="space-y-2 p-4 sm:p-6">
      <CardTitle className="text-2xl">Login with Telegram</CardTitle>
      <CardDescription>{telegramIssue === 'phone_required'
        ? 'Share your phone number with @eventopiarobot to finish signing in. Telegram will ask for your permission.'
        : telegramIssue === 'expired'
          ? 'Close this app and reopen it from @eventopiarobot in Telegram to renew your session.'
          : loading ? 'Signing in with Telegram…' : telegramIssue === 'network' ? 'Unable to connect. Check your connection and try again.' : 'Sign in securely with your Telegram account.'}</CardDescription>
    </CardHeader>
    {message && <CardContent><AlertDestructive title="Telegram login" description={message} /></CardContent>}
    <CardFooter className="flex flex-col gap-3 p-4 pt-0 sm:p-6 sm:pt-0">
      {telegramIssue === 'phone_required' && !contactShared && <Button className="min-h-12 w-full text-base" disabled={loading} onClick={share}>Share phone number</Button>}
      {(telegramIssue === 'network' || contactShared || (telegramIssue === null && status === 'anonymous')) && telegramIssue !== 'expired' && <Button className="min-h-12 w-full text-base" disabled={loading} onClick={retry}>Try again</Button>}
      {loading && <p role="status">Please wait…</p>}
      <a className="text-sm underline" href="https://t.me/eventopiarobot" target="_blank" rel="noreferrer">Open @eventopiarobot</a>
    </CardFooter>
  </Card>;
}
