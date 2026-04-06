import { PropsWithChildren } from "react";
import { RequestAccessPage } from "../features/auth/RequestAccessPage";
import { ChangePasswordPage } from "../features/auth/ChangePasswordPage";
import { TermsAcceptanceGate } from "../features/auth/TermsAcceptanceGate";
import {
  Link,
  Navigate,
  Outlet,
  createBrowserRouter,
  isRouteErrorResponse,
  useRouteError,
} from "react-router-dom";
import { AuthLayout } from "../components/layouts/AuthLayout";
import { DashboardLayout } from "../components/layouts/DashboardLayout";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { LoginPage } from "../features/auth/LoginPage";
import { SignupPage } from "../features/auth/SignupPage";
import SchoolDashboard from "../features/school/Dashboard";
import SchoolStudentLeaderboard from "../features/school/StudentLeaderboard";
import SchoolInvestorDirectory from "../features/school/InvestorDirectory";
import SchoolComplianceReport from "../features/school/ComplianceReport";
import CollegeDashboard from "../features/college/Dashboard";
import CollegeStudentLeaderboard from "../features/college/StudentLeaderboard";
import CollegeInvestorDirectory from "../features/college/InvestorDirectory";
import RecruiterDirectory from "../features/college/RecruiterDirectory";
import PlacementTracker from "../features/college/PlacementTracker";
import EventManager from "../features/college/EventManager";
import CollegeComplianceReport from "../features/college/ComplianceReport";
import MentorDashboard from "../features/mentor/Dashboard";
import MentorStudentFeed from "../features/mentor/StudentFeed";
import MentorSessions from "../features/mentor/Sessions";
import AdminDashboard from "../features/admin/Dashboard";
import AdminUserManagement from "../features/admin/UserManagement";
import AdminPatents from "../features/admin/Patents";
import AdminAwards from "../features/admin/Awards";
import AdminDeals from "../features/admin/Deals";
import AdminDealReview from "../features/admin/DealReview";
import AdminAnalytics from "../features/admin/Analytics";
import RecruiterDashboard from "../features/recruiter/Dashboard";
import RecruiterTalentSearch from "../features/recruiter/TalentSearch";
import RecruiterCollegeConnect from "../features/recruiter/CollegeConnect";
import RecruiterActiveDrives from "../features/recruiter/ActiveDrives";
import RecruiterOnboardingTracker from "../features/recruiter/OnboardingTracker";
import InvestorDashboard from "../features/investor/Dashboard";
import InvestorStartupMarketplace from "../features/investor/StartupMarketplace";
import InvestorInstitutions from "../features/investor/Institutions";
import InvestorPortfolio from "../features/investor/Portfolio";
import StartupCapTable from "../features/startup/CapTable";
import { UserProfilePage } from "../features/profile/UserProfilePage";
import { MentorDirectory } from "../features/institution/MentorDirectory";
import { useProtectedRoute } from "../hooks/useProtectedRoute";
import { useAuthStore } from "../store/authStore";
import { UserRole } from "../types/roles.types";
import { roleRedirect } from "../utils/roleRedirect";
import { StudentDashboard as LegacyStudentDashboard } from "../app/pages/dashboards/StudentDashboard";
import { StudentMentorSessions } from "../app/pages/dashboards/StudentMentorSessions";
import { StudentInvestorDeals } from "../app/pages/dashboards/StudentInvestorDeals";
import { ProblemBank } from "../app/pages/ProblemBank";
import { ProductWorkspace } from "../app/pages/ProductWorkspace";
import { PatentSupport } from "../app/pages/PatentSupport";
import { StartupLaunch } from "../app/pages/StartupLaunch";
import { LeadershipProfile } from "../app/pages/LeadershipProfile";
import { Marketplace } from "../features/student/Marketplace";
import { MessagesPage } from "../app/pages/Messages";
import { RecruiterMessagesPage } from "../app/pages/RecruiterMessages";
import { SettingsPage } from "../features/settings/SettingsPage";

function RootLayout() {
  return (
    <>
      <Outlet />
      <TermsAcceptanceGate />
    </>
  );
}

