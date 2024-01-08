import { ThemeProvider } from '@/components/theme-provider';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login/Login';
import HomePage from './pages/HomePage/HomePage';
import Register from '../src/pages/Register/Register';
import Navbar from './components/Navbar';
import { Chatbot } from './components/Chatbot';
import { AuthProvider } from './context/AuthContext';
import Activities from './pages/Activities/Activities';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <Router>
          <Navbar />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/" element={<HomePage />} />
          </Routes>
          <Chatbot />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
