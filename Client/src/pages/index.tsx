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
  useLocation,
  useParams,
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
import { getMarketplaceBasePath, getMarketplaceDetailPath } from "../features/marketplace/navigation";
import { getStudentPortfolioViewPath } from "../features/marketplace/navigation";

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
const SchoolAnalyticsPage = lazy(() => import("../features/school/AnalyticsPage"));

const CollegeDashboard = lazy(() => import("../features/college/Dashboard"));
const CollegeOperationsPage = lazy(() => import("../features/college/OperationsPage"));
const CollegeProjectsPage = lazy(() => import("../features/college/ProjectsPage"));
const CollegeStudentLeaderboard = lazy(() => import("../features/college/StudentLeaderboard"));
const CollegeInvestorDirectory = lazy(() => import("../features/college/InvestorDirectory"));
const CollegeMentorshipPage = lazy(() => import("../features/college/MentorshipPage"));
const RecruiterDirectory = lazy(() => import("../features/college/RecruiterDirectory"));
const PlacementTracker = lazy(() => import("../features/college/PlacementTracker"));
const EventManager = lazy(() => import("../features/college/EventManager"));
const CollegeAnalyticsPage = lazy(() => import("../features/college/AnalyticsPage"));

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
const SupportAdminConsolePage = lazy(() => import("../features/support/SupportAdminConsolePage"));
const SupportAdminTicketRoute = lazy(() => import("../features/support/SupportAdminTicketRoute"));

const RecruiterDashboard = lazy(() => import("../features/recruiter/RecruiterDashboardExperience"));
const RecruiterTalentSearch = lazy(() =>
  import("../features/recruiter/RecruiterDashboardExperience").then((module) => ({
    default: module.RecruiterTalentSearchView,
  })),
);
const RecruiterCollegeConnect = lazy(() =>
  import("../features/recruiter/RecruiterDashboardExperience").then((module) => ({
    default: module.RecruiterCollegeConnectView,
  })),
);
const RecruiterActiveDrives = lazy(() =>
  import("../features/recruiter/RecruiterDashboardExperience").then((module) => ({
    default: module.RecruiterActiveDrivesView,
  })),
);
const RecruiterOnboardingTracker = lazy(() =>
  import("../features/recruiter/RecruiterDashboardExperience").then((module) => ({
    default: module.RecruiterOnboardingTrackerView,
  })),
);
const RecruiterApplications = lazy(() => import("../features/recruiter/ApplicationsPipeline"));
const RecruiterHiringEvents = lazy(() => import("../features/recruiter/HiringEvents"));

