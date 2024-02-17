import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';
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

export function Chatbot() {
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
            Create Chatbot UI on this component and let the user talk to the
            chatbot. Chatbot can also control the pages
          </SheetDescription>
        </SheetHeader>
        Display text messages here in a window
        <SheetFooter>
          <div className="grid w-full gap-2">
            <Textarea placeholder="Type your message here." />
            <Button>Send message</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
