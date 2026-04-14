import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  GraduationCap,
  Info,
  Mail,
  NotebookPen,
  Ticket,
  UserCircle,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { BusinessLogo } from "../../components/branding/BusinessLogo";
import { AuthPasswordField } from "./AuthPasswordField";
import { useSignupMutation } from "./useAuth";
import { UserRole } from "../../types/roles.types";
import { roleRedirect } from "../../utils/roleRedirect";
import {
  getInvitationRoleLabel,
  normalizeInvitationRole,
} from "../invitations/invitationConfig";

type SignupFormState = {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  institutionToken: string;
  domain: string;
  bio: string;
  termsAccepted: boolean;
};

const initialFormState: SignupFormState = {
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
  institutionToken: "",
  domain: "",
  bio: "",
  termsAccepted: false,
};

const signupSchema = z
  .object({
    displayName: z.string().trim().min(1, "Student name is required."),
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long."),
    confirmPassword: z.string().min(1, "Confirm your password."),
    institutionToken: z
      .string()
      .trim()
      .min(1, "Enter the invitation token shared by your school or college."),
    domain: z.string(),
    bio: z.string(),
    termsAccepted: z.literal(true, {
      errorMap: () => ({
        message: "You must agree to the Terms of Service and Privacy Policy.",
      }),
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const signupMutation = useSignupMutation();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<SignupFormState>({
    resolver: zodResolver(signupSchema),
    defaultValues: initialFormState,
  });
  const invitedRole = normalizeInvitationRole(searchParams.get("inviteRole"));
  const invitedEmail = searchParams.get("inviteeEmail")?.trim() ?? "";
  const invitedInstitutionToken =
    searchParams.get("institutionToken")?.trim() ??
    searchParams.get("token")?.trim() ??
    "";
  const isInviteFlow = Boolean(invitedInstitutionToken);
  const inviterName = searchParams.get("inviterName")?.trim() ?? "";
  const invitePurpose = searchParams.get("purpose")?.trim() ?? "";
  const requestAccessLink = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    return `/request-access${next.toString() ? `?${next.toString()}` : ""}`;
  }, [searchParams]);
  const formData = watch();

  useEffect(() => {
    if (invitedEmail) {
      setValue("email", invitedEmail, { shouldDirty: false });
    }

    if (invitedInstitutionToken) {
      setValue("institutionToken", invitedInstitutionToken, {
        shouldDirty: false,
      });
    }
  }, [invitedEmail, invitedInstitutionToken, setValue]);

  const onSubmit = async (values: SignupFormState) => {
    setError("");
    setNotice("");

    try {
      const payload = await signupMutation.mutateAsync({
        displayName: values.displayName.trim(),
        email: values.email.trim(),
        password: values.password,
        role: UserRole.STUDENT,
        institutionToken: values.institutionToken.trim(),
        ...(values.domain.trim() ? { domain: values.domain.trim() } : {}),
        ...(values.bio.trim() ? { bio: values.bio.trim() } : {}),
      });

      if ("pendingApproval" in payload) {
        setNotice(payload.message);
        reset({
          ...initialFormState,
          email: values.email,
          institutionToken: values.institutionToken,
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
            : apiError?.code === "INSTITUTION_APPROVAL_PENDING"
              ? "Your institution has not approved your account yet. Please contact your school or college."
              : apiError?.code === "VALIDATION_ERROR" &&
                  detailMessage?.includes("institutionToken")
                ? "Enter the invitation token shared by your school or college."
                : apiError?.code === "INSTITUTION_TOKEN_MISMATCH"
                  ? "This email is already linked to a different institution. Use the correct token or contact your institution."
                  : apiError?.code === "INVALID_INSTITUTION_TOKEN"
                    ? "That institution token is invalid. Please check with your school or college."
                    : detailMessage ??
                      apiError?.message ??
                      "Unable to create your account right now.",
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
          <p className="text-slate-400">
            {isInviteFlow
              ? "Use your invitation to complete student registration"
              : "Student registration starts here"}
          </p>
        </div>

        {invitedRole === UserRole.STUDENT ? (
          <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5 text-sm text-cyan-100">
            <div className="text-xs uppercase tracking-[0.28em] text-cyan-300">
              Invitation received
            </div>
            <div className="mt-2 text-base font-semibold text-white">
              {inviterName || "A ProMove member"} invited you to join as a{" "}
              {getInvitationRoleLabel(UserRole.STUDENT)}.
            </div>
            {invitePurpose ? (
              <p className="mt-2 leading-6 text-cyan-100/90">{invitePurpose}</p>
            ) : null}
          </div>
        ) : null}

        {invitedRole && invitedRole !== UserRole.STUDENT ? (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">
            <div className="text-xs uppercase tracking-[0.28em] text-amber-300">
              Different access flow
            </div>
            <div className="mt-2 text-base font-semibold text-white">
              This invite is for {getInvitationRoleLabel(invitedRole)} access, not
              student signup.
            </div>
            <Link
              to={requestAccessLink}
              className="mt-3 inline-flex text-sm font-semibold text-amber-200 underline"
            >
              Continue to request access
            </Link>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="rounded-2xl border border-slate-800 bg-slate-900 p-8"
        >
          <div className="mb-6">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
              Student Registration
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Students can register only with a school or college invitation
              token. If your email matches a roster invite, your dashboard is
              ready immediately after signup. Token-only signups still wait for
              institution approval.
            </p>
          </div>

          <div className="mb-6">
            <h2 className="mb-4 text-xl font-bold text-white">
              Account Information
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="signup-display-name"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Student Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <UserCircle className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="signup-display-name"
                    type="text"
                    {...register("displayName")}
                    placeholder="Sarah Chen"
                    className={`w-full rounded-lg border bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none ${
                      errors.displayName ? "border-red-500/70" : "border-slate-800"
                    }`}
                  />
                </div>
                {errors.displayName ? (
                  <p className="mt-2 text-sm text-red-500">
                    {errors.displayName.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    {...register("email")}
                    placeholder="name@example.com"
                    className={`w-full rounded-lg border bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none ${
                      errors.email ? "border-red-500/70" : "border-slate-800"
                    }`}
                    disabled={Boolean(invitedEmail)}
                  />
                </div>
                {invitedEmail ? (
                  <p className="mt-2 text-xs text-slate-500">
                    This email is locked to your invitation.
                  </p>
                ) : null}
                {errors.email ? (
                  <p className="mt-2 text-sm text-red-500">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>

              <div>
                <Controller
                  name="password"
                  control={control}
                  render={({ field }) => (
                    <>
                      <AuthPasswordField
                        id="signup-password"
                        label="Password *"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        placeholder="Create a strong password"
                        labelClassName="mb-2 block text-sm font-semibold text-white"
                        inputClassName={`w-full rounded-lg border bg-slate-950 py-3 pl-4 pr-12 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none ${
                          errors.password ? "border-red-500/70" : "border-slate-800"
                        }`}
                        autoComplete="new-password"
                      />
                      {errors.password ? (
                        <p className="mt-2 text-sm text-red-500">
                          {errors.password.message}
                        </p>
                      ) : null}
                    </>
                  )}
                />
              </div>

              <div>
                <Controller
                  name="confirmPassword"
                  control={control}
                  render={({ field }) => (
                    <>
                      <AuthPasswordField
                        id="signup-confirm-password"
                        label="Confirm Password *"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                        placeholder="Repeat your password"
                        labelClassName="mb-2 block text-sm font-semibold text-white"
                        inputClassName={`w-full rounded-lg border bg-slate-950 py-3 pl-4 pr-12 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none ${
                          errors.confirmPassword ? "border-red-500/70" : "border-slate-800"
                        }`}
                        autoComplete="new-password"
                      />
                      {errors.confirmPassword ? (
                        <p className="mt-2 text-sm text-red-500">
                          {errors.confirmPassword.message}
                        </p>
                      ) : null}
                    </>
                  )}
                />
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
                <label
                  htmlFor="signup-domain"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Innovation Domain
                </label>
                <div className="relative">
                  <GraduationCap className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="signup-domain"
                    type="text"
                    {...register("domain")}
                    placeholder="AgriTech, AI, HealthTech"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="signup-bio"
                  className="mb-2 block text-sm font-semibold text-white"
                >
                  Short Bio
                </label>
                <div className="relative">
                  <NotebookPen className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                  <textarea
                    id="signup-bio"
                    {...register("bio")}
                    placeholder="Tell us what you are building or exploring"
                    className="min-h-[108px] w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label
              htmlFor="signup-token"
              className="mb-2 block text-sm font-semibold text-white"
            >
              Institution Token <span className="text-red-400">*</span>
            </label>
            {isInviteFlow ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-300">
                Your invitation includes the institution token. You do not need to enter it.
                <div className="mt-3 font-mono text-xs text-cyan-300">
                  {formData.institutionToken}
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Ticket className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="signup-token"
                    type="text"
                    spellCheck={false}
                    {...register("institutionToken")}
                    placeholder="SCH-AB12CD34"
                    className={`w-full rounded-lg border bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none ${
                      errors.institutionToken ? "border-red-500/70" : "border-slate-800"
                    }`}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Use the token issued from your school or college dashboard.
                </p>
                {errors.institutionToken ? (
                  <p className="mt-2 text-sm text-red-500">
                    {errors.institutionToken.message}
                  </p>
                ) : null}
              </>
            )}
            <div
              role="alert"
              className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-cyan-50"
            >
              <Info className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-semibold text-cyan-50">
                  How activation works
                </div>
                <p className="mt-1 text-sm text-cyan-100/90">
                  Matching roster invites activate immediately. Students who
                  only have a token still move into the institution review
                  queue.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                {...register("termsAccepted")}
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
            {errors.termsAccepted ? (
              <p className="mt-2 text-sm text-red-500">
                {errors.termsAccepted.message}
              </p>
            ) : null}
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