function RouteErrorPage() {
  const error = useRouteError();
  const title = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "Something went wrong";
  const description = isRouteErrorResponse(error)
    ? typeof error.data === "string"
      ? error.data
      : "The page could not be loaded."
    : error instanceof Error
      ? error.message
      : "An unexpected error interrupted this page.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-2xl p-8">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
          Route Error
        </div>
        <h1 className="mt-4 text-3xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-slate-400">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Go to Login
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            Reload Page
          </button>
        </div>
      </Card>
    </div>
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

function ProtectedRoleRoute({
  role,
  children,
}: PropsWithChildren<{ role: UserRole }>) {
  const route = useProtectedRoute([role]);

  if (route.status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (route.status !== "authorized") {
    return <Navigate to={route.redirectTo} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

function ProtectedAnyRoute({ children }: PropsWithChildren) {
  const route = useProtectedRoute();

  if (route.status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (route.status !== "authorized") {
    return <Navigate to={route.redirectTo} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}


export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate to="/login" replace />,
      },
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: "/login", element: <LoginPage /> },
              { path: "/signup", element: <SignupPage /> },
              {
                path: "/request-access",
                element: <RequestAccessPage />,
              },
            ],
          },
        ],
      },
      {
        path: "/student",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <Navigate to="/dashboard/student" replace />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/mentor",
        element: (
          <ProtectedRoleRoute role={UserRole.MENTOR}>
            <Navigate to="/dashboard/mentor" replace />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/investor",
        element: (
          <ProtectedRoleRoute role={UserRole.INVESTOR}>
            <Navigate to="/dashboard/investor" replace />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/recruiter",
        element: (
          <ProtectedRoleRoute role={UserRole.RECRUITER}>
            <Navigate to="/dashboard/recruiter" replace />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/admin",
        element: (
          <ProtectedRoleRoute role={UserRole.ADMIN}>
            <Navigate to="/dashboard/admin" replace />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/problem-bank",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <ProblemBank />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/product-workspace/:projectId?",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <ProductWorkspace />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/patent-support/:innovationId?",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <PatentSupport />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/startup-launch/:startupId?",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <StartupLaunch />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/startup-launch/cap-table",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <StartupCapTable />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/leadership-profile",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <LeadershipProfile />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/marketplace",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <Marketplace />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/school",
        element: <Navigate to="/dashboard/school" replace />,
      },
      {
        path: "/college",
        element: <Navigate to="/dashboard/college" replace />,
      },
      {
        path: "/dashboard",
        element: (
          <ProtectedAnyRoute>
            <DashboardLayout />
          </ProtectedAnyRoute>
        ),
        children: [
          {
            path: "student",
            element: <ProtectedRoleRoute role={UserRole.STUDENT} />,
            children: [
              { index: true, element: <LegacyStudentDashboard /> },
              { path: "mentor-sessions", element: <StudentMentorSessions /> },
              { path: "investor-deals", element: <StudentInvestorDeals /> },
            ],
          },
          {
            path: "mentor",
            element: <ProtectedRoleRoute role={UserRole.MENTOR} />,
            children: [
              { index: true, element: <MentorDashboard /> },
              { path: "students", element: <MentorStudentFeed /> },
              { path: "students/:id", element: <MentorStudentFeed /> },
              { path: "sessions", element: <MentorSessions /> },
            ],
          },
          {
            path: "investor",
            element: <ProtectedRoleRoute role={UserRole.INVESTOR} />,
            children: [
              { index: true, element: <InvestorDashboard /> },
              { path: "startups", element: <InvestorStartupMarketplace /> },
              { path: "institutions", element: <InvestorInstitutions /> },
              { path: "portfolio", element: <InvestorPortfolio /> },
              {
                path: "settings",
                element: <ProtectedAnyRoute />,
                children: [{ index: true, element: <SettingsPage /> }],
              },
            ],
          },
          {
            path: "recruiter",
            element: <ProtectedRoleRoute role={UserRole.RECRUITER} />,
            children: [
              { index: true, element: <RecruiterDashboard /> },
              { path: "talent", element: <RecruiterTalentSearch /> },
              { path: "colleges", element: <RecruiterCollegeConnect /> },
              { path: "drives", element: <RecruiterActiveDrives /> },
              { path: "onboarding", element: <RecruiterOnboardingTracker /> },
              {
                path: "messages",
                children: [
                  { index: true, element: <RecruiterMessagesPage /> },
                  { path: ":partnerId", element: <RecruiterMessagesPage /> },
                ],
              },
            ],
          },
          {
            path: "admin",
            element: <ProtectedRoleRoute role={UserRole.ADMIN} />,
            children: [
              { index: true, element: <AdminDashboard /> },
              { path: "users", element: <AdminUserManagement /> },
              { path: "patents", element: <AdminPatents /> },
              { path: "awards", element: <AdminAwards /> },
              { path: "deals", element: <AdminDeals /> },
              { path: "deals/:dealId", element: <AdminDealReview /> },
              { path: "analytics", element: <AdminAnalytics /> },
            ],
          },
          {
            path: "profile",
            element: <ProtectedAnyRoute />,
            children: [{ index: true, element: <UserProfilePage /> }],
          },
          {
            path: "settings",
            element: <ProtectedAnyRoute />,
            children: [{ index: true, element: <SettingsPage /> }],
          },
          {
            path: "messages",
            element: <ProtectedAnyRoute />,
            children: [
              { index: true, element: <MessagesPage /> },
              { path: ":partnerId", element: <MessagesPage /> },
            ],
          },
          {
            path: "school",
            element: <ProtectedRoleRoute role={UserRole.SCHOOL} />,
            children: [
              { index: true, element: <SchoolDashboard /> },
              { path: "students", element: <SchoolStudentLeaderboard /> },
              { path: "students/:id", element: <SchoolStudentLeaderboard /> },
              { path: "investors", element: <SchoolInvestorDirectory /> },
              { path: "mentors", element: <MentorDirectory /> },
              { path: "compliance", element: <SchoolComplianceReport /> },
            ],
          },
          {
            path: "college",
            element: <ProtectedRoleRoute role={UserRole.COLLEGE} />,
            children: [
              { index: true, element: <CollegeDashboard /> },
              { path: "students", element: <CollegeStudentLeaderboard /> },
              { path: "students/:id", element: <CollegeStudentLeaderboard /> },
              { path: "recruiters", element: <RecruiterDirectory /> },
              { path: "investors", element: <CollegeInvestorDirectory /> },
              { path: "mentors", element: <MentorDirectory /> },
              { path: "placement", element: <PlacementTracker /> },
              { path: "events", element: <EventManager /> },
              { path: "compliance", element: <CollegeComplianceReport /> },
            ],
          },
        ],
      },
      {
        path: "/change-password",
        element: <ChangePasswordPage />,
      },
      {
        path: "*",
        element: <Navigate to="/login" replace />,
      },
    ],
  },
]);
