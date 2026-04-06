import {
  type ComponentType,
  type LazyExoticComponent,
  type PropsWithChildren,
  Suspense,
  lazy,
} from "react";
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
import { ChangePasswordPage } from "../features/auth/ChangePasswordPage";
import { LoginPage } from "../features/auth/LoginPage";
import { RequestAccessPage } from "../features/auth/RequestAccessPage";
import { SignupPage } from "../features/auth/SignupPage";
import { useProtectedRoute } from "../hooks/useProtectedRoute";
import { useRouteActivityTracking } from "../hooks/useRouteActivityTracking";
import { useAuthStore } from "../store/authStore";
import { UserRole } from "../types/roles.types";
import { roleRedirect } from "../utils/roleRedirect";

function LazyPage({ component: Component }: { component: LazyExoticComponent<ComponentType> }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <Component />
    </Suspense>
  );
}

const SchoolDashboard = lazy(() => import("../features/school/Dashboard"));
const SchoolEventsPage = lazy(() => import("../features/school/EventsPage"));
const SchoolOperationsPage = lazy(() => import("../features/school/OperationsPage"));
const SchoolPatentsPage = lazy(() => import("../features/school/PatentsPage"));
const SchoolProjectsPage = lazy(() => import("../features/school/ProjectsPage"));
const SchoolStartupsPage = lazy(() => import("../features/school/StartupsPage"));
const SchoolStudentLeaderboard = lazy(() => import("../features/school/StudentLeaderboard"));
const SchoolInvestorDirectory = lazy(() => import("../features/school/InvestorDirectory"));
const SchoolMentorshipPage = lazy(() => import("../features/school/MentorshipPage"));
const SchoolComplianceReport = lazy(() => import("../features/school/ComplianceReport"));

const CollegeDashboard = lazy(() => import("../features/college/Dashboard"));
const CollegeOperationsPage = lazy(() => import("../features/college/OperationsPage"));
const CollegeProjectsPage = lazy(() => import("../features/college/ProjectsPage"));
const CollegeStudentLeaderboard = lazy(() => import("../features/college/StudentLeaderboard"));
const CollegeInvestorDirectory = lazy(() => import("../features/college/InvestorDirectory"));
const CollegeMentorshipPage = lazy(() => import("../features/college/MentorshipPage"));
const RecruiterDirectory = lazy(() => import("../features/college/RecruiterDirectory"));
const PlacementTracker = lazy(() => import("../features/college/PlacementTracker"));
const EventManager = lazy(() => import("../features/college/EventManager"));
const CollegeComplianceReport = lazy(() => import("../features/college/ComplianceReport"));

const MentorDashboard = lazy(() => import("../features/mentor/Dashboard"));
const MentorStudentFeed = lazy(() => import("../features/mentor/StudentFeed"));
const MentorSessions = lazy(() => import("../features/mentor/Sessions"));

const AdminDashboard = lazy(() => import("../features/admin/Dashboard"));
const AdminUserManagement = lazy(() => import("../features/admin/UserManagement"));
const AdminUserRequests = lazy(() => import("../features/admin/UserRequests"));
const AdminUserDirectory = lazy(() => import("../features/admin/UserDirectory"));
const AdminPatents = lazy(() => import("../features/admin/Patents"));
const AdminStartups = lazy(() => import("../features/admin/Startups"));
const AdminDeals = lazy(() => import("../features/admin/Deals"));
const AdminDealsOverview = lazy(() => import("../features/admin/DealsOverview"));
const AdminDealsRegister = lazy(() => import("../features/admin/DealsRegister"));
const AdminDealReview = lazy(() => import("../features/admin/DealReview"));
const AdminAnalyticsTemporary = lazy(() => import("../features/admin/AnalyticsTemporary"));
const AdminMentorshipPrograms = lazy(() => import("../features/admin/MentorshipPrograms"));
const AdminMentorshipMentors = lazy(() => import("../features/admin/MentorshipMentors"));
const AdminMentorshipProgramCreation = lazy(() => import("../features/admin/MentorshipProgramCreation"));
const AdminMentorshipRequests = lazy(() => import("../features/admin/MentorshipRequests"));
const AdminMentorshipProjects = lazy(() => import("../features/admin/MentorshipProjects"));
const AdminProblemBank = lazy(() => import("../features/admin/ProblemBank"));
const AdminProblemLibrary = lazy(() => import("../features/admin/ProblemLibrary"));
const AdminProblemReviewQueue = lazy(() => import("../features/admin/ProblemReviewQueue"));

