import {
  type ComponentType,
  type LazyExoticComponent,
  type PropsWithChildren,
  Suspense,
  useEffect,
  lazy,
} from "react";
import { TermsAcceptanceGate } from "../features/auth/TermsAcceptanceGate";
import { GlobalSmartChat } from "../components/smart-chat/GlobalSmartChat";
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
import { safeLazy } from "../utils/safeLazy";

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

const SchoolDashboard = safeLazy(() => import("../features/school/Dashboard"));
const SchoolEventsPage = safeLazy(() => import("../features/school/EventsPage"));
const SchoolProjectsPage = safeLazy(() => import("../features/school/ProjectsPage"));
const SchoolPatentsPage = safeLazy(() => import("../features/school/PatentsPage"));
const SchoolStartupsPage = safeLazy(() => import("../features/school/StartupsPage"));
const SchoolMentorshipPage = safeLazy(() => import("../features/school/MentorshipPage"));
const SchoolOperationsPage = safeLazy(() => import("../features/school/OperationsPage"));
const SchoolStudentLeaderboard = safeLazy(() => import("../features/school/StudentLeaderboard"));
const SchoolInvestorDirectory = safeLazy(() => import("../features/school/InvestorDirectory"));
const SchoolAnalyticsPage = safeLazy(() => import("../features/school/AnalyticsPage"));
const SchoolCompliancePage = safeLazy(() => import("../features/school/CompliancePage"));

const CollegeDashboard = safeLazy(() => import("../features/college/Dashboard"));
const CollegeOperationsPage = safeLazy(() => import("../features/college/OperationsPage"));
const CollegeProjectsPage = safeLazy(() => import("../features/college/ProjectsPage"));
const CollegePatentsPage = safeLazy(() => import("../features/college/PatentsPage"));
const CollegeStartupsPage = safeLazy(() => import("../features/college/StartupsPage"));
const CollegeMentorshipPage = safeLazy(() => import("../features/college/MentorshipPage"));
const CollegeStudentLeaderboard = safeLazy(() => import("../features/college/StudentLeaderboard"));
const CollegeInvestorDirectory = safeLazy(() => import("../features/college/InvestorDirectory"));
const RecruiterDirectory = safeLazy(() => import("../features/college/RecruiterDirectory"));
const PlacementTracker = safeLazy(() => import("../features/college/PlacementTracker"));
const EventManager = safeLazy(() => import("../features/college/EventManager"));
const CollegeAnalyticsPage = safeLazy(() => import("../features/college/AnalyticsPage"));
const CollegeCompliancePage = safeLazy(() => import("../features/college/CompliancePage"));

const MentorDashboard = safeLazy(() => import("../features/mentor/Dashboard"));
const MentorStudentFeed = safeLazy(() => import("../features/mentor/StudentFeed"));
const MentorSessions = safeLazy(() => import("../features/mentor/Sessions"));
const MentorMarketplace = safeLazy(() => import("../features/mentor/MentorMarketplace"));
const MentorScorePage = safeLazy(() => import("../features/mentor/MentorScore"));
const MentorEvidenceCenter = safeLazy(() => import("../features/mentor/EvidenceCenter"));
const MentorForum = safeLazy(() => import("../features/mentor/Forum"));
const MentorResources = safeLazy(() => import("../features/mentor/Resources"));

