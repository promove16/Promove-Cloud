import { Navigate, Outlet, createBrowserRouter } from 'react-router-dom';
import { AuthLayout } from '../components/layouts/AuthLayout';
import { DashboardLayout } from '../components/layouts/DashboardLayout';
import { Card } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { LoginPage } from '../features/auth/LoginPage';
import { SignupPage } from '../features/auth/SignupPage';
import { AuthBootstrap } from '../features/auth/useAuth';
import { useProtectedRoute } from '../hooks/useProtectedRoute';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../types/roles.types';
import { roleRedirect } from '../utils/roleRedirect';

function RootLayout() {
  return (
    <AuthBootstrap>
      <Outlet />
    </AuthBootstrap>
  );
}

function PublicOnlyRoute() {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Spinner />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to={roleRedirect(user.role)} replace />;
  }

  return <Outlet />;
}

function ProtectedDashboard({ role }: { role: UserRole }) {
  const route = useProtectedRoute([role]);

  if (route.status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (route.status !== 'authorized') {
    return <Navigate to={route.redirectTo} replace />;
  }

  return <Outlet />;
}

function DashboardPlaceholder({ role }: { role: UserRole }) {
  return (
    <Card className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold text-white capitalize">{role} Dashboard</h1>
      <p className="mt-3 text-slate-400">
        Phase 1 keeps this dashboard as a protected placeholder shell so auth and role gating are
        ready before feature modules land.
      </p>
    </Card>
  );
}

function AuthRedirect() {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Spinner />
      </div>
    );
  }

  return <Navigate to={isAuthenticated && user ? roleRedirect(user.role) : '/login'} replace />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <AuthRedirect />,
      },
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: '/login', element: <LoginPage /> },
              { path: '/signup', element: <SignupPage /> },
            ],
          },
        ],
      },
      {
        path: '/dashboard',
        element: <DashboardLayout />,
        children: [
          {
            path: 'student',
            element: <ProtectedDashboard role={UserRole.STUDENT} />,
            children: [{ index: true, element: <DashboardPlaceholder role={UserRole.STUDENT} /> }],
          },
          {
            path: 'school',
            element: <ProtectedDashboard role={UserRole.SCHOOL} />,
            children: [{ index: true, element: <DashboardPlaceholder role={UserRole.SCHOOL} /> }],
          },
          {
            path: 'college',
            element: <ProtectedDashboard role={UserRole.COLLEGE} />,
            children: [{ index: true, element: <DashboardPlaceholder role={UserRole.COLLEGE} /> }],
          },
          {
            path: 'mentor',
            element: <ProtectedDashboard role={UserRole.MENTOR} />,
            children: [{ index: true, element: <DashboardPlaceholder role={UserRole.MENTOR} /> }],
          },
          {
            path: 'investor',
            element: <ProtectedDashboard role={UserRole.INVESTOR} />,
            children: [{ index: true, element: <DashboardPlaceholder role={UserRole.INVESTOR} /> }],
          },
          {
            path: 'recruiter',
            element: <ProtectedDashboard role={UserRole.RECRUITER} />,
            children: [{ index: true, element: <DashboardPlaceholder role={UserRole.RECRUITER} /> }],
          },
          {
            path: 'admin',
            element: <ProtectedDashboard role={UserRole.ADMIN} />,
            children: [{ index: true, element: <DashboardPlaceholder role={UserRole.ADMIN} /> }],
          },
        ],
      },
      {
        path: '*',
        element: <AuthRedirect />,
      },
    ],
  },
]);
