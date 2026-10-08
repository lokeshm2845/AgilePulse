import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Register from './components/Register';
import KanbanBoard from './components/KanbanBoard';
import Backlog from './components/Backlog';
import SprintManager from './components/SprintManager';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/board" element={<KanbanBoard />} />
        <Route path="/backlog" element={<Backlog />} />
        <Route path="/sprints" element={<SprintManager />} />
      </Route>

      <Route path="*" element={<Navigate to="/board" replace />} />
    </Routes>
  );
}
