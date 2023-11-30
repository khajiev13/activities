import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function LoginButton() {
  const navigate = useNavigate();
  return (
    <Button onClick={() => navigate('login/')} variant="ghost">
      Login
    </Button>
  );
}
