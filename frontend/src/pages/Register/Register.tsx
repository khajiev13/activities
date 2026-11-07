import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Register() {
  return (
    <div className="container min-h-[80vh] flex items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Sign up in Telegram</CardTitle>
          <CardDescription>Open @eventopiarobot, press Start and share your own phone number to create your account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <a className="underline text-maincolor" href="https://t.me/eventopiarobot" target="_blank" rel="noreferrer">Open @eventopiarobot</a>
          <div className="bg-white p-4 rounded-md"><QRCodeSVG value="https://t.me/eventopiarobot" title="Open Eventopia bot in Telegram" size={192} /></div>
          <Link className="underline" to="/login">Already registered? Login</Link>
        </CardContent>
      </Card>
    </div>
  );
}