const RecruiterDashboard = lazy(() => import("../features/recruiter/Dashboard"));
const RecruiterTalentSearch = lazy(() => import("../features/recruiter/TalentSearch"));
const RecruiterCollegeConnect = lazy(() => import("../features/recruiter/CollegeConnect"));
const RecruiterActiveDrives = lazy(() => import("../features/recruiter/ActiveDrives"));
const RecruiterOnboardingTracker = lazy(() => import("../features/recruiter/OnboardingTracker"));

const InvestorDashboard = lazy(() => import("../features/investor/Dashboard"));
const InvestorStartupMarketplace = lazy(() => import("../features/investor/StartupMarketplace"));
const InvestorInstitutions = lazy(() => import("../features/investor/Institutions"));
const InvestorPortfolio = lazy(() => import("../features/investor/Portfolio"));

const StartupCapTable = lazy(() => import("../features/startup/CapTable"));
const MyStartups = lazy(() =>
  import("../features/startup/MyStartups").then((module) => ({
    default: module.MyStartups,
  })),
);
const NewStartupPage = lazy(() =>
  import("../features/startup/NewStartupPage").then((module) => ({
    default: module.NewStartupPage,
  })),
);
const StartupLaunchShell = lazy(() =>
  import("../features/startup/StartupLaunchShell").then((module) => ({
    default: module.StartupLaunchShell,
  })),
);
const InvestorOutreach = lazy(() =>
  import("../features/startup/InvestorOutreach").then((module) => ({
    default: module.InvestorOutreach,
  })),
);

