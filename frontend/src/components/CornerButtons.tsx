import React from 'react';
import { Create } from '@/components/Drawer';
import { RequireAuth } from '@/auth/RequireAuth';
import { useLocation } from 'react-router-dom';
const CornerButtons: React.FC = () => {
  const location = useLocation();
  return (
    <div className="fixed right-4 bottom-4 flex flex-col gap-4 z-50">
      {[
        '/activities',
        '/teams',
        '/organizations',
        '/activities/',
        '/teams/',
        '/organizations/',
      ].includes(location.pathname) && <RequireAuth action="Create"><Create /></RequireAuth>}

    </div>
  );
};

export default CornerButtons;
