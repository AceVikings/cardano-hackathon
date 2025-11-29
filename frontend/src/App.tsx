import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MeshProvider } from '@meshsdk/react';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import './App.css';

function App() {
  return (
    <MeshProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-cosmic-black">
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </MeshProvider>
  );
}

export default App;
