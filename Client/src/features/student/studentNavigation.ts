export interface StudentSectionLink {
  label: string;
  path: string;
  matchMode?: "exact" | "prefix";
}

export const STUDENT_SECTION_LINKS: ReadonlyArray<StudentSectionLink> = [
  { label: "Dashboard", path: "/dashboard/student", matchMode: "exact" },
  { label: "Mentor Sessions", path: "/dashboard/student/mentor-sessions" },
  { label: "Portfolio", path: "/portfolio" },
  { label: "Marketplace", path: "/marketplace" },
];

export const isStudentSectionActive = (pathname: string, link: StudentSectionLink) =>
  link.matchMode === "exact"
    ? pathname === link.path
    : pathname === link.path || pathname.startsWith(`${link.path}/`);
