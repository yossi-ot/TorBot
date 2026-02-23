import { Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Appointments from './pages/Appointments';
import Services from './pages/Services';
import WorkingHours from './pages/WorkingHours';
import Stats from './pages/Stats';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Appointments />} />
        <Route path="services" element={<Services />} />
        <Route path="working-hours" element={<WorkingHours />} />
        <Route path="stats" element={<Stats />} />
      </Route>
    </Routes>
  );
}
