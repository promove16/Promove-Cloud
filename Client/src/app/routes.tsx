import { createBrowserRouter, Navigate } from "react-router-dom";
import { Homepage } from "./pages/Homepage";
import { Dashboard } from "./pages/Dashboard";
import { ProblemBank } from "./pages/ProblemBank";
import { LeadershipProfile } from "./pages/LeadershipProfile";
import { ProductWorkspace } from "./pages/ProductWorkspace";
import { PatentSupport } from "./pages/PatentSupport";
import { StartupLaunch } from "./pages/StartupLaunch";
import { Marketplace } from "./pages/Marketplace";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Homepage,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/student",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/school",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/college",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/mentor",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/investor",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/recruiter",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/problem-bank",
    element: (
      <ProtectedRoute>
        <ProblemBank />
      </ProtectedRoute>
    ),
  },
  {
    path: "/leadership-profile",
    element: (
      <ProtectedRoute>
        <LeadershipProfile />
      </ProtectedRoute>
    ),
  },
  {
    path: "/product-workspace/:projectId?",
    element: (
      <ProtectedRoute>
        <ProductWorkspace />
      </ProtectedRoute>
    ),
  },
  {
    path: "/patent-support/:innovationId?",
    element: (
      <ProtectedRoute>
        <PatentSupport />
      </ProtectedRoute>
    ),
  },
  {
    path: "/startup-launch/:startupId?",
    element: (
      <ProtectedRoute>
        <StartupLaunch />
      </ProtectedRoute>
    ),
  },
  {
    path: "/marketplace",
    element: (
      <ProtectedRoute>
        <Marketplace />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
