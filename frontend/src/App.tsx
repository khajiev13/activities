import { ThemeProvider } from '@/components/theme-provider';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login/Login';
import HomePage from './pages/HomePage/HomePage';
import Register from '../src/pages/Register/Register';
import Navbar from './components/Navbar';
import { AuthProvider } from './context/AuthContext';
import Activities from './pages/Activities/Activities';
import Teams from './pages/Teams/Teams';
import CornerButtons from './components/CornerButtons';
import { Toaster } from './components/ui/sonner';
import RenderMap from './components/Map/RenderMap';
import Organizations from './pages/OrganizationsPage/Organizations';
import { HeroHighlight } from './components/ui/hero-highlight';
import { ActivitiesDetail } from './pages/Activities/ActivitiesDetail';
import TeamDetails from './pages/Teams/TeamDetails';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <HeroHighlight
        containerClassName="p-0 m-0 fixed top-0 left-0 min-h-full"
        className="p-0 m-0 top-0 fixed"
      >
        {' '}
        <AuthProvider>
          <Router>
            <Navbar />
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
            <CornerButtons />
            {/* We need this to show the toast notifications */}
            <Toaster />
          </Router>
        </AuthProvider>
      </HeroHighlight>
    </ThemeProvider>
  );
}

export default App;