const AdminDashboard = safeLazy(() => import("../features/admin/Dashboard"));
const AdminOnboarding = safeLazy(() => import("../features/admin/Onboarding"));
const AdminOnboardingAccounts = safeLazy(() => import("../features/admin/OnboardingAccounts"));
const AdminUserDirectory = safeLazy(() => import("../features/admin/UserDirectory"));
const AdminPatentsWorkspace = safeLazy(() => import("../features/admin/PatentsWorkspace"));
const AdminPatents = safeLazy(() => import("../features/admin/Patents"));
const AdminPatentRequests = safeLazy(() => import("../features/admin/PatentRequests"));
const AdminStartups = safeLazy(() => import("../features/admin/Startups"));
const AdminDeals = safeLazy(() => import("../features/admin/Deals"));
const AdminDealsOverview = safeLazy(() => import("../features/admin/DealsOverview"));
const AdminDealsRegister = safeLazy(() => import("../features/admin/DealsRegister"));
const AdminDealReview = safeLazy(() => import("../features/admin/DealReview"));
const AdminAnalytics = safeLazy(() => import("../features/admin/Analytics"));
const AdminAnalyticsOverview = safeLazy(() => import("../features/admin/AnalyticsOverview"));
const AdminAnalyticsUsage = safeLazy(() => import("../features/admin/AnalyticsUsage"));
const AdminAnalyticsUsers = safeLazy(() => import("../features/admin/AnalyticsUsers"));
const AdminAnalyticsLogs = safeLazy(() => import("../features/admin/AnalyticsLogs"));
const AdminPlatformAnalytics = safeLazy(() => import("../features/analytics/AdminPlatformAnalytics"));
const InvestorBidDashboard = safeLazy(() => import("../features/bidding/InvestorBidDashboard"));
const AgreementPage = safeLazy(() => import("../features/agreement/AgreementPage"));
const AdminMentorsLayout = safeLazy(() => import("../features/admin/AdminMentorsLayout"));
const AdminMentorshipPrograms = safeLazy(() => import("../features/admin/MentorshipPrograms"));
const AdminMentorshipMentors = safeLazy(() => import("../features/admin/MentorshipMentors"));
const AdminMentorshipProgramCreation = safeLazy(() => import("../features/admin/MentorshipProgramCreation"));
const AdminMentorshipRequests = safeLazy(() => import("../features/admin/MentorshipRequests"));
const AdminMentorScores = safeLazy(() => import("../features/admin/MentorScores"));
const AdminProblemBank = safeLazy(() => import("../features/admin/ProblemBank"));
const AdminProblemLibrary = safeLazy(() => import("../features/admin/ProblemLibrary"));
const AdminProblemReviewQueue = safeLazy(() => import("../features/admin/ProblemReviewQueue"));

const RecruiterDashboard = safeLazy(() => import("../features/recruiter/RecruiterDashboardExperience"));
const RecruiterOnboardingTracker = safeLazy(() => import("../features/recruiter/OnboardingTracker"));
const RecruiterApplications = safeLazy(() => import("../features/recruiter/ApplicationsPipeline"));
const RecruiterCampusEvents = safeLazy(() => import("../features/recruiter/CampusEvents"));
const HiringSessionPage = safeLazy(() => import("../features/recruiter/HiringSessionPage"));
const RecruiterCollegeStudentsPage = safeLazy(() => import("../features/recruiter/CollegeStudentsPage"));

const InvestorDashboard = safeLazy(() => import("../features/investor/Dashboard"));
const InvestorStartupMarketplace = safeLazy(() => import("../features/investor/StartupMarketplace"));
const InvestorInstitutions = safeLazy(() => import("../features/investor/Institutions"));
const InvestorProductWorkshop = safeLazy(() => import("../features/investor/ProductWorkshop"));
const InvestorPaymentPage = safeLazy(() => import("../features/investor/InvestorPaymentPage"));
const InvestmentPipeline = safeLazy(() => import("../features/investor/InvestmentPipeline"));

const StartupCapTable = safeLazy(() => import("../features/startup/CapTable"));
const MyStartups = safeLazy(() =>
  import("../features/startup/MyStartups").then((module) => ({
    default: module.MyStartups,
  })),
);
const NewStartupPage = safeLazy(() =>
  import("../features/startup/NewStartupPage").then((module) => ({
    default: module.NewStartupPage,
  })),
);
const StartupLaunchShell = safeLazy(() =>
  import("../features/startup/StartupLaunchShell").then((module) => ({
    default: module.StartupLaunchShell,
  })),
);
const StartupWorkspace = safeLazy(() =>
  import("../features/startup/StartupWorkspace").then((module) => ({
    default: module.StartupWorkspace,
  })),
);
const InvestorOutreach = safeLazy(() =>
  import("../features/startup/InvestorOutreach").then((module) => ({
    default: module.InvestorOutreach,
  })),
);

