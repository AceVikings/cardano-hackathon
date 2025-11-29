import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MeshProvider } from '@meshsdk/react';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import './App.css';

function App() {
  return (
    <MeshProvider>
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen bg-cosmic-black">
            <Navbar />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </div>
        </AuthProvider>
      </BrowserRouter>
    </MeshProvider>
  );
}

export default App;
