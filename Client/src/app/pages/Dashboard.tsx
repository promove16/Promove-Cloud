import { useAuth } from "../context/AuthContext";
import { DashboardLayout } from "../components/DashboardLayout";
import { StudentDashboard } from "./dashboards/StudentDashboard";
import { SchoolDashboard } from "./dashboards/SchoolDashboard";
import { MentorDashboard } from "./dashboards/MentorDashboard";
import { InvestorDashboard } from "./dashboards/InvestorDashboard";
import { RecruiterDashboard } from "./dashboards/RecruiterDashboard";
import { AdminDashboard } from "./dashboards/AdminDashboard";

export function Dashboard() {
  const { user } = useAuth();

  const getRoleForLayout = (): "student" | "school" | "college" | "mentor" | "admin" | "investor" | "recruiter" => {
    if (!user?.role) return "student";
    if (user.role === "school") return "school";
    if (user.role === "college") return "college";
    if (user.role === "mentor") return "mentor";
    if (user.role === "investor") return "investor";
    if (user.role === "company" || user.role === "recruiter") return "recruiter";
    if (user.role === "admin") return "admin";
    return "student";
  };

  const renderDashboardContent = () => {
    switch (user?.role) {
      case "student":
        return <StudentDashboard />;
      case "school":
      case "college":
        return <SchoolDashboard />;
      case "mentor":
        return <MentorDashboard />;
      case "investor":
        return <InvestorDashboard />;
      case "company":
      case "recruiter":
        return <RecruiterDashboard />;
      case "admin":
        return <AdminDashboard />;
      default:
        return <StudentDashboard />;
    }
  };

  return (
    <DashboardLayout role={getRoleForLayout()}>
      {renderDashboardContent()}
    </DashboardLayout>
  );
}