const InvestorDashboard = lazy(() => import("../features/investor/Dashboard"));
const InvestorStartupMarketplace = lazy(() => import("../features/investor/StartupMarketplace"));
const InvestorInstitutions = lazy(() => import("../features/investor/Institutions"));
const InvestorPortfolio = lazy(() => import("../features/investor/Portfolio"));
const InvestorPaymentPage = lazy(() => import("../features/investor/InvestorPaymentPage"));

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
const StartupWorkspace = lazy(() =>
  import("../features/startup/StartupWorkspace").then((module) => ({
    default: module.StartupWorkspace,
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
const Portfolio = lazy(() =>
  import("../app/pages/Portfolio").then((module) => ({
    default: module.Portfolio,
  })),
);
const StudentApplicationsPage = lazy(() => import("../features/student/ApplicationsPage"));
const StudentEventsPage = lazy(() => import("../features/student/StudentEventsPage"));
const MarketplaceJobDetail = lazy(() =>
  import("../features/student/MarketplaceJobDetail").then((module) => ({
    default: module.MarketplaceJobDetail,
  })),
);
const InnovationScorePage = lazy(() =>
  import("../app/pages/InnovationScore").then((module) => ({
    default: module.InnovationScorePage,
  })),
);
const Marketplace = lazy(() =>
  import("../app/pages/Marketplace").then((module) => ({
    default: module.Marketplace,
  })),
);
const MarketplaceDetail = lazy(() =>
  import("../app/pages/MarketplaceDetail").then((module) => ({
    default: module.MarketplaceDetail,
  })),
);
const PublicStudentProfilePage = lazy(() =>
  import("../features/student/PublicStudentProfilePage").then((module) => ({
    default: module.PublicStudentProfilePage,
  })),
);
const StudentPortfolioViewPage = lazy(() =>
  import("../features/student/StudentPortfolioViewPage").then((module) => ({
    default: module.StudentPortfolioViewPage,
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
const SupportHelpDeskPage = lazy(() => import("../features/support/SupportHelpDeskPage"));
const SupportRaiseQueryPage = lazy(() => import("../features/support/SupportRaiseQueryPage"));
const SupportTicketListPage = lazy(() => import("../features/support/SupportTicketListPage"));
const SupportUserTicketRoute = lazy(() => import("../features/support/SupportUserTicketRoute"));

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

function ProtectedRolesRoute({
  roles,
  children,
}: PropsWithChildren<{ roles: UserRole[] }>) {
  const route = useProtectedRoute(roles);

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

function MarketplaceIndexRedirect() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getMarketplaceBasePath(user.role)} replace />;
}

function MarketplaceDetailRedirect() {
  const user = useAuthStore((state) => state.user);
  const { entityType, entityId } = useParams<{ entityType?: string; entityId?: string }>();

  if (!user || !entityType || !entityId) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getMarketplaceDetailPath(user.role, entityType as "student" | "school" | "college" | "mentor" | "investor" | "recruiter" | "startup", entityId)} replace />;
}

function StudentPortfolioRedirect() {
  const { id } = useParams<{ id?: string }>();

  if (!id) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to={getStudentPortfolioViewPath(id)} replace />;
}

function InvitationsRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set("view", "requests");

  return <Navigate to={`/dashboard/messages?${params.toString()}`} replace />;
}

const NON_ADMIN_DASHBOARD_ROLES = [
  UserRole.STUDENT,
  UserRole.MENTOR,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
];

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
          <ProtectedRolesRoute roles={NON_ADMIN_DASHBOARD_ROLES}>
            <LazyPage component={ProblemBank} />
          </ProtectedRolesRoute>
        ),
      },
      {
        path: "/product-workspace/:projectId?",
        element: (
          <ProtectedRolesRoute roles={[UserRole.STUDENT, UserRole.MENTOR, UserRole.INVESTOR]}>
            <LazyPage component={ProductWorkspace} />
          </ProtectedRolesRoute>
        ),
      },
      {
        path: "/patent-support/:innovationId?",
        element: (
          <ProtectedRoleRoute role={UserRole.STUDENT}>
            <Navigate to="/startup-launch" replace />
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
            { path: "product-workspace", element: <LazyPage component={StartupWorkspace} /> },
            { path: "cap-table", element: <LazyPage component={StartupCapTable} /> },
            { path: "investor-deals", element: <LazyPage component={StudentInvestorDeals} /> },
            { path: "patent-support", element: <LazyPage component={PatentSupport} /> },
          ],
        },
      {
        path: "/portfolio",
        element: (
          <ProtectedAnyRoute>
            <LazyPage component={Portfolio} />
          </ProtectedAnyRoute>
        ),
      },
      {
        path: "/portfolio/student/:userId",
        element: (
          <ProtectedAnyRoute>
            <LazyPage component={StudentPortfolioViewPage} />
          </ProtectedAnyRoute>
        ),
      },
      {
        path: "/portfolio/view/:entityType/:entityId",
        element: (
          <ProtectedAnyRoute>
            <MarketplaceDetailRedirect />
          </ProtectedAnyRoute>
        ),
      },
      {
        path: "/marketplace",
        element: (
          <ProtectedRolesRoute roles={NON_ADMIN_DASHBOARD_ROLES}>
            <MarketplaceIndexRedirect />
          </ProtectedRolesRoute>
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
        path: "/marketplace/view/:entityType/:entityId",
        element: (
          <ProtectedRolesRoute roles={NON_ADMIN_DASHBOARD_ROLES}>
            <MarketplaceDetailRedirect />
          </ProtectedRolesRoute>
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
              { path: "score", element: <LazyPage component={InnovationScorePage} /> },
              { path: "mentor-sessions", element: <LazyPage component={StudentMentorSessions} /> },
              { path: "investor-deals", element: <Navigate to="/startup-launch" replace /> },
              { path: "applications", element: <LazyPage component={StudentApplicationsPage} /> },
              { path: "events", element: <LazyPage component={StudentEventsPage} /> },
              { path: "marketplace", element: <LazyPage component={Marketplace} /> },
              { path: "marketplace/view/:entityType/:entityId", element: <LazyPage component={MarketplaceDetail} /> },
            ],
          },
          {
            path: "mentor",
            element: <ProtectedRoleRoute role={UserRole.MENTOR} />,
            children: [
              { index: true, element: <LazyPage component={MentorDashboard} /> },
              { path: "students", element: <LazyPage component={MentorStudentFeed} /> },
              { path: "students/:id", element: <StudentPortfolioRedirect /> },
              { path: "sessions", element: <LazyPage component={MentorSessions} /> },
              { path: "marketplace", element: <LazyPage component={Marketplace} /> },
              { path: "marketplace/view/:entityType/:entityId", element: <LazyPage component={MarketplaceDetail} /> },
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
              { path: "deals/:dealId/payment", element: <LazyPage component={InvestorPaymentPage} /> },
              { path: "marketplace", element: <LazyPage component={Marketplace} /> },
              { path: "marketplace/view/:entityType/:entityId", element: <LazyPage component={MarketplaceDetail} /> },
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
              { path: "marketplace", element: <LazyPage component={Marketplace} /> },
              { path: "marketplace/view/:entityType/:entityId", element: <LazyPage component={MarketplaceDetail} /> },
              { path: "talent", element: <LazyPage component={RecruiterTalentSearch} /> },
              { path: "applications", element: <LazyPage component={RecruiterApplications} /> },
              { path: "colleges", element: <LazyPage component={RecruiterCollegeConnect} /> },
              { path: "drives", element: <LazyPage component={RecruiterActiveDrives} /> },
              { path: "hiring-events", element: <LazyPage component={RecruiterHiringEvents} /> },
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
              {
                path: "help-desk",
                children: [
                  { index: true, element: <LazyPage component={SupportAdminConsolePage} /> },
                  { path: ":ticketId", element: <LazyPage component={SupportAdminTicketRoute} /> },
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
            path: "invitations",
            element: <InvitationsRedirect />,
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
              path: "help-desk",
              element: <ProtectedAnyRoute />,
              children: [
                { index: true, element: <LazyPage component={SupportHelpDeskPage} /> },
                { path: "new", element: <LazyPage component={SupportRaiseQueryPage} /> },
                { path: "tickets", element: <LazyPage component={SupportTicketListPage} /> },
                { path: ":ticketId", element: <LazyPage component={SupportUserTicketRoute} /> },
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
              { path: "students/:id", element: <StudentPortfolioRedirect /> },
              { path: "investors", element: <LazyPage component={SchoolInvestorDirectory} /> },
              { path: "mentors", element: <LazyPage component={SchoolMentorshipPage} /> },
              { path: "analytics", element: <LazyPage component={SchoolAnalyticsPage} /> },
              { path: "compliance", element: <Navigate to="/dashboard/school/analytics" replace /> },
            ],
          },
          {
            path: "college",
            element: <ProtectedRoleRoute role={UserRole.COLLEGE} />,
            children: [
              { index: true, element: <LazyPage component={CollegeDashboard} /> },
              { path: "marketplace", element: <LazyPage component={Marketplace} /> },
              { path: "marketplace/view/:entityType/:entityId", element: <LazyPage component={MarketplaceDetail} /> },
              { path: "operations", element: <LazyPage component={CollegeOperationsPage} /> },
              { path: "projects", element: <LazyPage component={CollegeProjectsPage} /> },
              { path: "projects/:projectId", element: <LazyPage component={CollegeProjectsPage} /> },
              { path: "students", element: <LazyPage component={CollegeStudentLeaderboard} /> },
              { path: "students/:id", element: <StudentPortfolioRedirect /> },
              { path: "recruiters", element: <LazyPage component={RecruiterDirectory} /> },
              { path: "investors", element: <LazyPage component={CollegeInvestorDirectory} /> },
              { path: "mentors", element: <LazyPage component={CollegeMentorshipPage} /> },
              { path: "placement", element: <LazyPage component={PlacementTracker} /> },
              { path: "events", element: <LazyPage component={EventManager} /> },
              { path: "analytics", element: <LazyPage component={CollegeAnalyticsPage} /> },
              { path: "compliance", element: <Navigate to="/dashboard/college/analytics" replace /> },
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
