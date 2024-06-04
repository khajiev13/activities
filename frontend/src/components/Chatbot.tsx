import { Button } from '@/components/ui/button';
import { useState } from 'react';
import axiosInstance from '../axios';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Card } from './ui/card';

export function Chatbot() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');

  const sendMessage = () => {
    setLoading(true);

    axiosInstance
      .post('/api/chatbot/', { message })
      .then((response) => {
        setReply(response.data.reply);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  };
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="" variant="outline">
          Eventobot
        </Button>
      </SheetTrigger>
      <SheetContent className="">
        <SheetHeader>
          <SheetTitle>Chatbot Section</SheetTitle>
          <SheetDescription>
            You can talk to Eventobot here and questions
          </SheetDescription>
        </SheetHeader>
        {reply && <Card className="p-4 mb-4">{reply}</Card>}

        <SheetFooter>
          <div className="grid w-full gap-2">
            <Textarea
              placeholder="Type your message here."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
            />{' '}
            <Button onClick={sendMessage} disabled={loading}>
              Send message
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
