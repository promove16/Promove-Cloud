import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import ProtectedRoute from './ProtectedRoute';
import Login from '../pages/Login';
import Register from '../pages/Register';
import VerifyEmail from '../pages/VerifyEmail';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import Forbidden from '../pages/Forbidden';
import NotFound from '../pages/NotFound';
import StudentDashboard from '../pages/dashboards/StudentDashboard';
import SchoolDashboard from '../pages/dashboards/SchoolDashboard';
import CollegeDashboard from '../pages/dashboards/CollegeDashboard';
import InvestorDashboard from '../pages/dashboards/InvestorDashboard';
import MentorDashboard from '../pages/dashboards/MentorDashboard';
import HRDashboard from '../pages/dashboards/HRDashboard';
import AdminDashboard from '../pages/dashboards/AdminDashboard';

function DashboardDispatch() {
  const { user } = useAuth();

  const DASHBOARD_MAP = {
    student: <StudentDashboard />,
    school: <SchoolDashboard />,
    college: <CollegeDashboard />,
    investor: <InvestorDashboard />,
    mentor: <MentorDashboard />,
    hr: <HRDashboard />,
    superadmin: <AdminDashboard />,
  };

  return DASHBOARD_MAP[user?.role] ?? <NotFound />;
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/verify-email', element: <VerifyEmail /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: <DashboardDispatch /> },
    ],
  },
  { path: '/403', element: <Forbidden /> },
  { path: '*', element: <NotFound /> },
]);

export default router;