const SettingsPage = safeLazy(() =>
  import("../features/settings/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);
const Homepage = safeLazy(() =>
  import("../app/pages/Homepage").then((module) => ({
    default: module.Homepage,
  })),
);

const LegacyStudentDashboard = safeLazy(() =>
  import("../app/pages/dashboards/StudentDashboard").then((module) => ({
    default: module.StudentDashboard,
  })),
);
const StudentMentorSessions = safeLazy(() =>
  import("../app/pages/dashboards/StudentMentorSessions").then((module) => ({
    default: module.StudentMentorSessions,
  })),
);
const ProblemBank = safeLazy(() =>
  import("../app/pages/ProblemBank").then((module) => ({
    default: module.ProblemBank,
  })),
);
const ProductWorkspace = safeLazy(() =>
  import("../app/pages/ProductWorkspace").then((module) => ({
    default: module.ProductWorkspace,
  })),
);
const PatentSupport = safeLazy(() =>
  import("../app/pages/PatentSupport").then((module) => ({
    default: module.PatentSupport,
  })),
);
const StartupLaunch = safeLazy(() =>
  import("../app/pages/StartupLaunch").then((module) => ({
    default: module.StartupLaunch ?? module.default,
  })),
);
const Portfolio = safeLazy(() =>
  import("../app/pages/Portfolio").then((module) => ({
    default: module.Portfolio ?? module.default,
  })),
);
const StudentApplicationsPage = safeLazy(() => import("../features/student/ApplicationsPage"));
const StudentEventsPage = safeLazy(() => import("../features/student/StudentEventsPage"));
const MarketplaceJobDetail = safeLazy(() =>
  import("../features/student/MarketplaceJobDetail").then((module) => ({
    default: module.MarketplaceJobDetail,
  })),
);
const InnovationScorePage = safeLazy(() =>
  import("../app/pages/InnovationScore").then((module) => ({
    default: module.InnovationScorePage,
  })),
);
const Marketplace = safeLazy(() =>
  import("../app/pages/Marketplace").then((module) => ({
    default: module.Marketplace,
  })),
);
const MarketplaceDetail = safeLazy(() =>
  import("../app/pages/MarketplaceDetail").then((module) => ({
    default: module.MarketplaceDetail,
  })),
);
const PublicStudentProfilePage = safeLazy(() =>
  import("../features/student/PublicStudentProfilePage").then((module) => ({
    default: module.PublicStudentProfilePage,
  })),
);
const StudentPortfolioViewPage = safeLazy(() =>
  import("../features/student/StudentPortfolioViewPage").then((module) => ({
    default: module.StudentPortfolioViewPage,
  })),
);
const MessagesPage = safeLazy(() =>
  import("../app/pages/Messages").then((module) => ({
    default: module.MessagesPage,
  })),
);

function RootLayout() {
  useRouteActivityTracking();
  return (
    <>
      <Outlet />
      <TermsAcceptanceGate />
      <GlobalSmartChat />
    </>
  );
}

function RouteErrorPage() {
  const error = useRouteError();
  const rawMessage = isRouteErrorResponse(error)
    ? typeof error.data === "string"
      ? error.data
      : error.statusText
    : error instanceof Error
      ? error.message
      : String(error ?? "");

  const isChunkError =
    rawMessage.includes("Failed to fetch dynamically imported module") ||
    rawMessage.includes("Importing a module script failed") ||
    rawMessage.includes("Loading chunk") ||
    rawMessage.includes("ChunkLoadError");

  useEffect(() => {
    if (isChunkError) {
      const timer = setTimeout(() => {
        sessionStorage.clear();
        window.location.reload();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isChunkError]);

  const title = isChunkError
    ? "New Version Available"
    : isRouteErrorResponse(error)
      ? `${error.status} ${error.statusText}`
      : "Something went wrong";

  const description = isChunkError
    ? "A new update for ProMove was deployed. Updating to the latest version..."
    : isRouteErrorResponse(error)
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
          {isChunkError ? "App Update" : "Route Error"}
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
            onClick={() => {
              sessionStorage.clear();
              window.location.reload();
            }}
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

  if (entityType === "student") {
    return <Navigate to={getStudentPortfolioViewPath(entityId)} replace />;
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
  const user = useAuthStore((state) => state.user);
  const params = new URLSearchParams(location.search);
  params.set("view", "requests");

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === UserRole.ADMIN) {
    return <Navigate to={roleRedirect(user.role)} replace />;
  }

  return <Navigate to={`/dashboard/messages?${params.toString()}`} replace />;
}

function RecruiterMessagesRedirect() {
  const location = useLocation();
  const { partnerId } = useParams<{ partnerId?: string }>();

  return (
    <Navigate
      to={`/dashboard/messages${partnerId ? `/${partnerId}` : ""}${location.search}`}
      replace
    />
  );
}

function RecruiterMarketplaceRouteRedirect({
  lane,
}: {
  lane: "students" | "colleges";
}) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const nextParams = new URLSearchParams({ role: lane });
  const query = params.get("q") ?? params.get("search");
  const institution = params.get("institution");

  if (query?.trim()) {
    nextParams.set("q", query.trim());
  }

  if (lane === "students" && institution?.trim()) {
    nextParams.set("institution", institution.trim());
  }

  return (
    <Navigate
      to={`${getMarketplaceBasePath(UserRole.RECRUITER)}?${nextParams.toString()}`}
      replace
    />
  );
}

function InvestorProductWorkspaceRedirect() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();

  if (!workspaceId) {
    return <Navigate to="/dashboard/investor/product-workshop" replace />;
  }

  return <Navigate to={`/product-workspace/${workspaceId}`} replace />;
}

function ProductWorkspaceIndexRoute() {
  return <LazyPage component={ProductWorkspace} />;
}

const NON_ADMIN_DASHBOARD_ROLES = [
  UserRole.STUDENT,
  UserRole.MENTOR,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
];

const SHARED_MESSAGES_ROLES = [
  UserRole.STUDENT,
  UserRole.SCHOOL,
  UserRole.COLLEGE,
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
        path: "/product-workspace",
        element: (
          <ProtectedRolesRoute roles={[UserRole.STUDENT, UserRole.MENTOR, UserRole.INVESTOR]}>
            <ProductWorkspaceIndexRoute />
          </ProtectedRolesRoute>
        ),
      },
      {
        path: "/product-workspace/:projectId",
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
            { path: "product-workspace", element: <LazyPage component={StartupWorkspace} /> },
            { path: "cap-table", element: <LazyPage component={StartupCapTable} /> },
            { path: "bids", element: <Navigate to="../cap-table?view=pipeline" replace /> },
            { path: "investor-deals", element: <Navigate to="../cap-table" replace /> },
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
            <LazyPage component={Portfolio} />
          </ProtectedAnyRoute>
        ),
      },
      {
        path: "/portfolio/view/:entityType/:entityId",
        element: (
          <ProtectedAnyRoute>
            <LazyPage component={Portfolio} />
          </ProtectedAnyRoute>
        ),
      },
      {
        path: "/agreements/:agreementId",
        element: (
          <ProtectedAnyRoute>
            <LazyPage component={AgreementPage} />
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
          <ProtectedRolesRoute roles={NON_ADMIN_DASHBOARD_ROLES}>
            <LazyPage component={MarketplaceJobDetail} />
          </ProtectedRolesRoute>
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
              { path: "workspaces", element: <Navigate to="/product-workspace" replace /> },
              { path: "score", element: <LazyPage component={InnovationScorePage} /> },
              { path: "mentor-sessions", element: <LazyPage component={StudentMentorSessions} /> },
              { path: "investor-deals", element: <Navigate to="/startup-launch" replace /> },
              { path: "applications", element: <LazyPage component={StudentApplicationsPage} /> },
              { path: "applications/:applicationId", element: <LazyPage component={HiringSessionPage} /> },
              { path: "events", element: <LazyPage component={StudentEventsPage} /> },
              { path: "bids", element: <Navigate to="/startup-launch" replace /> },
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
              { path: "score", element: <LazyPage component={MentorScorePage} /> },
              { path: "evidence-center", element: <LazyPage component={MentorEvidenceCenter} /> },
              { path: "forum", element: <LazyPage component={MentorForum} /> },
              { path: "resources", element: <LazyPage component={MentorResources} /> },
              { path: "marketplace", element: <LazyPage component={MentorMarketplace} /> },
              { path: "marketplace/view/:entityType/:entityId", element: <LazyPage component={MarketplaceDetail} /> },
            ],
          },
          {
            path: "investor",
            element: <ProtectedRoleRoute role={UserRole.INVESTOR} />,
            children: [
              { index: true, element: <LazyPage component={InvestorDashboard} /> },
              { path: "bids", element: <LazyPage component={InvestorBidDashboard} /> },
              { path: "startups", element: <LazyPage component={InvestorStartupMarketplace} /> },
              { path: "pipeline", element: <LazyPage component={InvestmentPipeline} /> },
              { path: "institutions", element: <LazyPage component={InvestorInstitutions} /> },
              { path: "product-workshop", element: <LazyPage component={InvestorProductWorkshop} /> },
              { path: "product-workshop/:workspaceId", element: <InvestorProductWorkspaceRedirect /> },
              { path: "portfolio", element: <Navigate to="/portfolio" replace /> },
              { path: "deals/:dealId/payment", element: <LazyPage component={InvestorPaymentPage} /> },
              { path: "marketplace", element: <Navigate to="/dashboard/investor/startups" replace /> },
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
              { path: "talent", element: <RecruiterMarketplaceRouteRedirect lane="students" /> },
              { path: "applications", element: <LazyPage component={RecruiterApplications} /> },
              { path: "applications/:applicationId", element: <LazyPage component={HiringSessionPage} /> },
              { path: "colleges", element: <RecruiterMarketplaceRouteRedirect lane="colleges" /> },
              { path: "colleges/:collegeId/students", element: <LazyPage component={RecruiterCollegeStudentsPage} /> },
              { path: "campus", element: <LazyPage component={RecruiterCampusEvents} /> },
              { path: "drives", element: <Navigate to="/dashboard/recruiter/campus" replace /> },
              { path: "hiring-events", element: <Navigate to="/dashboard/recruiter/campus" replace /> },
              { path: "onboarding", element: <LazyPage component={RecruiterOnboardingTracker} /> },
              {
                path: "messages",
                children: [
                  { index: true, element: <RecruiterMessagesRedirect /> },
                  { path: ":partnerId", element: <RecruiterMessagesRedirect /> },
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
                path: "onboarding",
                element: <LazyPage component={AdminOnboarding} />,
                children: [
                  { index: true, element: <Navigate to="accounts" replace /> },
                  { path: "accounts", element: <LazyPage component={AdminOnboardingAccounts} /> },
                  // Requests are merged into the Onboard view — redirect legacy links.
                  { path: "requests", element: <Navigate to="/dashboard/admin/onboarding/accounts" replace /> },
                  { path: "directory", element: <LazyPage component={AdminUserDirectory} /> },
                ],
              },
              // Access Control merged into Onboarding — keep old links working.
              { path: "users", element: <Navigate to="/dashboard/admin/onboarding/accounts" replace /> },
              { path: "users/requests", element: <Navigate to="/dashboard/admin/onboarding/accounts" replace /> },
              { path: "users/directory", element: <Navigate to="/dashboard/admin/onboarding/directory" replace /> },
              {
                path: "patents",
                element: <LazyPage component={AdminPatentsWorkspace} />,
                children: [
                  { index: true, element: <Navigate to="review" replace /> },
                  { path: "review", element: <LazyPage component={AdminPatents} /> },
                  { path: "assisted-filing", element: <LazyPage component={AdminPatentRequests} /> },
                  { path: "*", element: <Navigate to="review" replace /> },
                ],
              },
              {
                path: "patent-requests",
                element: <Navigate to="/dashboard/admin/patents/assisted-filing" replace />,
              },
              { path: "student-onboarding", element: <Navigate to="/dashboard/admin/onboarding/accounts" replace /> },
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
                path: "mentors",
                element: <LazyPage component={AdminMentorsLayout} />,
                children: [
                  { index: true, element: <Navigate to="mentorship" replace /> },
                  {
                    path: "mentorship",
                    element: <LazyPage component={AdminMentorshipPrograms} />,
                    children: [
                      { index: true, element: <Navigate to="requests" replace /> },
                      { path: "requests", element: <LazyPage component={AdminMentorshipRequests} /> },
                      { path: "mentors", element: <LazyPage component={AdminMentorshipMentors} /> },
                      { path: "programs", element: <LazyPage component={AdminMentorshipProgramCreation} /> },
                    ],
                  },
                  {
                    path: "scores",
                    element: <LazyPage component={AdminMentorScores} />,
                  },
                ],
              },
              { path: "mentorship/requests", element: <Navigate to="/dashboard/admin/mentors/mentorship/requests" replace /> },
              { path: "mentorship/mentors", element: <Navigate to="/dashboard/admin/mentors/mentorship/mentors" replace /> },
              { path: "mentorship/programs", element: <Navigate to="/dashboard/admin/mentors/mentorship/programs" replace /> },
              { path: "mentorship", element: <Navigate to="/dashboard/admin/mentors/mentorship" replace /> },
              { path: "mentor-scores", element: <Navigate to="/dashboard/admin/mentors/scores" replace /> },
              {
                path: "help-desk/*",
                element: <Navigate to="/dashboard/admin" replace />,
              },
              {
                path: "analytics",
                element: <LazyPage component={AdminAnalytics} />,
                children: [
                  { index: true, element: <Navigate to="overview" replace /> },
                  { path: "overview", element: <LazyPage component={AdminAnalyticsOverview} /> },
                  { path: "usage", element: <LazyPage component={AdminAnalyticsUsage} /> },
                  { path: "users", element: <LazyPage component={AdminAnalyticsUsers} /> },
                  { path: "logs", element: <LazyPage component={AdminAnalyticsLogs} /> },
                  { path: "platform", element: <LazyPage component={AdminPlatformAnalytics} /> },
                  { path: "*", element: <Navigate to="overview" replace /> },
                ],
              },
              { path: "verification", element: <Navigate to="/dashboard/admin" replace /> },
            ],
          },
          {
            path: "profile",
            element: <Navigate to="/portfolio" replace />,
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
              element: <ProtectedRolesRoute roles={SHARED_MESSAGES_ROLES} />,
              children: [
                { index: true, element: <LazyPage component={MessagesPage} /> },
                { path: ":partnerId", element: <LazyPage component={MessagesPage} /> },
              ],
            },
            {
              path: "help-desk/*",
              element: <Navigate to="/dashboard/settings" replace />,
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
              { path: "analytics", element: <LazyPage component={SchoolAnalyticsPage} /> },
              { path: "compliance", element: <LazyPage component={SchoolCompliancePage} /> },
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
              { path: "patents", element: <LazyPage component={CollegePatentsPage} /> },
              { path: "patents/:patentId", element: <LazyPage component={CollegePatentsPage} /> },
              { path: "startups", element: <LazyPage component={CollegeStartupsPage} /> },
              { path: "startups/:startupId", element: <LazyPage component={CollegeStartupsPage} /> },
              { path: "students", element: <LazyPage component={CollegeStudentLeaderboard} /> },
              { path: "students/:id", element: <LazyPage component={CollegeStudentLeaderboard} /> },
              { path: "recruiters", element: <LazyPage component={RecruiterDirectory} /> },
              { path: "investors", element: <LazyPage component={CollegeInvestorDirectory} /> },
              { path: "mentors", element: <LazyPage component={CollegeMentorshipPage} /> },
              { path: "placement", element: <LazyPage component={PlacementTracker} /> },
              { path: "placement/:view", element: <LazyPage component={PlacementTracker} /> },
              { path: "events", element: <LazyPage component={EventManager} /> },
              { path: "analytics", element: <LazyPage component={CollegeAnalyticsPage} /> },
              { path: "compliance", element: <LazyPage component={CollegeCompliancePage} /> },
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
