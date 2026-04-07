import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BusinessLogo } from "../../components/branding/BusinessLogo";
import { AuthPasswordField } from "./AuthPasswordField";
import { useRegisterRequestMutation } from "./useAuth";
import {
  InstitutionRegulatoryBody,
  InstitutionVerificationDocumentCategory,
} from "../../types/auth.types";
import { UserRole } from "../../types/roles.types";
import {
  getInvitationRoleLabel,
  normalizeInvitationRole,
} from "../invitations/invitationConfig";

const NON_STUDENT_ROLES = [
  UserRole.MENTOR,
  UserRole.RECRUITER,
  UserRole.INVESTOR,
  UserRole.ADMIN,
  UserRole.SCHOOL,
  UserRole.COLLEGE,
];

const isInstitutionRoleValue = (
  role: UserRole | string,
): role is UserRole.SCHOOL | UserRole.COLLEGE =>
  role === UserRole.SCHOOL || role === UserRole.COLLEGE;

const INSTITUTION_DOCUMENT_LABELS: Record<
  InstitutionVerificationDocumentCategory,
  string
> = {
  governing_body_registration_certificate:
    "Governing body registration or trust/society incorporation proof",
  authorized_signatory_letter: "Authorized signatory letter on institution letterhead",
  address_proof: "Institution address proof",
  pan_or_tax_registration: "PAN or tax registration proof",
  recognition_certificate: "Recognition certificate",
  board_affiliation_certificate: "Board affiliation certificate",
  udise_certificate: "UDISE code proof or school report card",
  affiliation_letter: "University or board affiliation letter",
  aicte_approval_letter: "AICTE approval / Extension of Approval letter",
  ugc_recognition_letter: "UGC recognition letter",
  accreditation_certificate: "NAAC / NBA accreditation certificate",
};

const regulatoryOptionsByRole: Record<
  UserRole.SCHOOL | UserRole.COLLEGE,
  InstitutionRegulatoryBody[]
> = {
  [UserRole.SCHOOL]: ["CBSE", "ICSE", "STATE_BOARD", "STATE_EDUCATION_DEPARTMENT", "UDISE"],
  [UserRole.COLLEGE]: ["AICTE", "UGC", "NAAC", "NBA"],
};

const getRequiredInstitutionDocuments = (
  role: UserRole.SCHOOL | UserRole.COLLEGE,
  regulatoryBodies: InstitutionRegulatoryBody[],
) => {
  const required = new Set<InstitutionVerificationDocumentCategory>([
    "governing_body_registration_certificate",
    "authorized_signatory_letter",
    "address_proof",
    "pan_or_tax_registration",
  ]);

  if (role === UserRole.SCHOOL) {
    required.add("recognition_certificate");
    required.add("board_affiliation_certificate");
    required.add("udise_certificate");
  }

  if (role === UserRole.COLLEGE) {
    required.add("affiliation_letter");
  }

  if (regulatoryBodies.includes("AICTE")) {
    required.add("aicte_approval_letter");
  }

  if (regulatoryBodies.includes("UGC")) {
    required.add("ugc_recognition_letter");
  }

  if (regulatoryBodies.includes("NAAC") || regulatoryBodies.includes("NBA")) {
    required.add("accreditation_certificate");
  }

  return Array.from(required);
};

type FormState = {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  domain: string;
  bio: string;
  institutionName: string;
  location: string;
  totalStudentsEnrolled: string;
  academicYear: string;
  iicStarRating: string;
  affiliationName: string;
  websiteUrl: string;
  referenceCode: string;
  verificationNotes: string;
};

const initialFormState: FormState = {
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "",
  domain: "",
  bio: "",
  institutionName: "",
  location: "",
  totalStudentsEnrolled: "",
  academicYear: "",
  iicStarRating: "0",
  affiliationName: "",
  websiteUrl: "",
  referenceCode: "",
  verificationNotes: "",
};

