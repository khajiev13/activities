import { ThemeProvider } from '@/components/theme-provider';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login/Login';
import HomePage from './pages/HomePage/HomePage';
import Register from '../src/pages/Register/Register';
import { AppShell } from './components/layout/AppShell';
import { AuthProvider } from './auth/AuthContext';
import Activities from './pages/Activities/Activities';
import Teams from './pages/Teams/Teams';
import { Toaster } from './components/ui/sonner';
import RenderMap from './components/Map/RenderMap';
import Organizations from './pages/OrganizationsPage/Organizations';
import { ActivitiesDetail } from './pages/Activities/ActivitiesDetail';
import TeamDetails from './pages/Teams/TeamDetails';

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        <Router>
          <AppShell>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/activities" element={<Activities />} />
              <Route
                path="/activities/:activity_pk"
                element={<ActivitiesDetail />}
              />
              <Route path="/teams" element={<Teams />} />
              <Route path="/teams/:team_name" element={<TeamDetails />} />
              <Route path="/organizations" element={<Organizations />} />
              <Route path="/map" element={<RenderMap />} />
              <Route path="/" element={<HomePage />} />
            </Routes>
          </AppShell>
          {/* We need this to show the toast notifications */}
          <Toaster />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
