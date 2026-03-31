import { FormEvent, useState } from "react";
import { isAxiosError } from "axios";
import {
  GraduationCap,
  Lock,
  Mail,
  NotebookPen,
  Ticket,
  UserCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BusinessLogo } from "../../components/branding/BusinessLogo";
import { useSignupMutation } from "./useAuth";
import { UserRole } from "../../types/roles.types";
import { roleRedirect } from "../../utils/roleRedirect";

type SignupFormState = {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  institutionToken: string;
  domain: string;
  bio: string;
};

const initialFormState: SignupFormState = {
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
  institutionToken: "",
  domain: "",
  bio: "",
};

export function SignupPage() {
  const navigate = useNavigate();
  const signupMutation = useSignupMutation();
  const [formData, setFormData] = useState<SignupFormState>(initialFormState);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateField = <K extends keyof SignupFormState>(
    key: K,
    value: SignupFormState[K],
  ) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!formData.institutionToken.trim()) {
      setError("Student signup requires an institution token.");
      return;
    }

    try {
      const payload = await signupMutation.mutateAsync({
        displayName: formData.displayName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: UserRole.STUDENT,
        institutionToken: formData.institutionToken.trim(),
        ...(formData.domain.trim() ? { domain: formData.domain.trim() } : {}),
        ...(formData.bio.trim() ? { bio: formData.bio.trim() } : {}),
      });

      if ("pendingApproval" in payload) {
        setNotice(payload.message);
        setFormData({
          ...initialFormState,
          email: formData.email,
        });
        return;
      }

      navigate(roleRedirect(payload.user.role), { replace: true });
    } catch (submissionError) {
      if (isAxiosError(submissionError)) {
        const apiError = submissionError.response?.data?.error;
        const detailMessage = apiError?.details?.[0]
          ? `${apiError.details[0].path ? `${apiError.details[0].path}: ` : ""}${apiError.details[0].message}`
          : undefined;

        setError(
          apiError?.code === "INSTITUTION_TOKEN_EXPIRED"
              ? "That institution token has expired. Please ask your school or college for a fresh one."
              : apiError?.code === "INSTITUTION_TOKEN_REQUIRED"
                ? "Student signup requires an institution token."
                : apiError?.code === "INSTITUTION_APPROVAL_PENDING"
                  ? "Your institution has not approved your account yet. Please contact your school or college."
                  : apiError?.code === "INSTITUTION_TOKEN_MISMATCH"
                    ? "This email is already linked to a different institution. Use the correct token or contact your institution."
                    : apiError?.code === "INVALID_INSTITUTION_TOKEN"
                      ? "That institution token is invalid. Please check with your school or college."
                      : (detailMessage ??
                        apiError?.message ??
                        "Unable to create your account right now."),
        );
        return;
      }

      setError("Unable to create your account right now.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="mx-auto w-full max-w-4xl py-8">
        <div className="mb-8 text-center">
          <BusinessLogo
            to="/"
            className="mb-6"
            titleClassName="text-2xl text-white"
            subtitleClassName="text-slate-400"
          />
          <h1 className="mb-2 text-3xl font-bold text-white">
            Create Your Account
          </h1>
          <p className="text-slate-400">Student registration starts here</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-8"
        >
          <div className="mb-6">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
              Student Registration
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Public registration is available only for students with a valid
              institution token.
            </p>
          </div>

          <div className="mb-6">
            <h2 className="mb-4 text-xl font-bold text-white">
              Account Information
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Student Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <UserCircle className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(event) =>
                      updateField("displayName", event.target.value)
                    }
                    placeholder="Sarah Chen"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      updateField("email", event.target.value)
                    }
                    placeholder="name@example.com"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(event) =>
                      updateField("password", event.target.value)
                    }
                    placeholder="********"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(event) =>
                      updateField("confirmPassword", event.target.value)
                    }
                    placeholder="********"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Password must be at least 8 characters long
            </p>
          </div>

          <div className="mb-6">
            <h2 className="mb-4 text-xl font-bold text-white">
              Student Details
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Innovation Domain
                </label>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.domain}
                    onChange={(event) =>
                      updateField("domain", event.target.value)
                    }
                    placeholder="AgriTech, AI, HealthTech"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Short Bio
                </label>
                <div className="relative">
                  <NotebookPen className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <textarea
                    value={formData.bio}
                    onChange={(event) => updateField("bio", event.target.value)}
                    placeholder="Tell us what you are building or exploring"
                    className="min-h-[108px] w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-white">
              Institution Token <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Ticket className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={formData.institutionToken}
                onChange={(event) =>
                  updateField("institutionToken", event.target.value)
                }
                placeholder="SCH-AB12CD34"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Use the institution token shared by your school or college. It is
              required for student signup.
            </p>
            <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
              Your student account will stay pending until your institution
              approves it.
            </div>
          </div>

          <div className="mb-6">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-400">
                I agree to the{" "}
                <span className="font-semibold text-blue-500">
                  Terms of Service
                </span>{" "}
                and{" "}
                <span className="font-semibold text-blue-500">
                  Privacy Policy
                </span>
              </span>
            </label>
          </div>

          {error ? (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              {notice}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={signupMutation.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-lg font-semibold text-white transition-all hover:from-blue-700 hover:to-purple-700 disabled:opacity-70"
          >
            {signupMutation.isPending
              ? "Creating Student Account..."
              : "Create Student Account"}
          </button>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-blue-500 hover:text-blue-400"
            >
              Sign in
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-slate-400">
            Not a student?{" "}
            <Link
              to="/request-access"
              className="font-semibold text-blue-500 hover:text-blue-400"
            >
              Request Access (Non-Student)
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