export function RequestAccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const registerRequestMutation = useRegisterRequestMutation();
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [regulatoryBodies, setRegulatoryBodies] = useState<
    InstitutionRegulatoryBody[]
  >([]);
  const [documentFiles, setDocumentFiles] = useState<
    Partial<Record<InstitutionVerificationDocumentCategory, File>>
  >({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const invitedRole = normalizeInvitationRole(searchParams.get("inviteRole"));
  const invitedEmail = searchParams.get("inviteeEmail")?.trim() ?? "";
  const inviterName = searchParams.get("inviterName")?.trim() ?? "";
  const invitePurpose = searchParams.get("purpose")?.trim() ?? "";
  const signupLink = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    return `/signup${next.toString() ? `?${next.toString()}` : ""}`;
  }, [searchParams]);

  const selectedRole = formData.role as UserRole;
  const isInstitutionRole = isInstitutionRoleValue(selectedRole);
  const regulatoryOptions = isInstitutionRole
    ? regulatoryOptionsByRole[selectedRole]
    : [];

  const requiredInstitutionDocuments = useMemo(() => {
    if (!isInstitutionRole) {
      return [];
    }

    return getRequiredInstitutionDocuments(selectedRole, regulatoryBodies);
  }, [isInstitutionRole, regulatoryBodies, selectedRole]);

  useEffect(() => {
    if (invitedRole && invitedRole !== UserRole.STUDENT) {
      setFormData((current) =>
        current.role === invitedRole ? current : { ...current, role: invitedRole },
      );
    }
  }, [invitedRole]);

  useEffect(() => {
    if (!invitedEmail) {
      return;
    }

    setFormData((current) =>
      current.email === invitedEmail ? current : { ...current, email: invitedEmail },
    );
  }, [invitedEmail]);

  const updateField = (key: keyof FormState, value: string) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const handleRoleChange = (role: string) => {
    setFormData((current) => ({ ...current, role }));
    setError("");
    setNotice("");
    setRegulatoryBodies([]);
    setDocumentFiles({});
  };

  const toggleRegulatoryBody = (body: InstitutionRegulatoryBody) => {
    setRegulatoryBodies((current) =>
      current.includes(body)
        ? current.filter((item) => item !== body)
        : [...current, body],
    );
  };

  const handleFileChange =
    (category: InstitutionVerificationDocumentCategory) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      setDocumentFiles((current) => {
        if (!file) {
          const next = { ...current };
          delete next[category];
          return next;
        }

        return {
          ...current,
          [category]: file,
        };
      });
    };

  const buildInstitutionRequestPayload = () => {
    const missingCategories = requiredInstitutionDocuments.filter(
      (category) => !documentFiles[category],
    );

    if (missingCategories.length > 0) {
      setError(
        `Upload all required institution documents before submitting. Missing: ${missingCategories
          .map((category) => INSTITUTION_DOCUMENT_LABELS[category])
          .join(", ")}`,
      );
      return null;
    }

    const totalStudents = Number(formData.totalStudentsEnrolled);
    if (!Number.isFinite(totalStudents) || totalStudents < 1) {
      setError("Total students enrolled must be at least 1.");
      return null;
    }

    const payload = new FormData();
    payload.append("displayName", formData.displayName.trim());
    payload.append("email", formData.email.trim());
    payload.append("password", formData.password);
    payload.append("role", selectedRole);
    if (formData.domain.trim()) {
      payload.append("domain", formData.domain.trim());
    }
    if (formData.bio.trim()) {
      payload.append("bio", formData.bio.trim());
    }

    payload.append(
      "institutionProfile",
      JSON.stringify({
        institutionName: formData.institutionName.trim(),
        location: formData.location.trim(),
        totalStudentsEnrolled: totalStudents,
        academicYear: formData.academicYear.trim(),
        iicStarRating: Number(formData.iicStarRating || "0"),
      }),
    );

    payload.append(
      "institutionVerification",
      JSON.stringify({
        regulatoryBodies,
        ...(formData.affiliationName.trim()
          ? { affiliationName: formData.affiliationName.trim() }
          : {}),
        ...(formData.websiteUrl.trim()
          ? { websiteUrl: formData.websiteUrl.trim() }
          : {}),
        ...(formData.referenceCode.trim()
          ? { referenceCode: formData.referenceCode.trim() }
          : {}),
        ...(formData.verificationNotes.trim()
          ? { notes: formData.verificationNotes.trim() }
          : {}),
      }),
    );

    requiredInstitutionDocuments.forEach((category) => {
      const file = documentFiles[category];
      if (file) {
        payload.append(`institutionDocument:${category}`, file, file.name);
      }
    });

    return payload;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!formData.role || !NON_STUDENT_ROLES.includes(formData.role as UserRole)) {
      setError("Please select a valid role.");
      return;
    }

    try {
      const payload = isInstitutionRole
        ? buildInstitutionRequestPayload()
        : {
            displayName: formData.displayName.trim(),
            email: formData.email.trim(),
            password: formData.password,
            role: selectedRole,
            domain: formData.domain.trim(),
            bio: formData.bio.trim(),
          };

      if (!payload) {
        return;
      }

      const response = await registerRequestMutation.mutateAsync(payload);
      if ("pendingApproval" in response) {
        setNotice(
          response.message ||
            "Your request has been submitted for admin approval.",
        );
        setFormData({ ...initialFormState, email: formData.email });
        setRegulatoryBodies([]);
        setDocumentFiles({});
        return;
      }

      navigate("/login");
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else {
        setError("An error occurred. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-10">
      <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-800 bg-white p-6 shadow-xl shadow-slate-950/20">
        <BusinessLogo
          to="/"
          className="mb-6"
          titleClassName="text-2xl text-slate-950"
          subtitleClassName="text-slate-500"
        />
        {invitedRole && invitedRole !== UserRole.STUDENT ? (
          <div className="mb-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm text-cyan-950">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
              Invitation received
            </div>
            <div className="mt-2 text-base font-semibold text-slate-950">
              {inviterName || "A ProMove member"} invited you to request{" "}
              {getInvitationRoleLabel(invitedRole)} access.
            </div>
            {invitePurpose ? (
              <p className="mt-2 leading-6 text-slate-700">{invitePurpose}</p>
            ) : null}
          </div>
        ) : null}
        {invitedRole === UserRole.STUDENT ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              Student invite detected
            </div>
            <div className="mt-2 text-base font-semibold text-slate-950">
              Student invitations use the direct signup flow instead of request
              access.
            </div>
            <Link to={signupLink} className="mt-3 inline-flex font-semibold text-amber-700 underline">
              Continue to student signup
            </Link>
          </div>
        ) : null}
        <h2 className="mb-2 text-2xl font-bold text-slate-950">
          Request Access (Non-Student)
        </h2>
        <p className="mb-5 text-sm text-slate-600">
          Mentors, recruiters, investors, schools, and colleges are approved by
          the ProMove admin team before access is enabled.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              type="text"
              placeholder="Full Name"
              value={formData.displayName}
              onChange={(e) => updateField("displayName", e.target.value)}
              className="w-full rounded border border-slate-300 p-2.5 text-slate-950"
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full rounded border border-slate-300 p-2.5 text-slate-950"
              required
            />
            <AuthPasswordField
              value={formData.password}
              onChange={(e) => updateField("password", e.target.value)}
              placeholder="Password"
              inputClassName="w-full rounded border border-slate-300 p-2.5 pr-12 text-slate-950"
              required
              autoComplete="new-password"
            />
            <AuthPasswordField
              value={formData.confirmPassword}
              onChange={(e) => updateField("confirmPassword", e.target.value)}
              placeholder="Confirm Password"
              inputClassName="w-full rounded border border-slate-300 p-2.5 pr-12 text-slate-950"
              required
              autoComplete="new-password"
            />
          </div>

          <select
            value={formData.role}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="mt-2 w-full rounded border border-slate-300 p-2.5 text-slate-950"
            required
          >
            <option value="">Select Role</option>
            {NON_STUDENT_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder={
              isInstitutionRole
                ? "Focus area or institution type"
                : "Domain or focus area"
            }
            value={formData.domain}
            onChange={(e) => updateField("domain", e.target.value)}
            className="mt-2 w-full rounded border border-slate-300 p-2.5 text-slate-950"
          />

          <textarea
            placeholder="Bio or summary"
            value={formData.bio}
            onChange={(e) => updateField("bio", e.target.value)}
            className="mt-2 min-h-28 w-full rounded border border-slate-300 p-2.5 text-slate-950"
          />

          {isInstitutionRole ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Institution Verification
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Upload the legal and regulatory documents used to verify your
                school or college account for partnership access.
              </p>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <input
                  type="text"
                  placeholder="Institution name"
                  value={formData.institutionName}
                  onChange={(e) => updateField("institutionName", e.target.value)}
                  className="w-full rounded border border-slate-300 p-2.5 text-slate-950"
                  required
                />
                <input
                  type="text"
                  placeholder="Location"
                  value={formData.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  className="w-full rounded border border-slate-300 p-2.5 text-slate-950"
                  required
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Total students enrolled"
                  value={formData.totalStudentsEnrolled}
                  onChange={(e) =>
                    updateField("totalStudentsEnrolled", e.target.value)
                  }
                  className="w-full rounded border border-slate-300 p-2.5 text-slate-950"
                  required
                />
                <input
                  type="text"
                  placeholder="Academic year (e.g. 2025-26)"
                  value={formData.academicYear}
                  onChange={(e) => updateField("academicYear", e.target.value)}
                  className="w-full rounded border border-slate-300 p-2.5 text-slate-950"
                  required
                />
                <input
                  type="text"
                  placeholder={
                    selectedRole === UserRole.SCHOOL
                      ? "Board / affiliation name"
                      : "University / affiliation name"
                  }
                  value={formData.affiliationName}
                  onChange={(e) => updateField("affiliationName", e.target.value)}
                  className="w-full rounded border border-slate-300 p-2.5 text-slate-950"
                />
                <input
                  type="text"
                  placeholder={
                    selectedRole === UserRole.SCHOOL
                      ? "UDISE or internal reference code"
                      : "AISHE or internal reference code"
                  }
                  value={formData.referenceCode}
                  onChange={(e) => updateField("referenceCode", e.target.value)}
                  className="w-full rounded border border-slate-300 p-2.5 text-slate-950"
                />
              </div>

              {selectedRole === UserRole.COLLEGE ? (
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  placeholder="IIC star rating"
                  value={formData.iicStarRating}
                  onChange={(e) => updateField("iicStarRating", e.target.value)}
                  className="mt-2 w-full rounded border border-slate-300 p-2.5 text-slate-950"
                />
              ) : null}

              <textarea
                placeholder="Verification notes for the admin team (optional)"
                value={formData.verificationNotes}
                onChange={(e) =>
                  updateField("verificationNotes", e.target.value)
                }
                className="mt-2 min-h-24 w-full rounded border border-slate-300 p-2.5 text-slate-950"
              />

              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-900">
                  Applicable regulators / boards
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {regulatoryOptions.map((body) => {
                    const checked = regulatoryBodies.includes(body);
                    return (
                      <label
                        key={body}
                        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm ${
                          checked
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRegulatoryBody(body)}
                          className="h-4 w-4"
                        />
                        {body}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <div className="text-sm font-semibold text-slate-900">
                  Required documents
                </div>
                <div className="mt-3 grid gap-3">
                  {requiredInstitutionDocuments.map((category) => (
                    <label
                      key={category}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="text-sm font-medium text-slate-900">
                        {INSTITUTION_DOCUMENT_LABELS[category]}
                      </div>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={handleFileChange(category)}
                        className="mt-2 block w-full text-sm text-slate-700"
                        required
                      />
                      {documentFiles[category] ? (
                        <div className="mt-2 text-xs text-emerald-700">
                          Selected: {documentFiles[category]?.name}
                        </div>
                      ) : null}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-600">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
              {notice}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={registerRequestMutation.isPending}
            className="mt-5 w-full rounded bg-blue-600 p-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-70"
          >
            {registerRequestMutation.isPending
              ? "Submitting Request..."
              : "Submit Request"}
          </button>
        </form>
        <div className="mt-4 text-center">
          <Link to="/login" className="font-medium text-blue-600 underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