const UserProfilePage = lazy(() =>
  import("../features/profile/UserProfilePage").then((module) => ({
    default: module.UserProfilePage,
  })),
);
const SettingsPage = lazy(() =>
  import("../features/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const Homepage = lazy(() =>
  import("../app/pages/Homepage").then((module) => ({
    default: module.Homepage,
  })),
);

const LegacyStudentDashboard = lazy(() =>
  import("../app/pages/dashboards/StudentDashboard").then((module) => ({
    default: module.StudentDashboard,
  })),
);
const StudentMentorSessions = lazy(() =>
  import("../app/pages/dashboards/StudentMentorSessions").then((module) => ({
    default: module.StudentMentorSessions,
  })),
);
const StudentInvestorDeals = lazy(() =>
  import("../app/pages/dashboards/StudentInvestorDeals").then((module) => ({
    default: module.StudentInvestorDeals,
  })),
);
const ProblemBank = lazy(() =>
  import("../app/pages/ProblemBank").then((module) => ({
    default: module.ProblemBank,
  })),
);
const ProductWorkspace = lazy(() =>
  import("../app/pages/ProductWorkspace").then((module) => ({
    default: module.ProductWorkspace,
  })),
);
const PatentSupport = lazy(() =>
  import("../app/pages/PatentSupport").then((module) => ({
    default: module.PatentSupport,
  })),
);
const StartupLaunch = lazy(() =>
  import("../app/pages/StartupLaunch").then((module) => ({
    default: module.StartupLaunch,
  })),
);
const LeadershipProfile = lazy(() =>
  import("../app/pages/LeadershipProfile").then((module) => ({
    default: module.LeadershipProfile,
  })),
);
const Marketplace = lazy(() =>
  import("../features/student/Marketplace").then((module) => ({
    default: module.Marketplace,
  })),
);
const MarketplaceJobDetail = lazy(() =>
  import("../features/student/MarketplaceJobDetail").then((module) => ({
    default: module.MarketplaceJobDetail,
  })),
);
const PublicStudentProfilePage = lazy(() =>
  import("../features/student/PublicStudentProfilePage").then((module) => ({
    default: module.PublicStudentProfilePage,
  })),
);
const MessagesPage = lazy(() =>
  import("../app/pages/Messages").then((module) => ({
    default: module.MessagesPage,
  })),
);
const RecruiterMessagesPage = lazy(() =>
  import("../app/pages/RecruiterMessages").then((module) => ({
    default: module.RecruiterMessagesPage,
  })),
);

function RootLayout() {
  useRouteActivityTracking();
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

function DashboardIndexRedirect() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={roleRedirect(user.role)} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: "/students/:profileSlug",
        element: <LazyPage component={PublicStudentProfilePage} />,
      },
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            index: true,
            element: <LazyPage component={Homepage} />,
          },
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
            <LazyPage component={ProblemBank} />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/product-workspace/:projectId?",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <LazyPage component={ProductWorkspace} />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/patent-support/:innovationId?",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <LazyPage component={PatentSupport} />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/startup-launch",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <LazyPage component={MyStartups} />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/startup-launch/new",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <LazyPage component={NewStartupPage} />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/startup-launch/new/overview",
        element: <Navigate to="/startup-launch/new" replace />,
      },
      {
        path: "/startup-launch/:startupId",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <LazyPage component={StartupLaunchShell} />
          </ProtectedRoleRoute>
        ),
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: "overview", element: <LazyPage component={StartupLaunch} /> },
          { path: "investor-outreach", element: <LazyPage component={InvestorOutreach} /> },
          { path: "cap-table", element: <LazyPage component={StartupCapTable} /> },
          { path: "investor-deals", element: <LazyPage component={StudentInvestorDeals} /> },
        ],
      },
      {
        path: "/leadership-profile",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <LazyPage component={LeadershipProfile} />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/marketplace",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <LazyPage component={Marketplace} />
          </ProtectedRoleRoute>
        ),
      },
      {
        path: "/marketplace/jobs/:jobId",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <LazyPage component={MarketplaceJobDetail} />
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
            index: true,
            element: <DashboardIndexRedirect />,
          },
          {
            path: "student",
            element: <ProtectedRoleRoute role={UserRole.STUDENT} />,
            children: [
              { index: true, element: <LazyPage component={LegacyStudentDashboard} /> },
              { path: "mentor-sessions", element: <LazyPage component={StudentMentorSessions} /> },
              { path: "investor-deals", element: <Navigate to="/startup-launch" replace /> },
            ],
          },
          {
            path: "mentor",
            element: <ProtectedRoleRoute role={UserRole.MENTOR} />,
            children: [
              { index: true, element: <LazyPage component={MentorDashboard} /> },
              { path: "students", element: <LazyPage component={MentorStudentFeed} /> },
              { path: "students/:id", element: <LazyPage component={MentorStudentFeed} /> },
              { path: "sessions", element: <LazyPage component={MentorSessions} /> },
            ],
          },
          {
            path: "investor",
            element: <ProtectedRoleRoute role={UserRole.INVESTOR} />,
            children: [
              { index: true, element: <LazyPage component={InvestorDashboard} /> },
              { path: "startups", element: <LazyPage component={InvestorStartupMarketplace} /> },
              { path: "institutions", element: <LazyPage component={InvestorInstitutions} /> },
              { path: "portfolio", element: <LazyPage component={InvestorPortfolio} /> },
              {
                path: "settings",
                element: <ProtectedAnyRoute />,
                children: [{ index: true, element: <LazyPage component={SettingsPage} /> }],
              },
            ],
          },
          {
            path: "recruiter",
            element: <ProtectedRoleRoute role={UserRole.RECRUITER} />,
            children: [
              { index: true, element: <LazyPage component={RecruiterDashboard} /> },
              { path: "talent", element: <LazyPage component={RecruiterTalentSearch} /> },
              { path: "colleges", element: <LazyPage component={RecruiterCollegeConnect} /> },
              { path: "drives", element: <LazyPage component={RecruiterActiveDrives} /> },
              { path: "onboarding", element: <LazyPage component={RecruiterOnboardingTracker} /> },
              {
                path: "messages",
                children: [
                  { index: true, element: <LazyPage component={RecruiterMessagesPage} /> },
                  { path: ":partnerId", element: <LazyPage component={RecruiterMessagesPage} /> },
                ],
              },
            ],
          },
          {
            path: "admin",
            element: <ProtectedRoleRoute role={UserRole.ADMIN} />,
            children: [
              { index: true, element: <LazyPage component={AdminDashboard} /> },
              {
                path: "problems",
                element: <LazyPage component={AdminProblemBank} />,
                children: [
                  { index: true, element: <Navigate to="reviews" replace /> },
                  { path: "library", element: <LazyPage component={AdminProblemLibrary} /> },
                  { path: "reviews", element: <LazyPage component={AdminProblemReviewQueue} /> },
                ],
              },
              {
                path: "users",
                element: <LazyPage component={AdminUserManagement} />,
                children: [
                  { index: true, element: <Navigate to="requests" replace /> },
                  { path: "requests", element: <LazyPage component={AdminUserRequests} /> },
                  { path: "directory", element: <LazyPage component={AdminUserDirectory} /> },
                ],
              },
              { path: "patents", element: <LazyPage component={AdminPatents} /> },
              { path: "startups", element: <LazyPage component={AdminStartups} /> },
              {
                path: "deals",
                element: <LazyPage component={AdminDeals} />,
                children: [
                  { index: true, element: <Navigate to="overview" replace /> },
                  { path: "overview", element: <LazyPage component={AdminDealsOverview} /> },
                  { path: "register", element: <LazyPage component={AdminDealsRegister} /> },
                ],
              },
              { path: "deals/:dealId", element: <LazyPage component={AdminDealReview} /> },
              {
                path: "mentorship",
                element: <LazyPage component={AdminMentorshipPrograms} />,
                children: [
                  { index: true, element: <Navigate to="requests" replace /> },
                  { path: "requests", element: <LazyPage component={AdminMentorshipRequests} /> },
                  { path: "mentors", element: <LazyPage component={AdminMentorshipMentors} /> },
                  { path: "programs", element: <LazyPage component={AdminMentorshipProgramCreation} /> },
                  { path: "projects", element: <LazyPage component={AdminMentorshipProjects} /> },
                ],
              },
              { path: "analytics", element: <LazyPage component={AdminAnalyticsTemporary} /> },
              { path: "analytics/*", element: <LazyPage component={AdminAnalyticsTemporary} /> },
            ],
          },
          {
            path: "profile",
            element: <ProtectedAnyRoute />,
            children: [{ index: true, element: <LazyPage component={UserProfilePage} /> }],
          },
          {
            path: "settings",
            element: <ProtectedAnyRoute />,
            children: [{ index: true, element: <LazyPage component={SettingsPage} /> }],
          },
          {
            path: "messages",
            element: <ProtectedAnyRoute />,
            children: [
              { index: true, element: <LazyPage component={MessagesPage} /> },
              { path: ":partnerId", element: <LazyPage component={MessagesPage} /> },
            ],
          },
          {
            path: "school",
            element: <ProtectedRoleRoute role={UserRole.SCHOOL} />,
            children: [
              { index: true, element: <LazyPage component={SchoolDashboard} /> },
              { path: "operations", element: <LazyPage component={SchoolOperationsPage} /> },
              { path: "projects", element: <LazyPage component={SchoolProjectsPage} /> },
              { path: "projects/:projectId", element: <LazyPage component={SchoolProjectsPage} /> },
              { path: "patents", element: <LazyPage component={SchoolPatentsPage} /> },
              { path: "patents/:patentId", element: <LazyPage component={SchoolPatentsPage} /> },
              { path: "startups", element: <LazyPage component={SchoolStartupsPage} /> },
              { path: "startups/:startupId", element: <LazyPage component={SchoolStartupsPage} /> },
              { path: "events", element: <LazyPage component={SchoolEventsPage} /> },
              { path: "events/:eventId", element: <LazyPage component={SchoolEventsPage} /> },
              { path: "students", element: <LazyPage component={SchoolStudentLeaderboard} /> },
              { path: "students/:id", element: <LazyPage component={SchoolStudentLeaderboard} /> },
              { path: "investors", element: <LazyPage component={SchoolInvestorDirectory} /> },
              { path: "mentors", element: <LazyPage component={SchoolMentorshipPage} /> },
              { path: "compliance", element: <LazyPage component={SchoolComplianceReport} /> },
            ],
          },
          {
            path: "college",
            element: <ProtectedRoleRoute role={UserRole.COLLEGE} />,
            children: [
              { index: true, element: <LazyPage component={CollegeDashboard} /> },
              { path: "operations", element: <LazyPage component={CollegeOperationsPage} /> },
              { path: "projects", element: <LazyPage component={CollegeProjectsPage} /> },
              { path: "projects/:projectId", element: <LazyPage component={CollegeProjectsPage} /> },
              { path: "students", element: <LazyPage component={CollegeStudentLeaderboard} /> },
              { path: "students/:id", element: <LazyPage component={CollegeStudentLeaderboard} /> },
              { path: "recruiters", element: <LazyPage component={RecruiterDirectory} /> },
              { path: "investors", element: <LazyPage component={CollegeInvestorDirectory} /> },
              { path: "mentors", element: <LazyPage component={CollegeMentorshipPage} /> },
              { path: "placement", element: <LazyPage component={PlacementTracker} /> },
              { path: "events", element: <LazyPage component={EventManager} /> },
              { path: "compliance", element: <LazyPage component={CollegeComplianceReport} /> },
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
