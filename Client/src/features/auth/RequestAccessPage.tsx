import { FormEvent, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
import { BusinessLogo } from "../../components/branding/BusinessLogo";
import { useRegisterRequestMutation } from "./useAuth";
import { UserRole } from "../../types/roles.types";

const NON_STUDENT_ROLES = [
  UserRole.MENTOR,
  UserRole.RECRUITER,
  UserRole.INVESTOR,
  UserRole.ADMIN,
  UserRole.SCHOOL,
  UserRole.COLLEGE,
];

const initialFormState = {
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "",
  domain: "",
  bio: "",
};

export function RequestAccessPage() {
  const navigate = useNavigate();
  const registerRequestMutation = useRegisterRequestMutation();
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateField = (key: keyof typeof initialFormState, value: string) => {
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
    if (!formData.role || !NON_STUDENT_ROLES.includes(formData.role as UserRole)) {
      setError("Please select a valid role.");
      return;
    }
    try {
      const payload = await registerRequestMutation.mutateAsync({
        displayName: formData.displayName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role as UserRole,
        domain: formData.domain.trim(),
        bio: formData.bio.trim(),
      });
      if ("pendingApproval" in payload) {
        setNotice(
          payload.message ||
            "Your request has been submitted for admin approval.",
        );
        setFormData({ ...initialFormState, email: formData.email });
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
      <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-800 bg-white p-6 shadow-xl shadow-slate-950/20">
        <BusinessLogo
          to="/"
          className="mb-6"
          titleClassName="text-2xl text-slate-950"
          subtitleClassName="text-slate-500"
        />
        <h2 className="mb-2 text-2xl font-bold text-slate-950">Request Access (Non-Student)</h2>
        <p className="mb-5 text-sm text-slate-600">
          Share your role and background so the ProMove team can approve the right workspace access.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Full Name"
            value={formData.displayName}
            onChange={(e) => updateField("displayName", e.target.value)}
            className="mb-2 w-full rounded border border-slate-300 p-2.5 text-slate-950"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => updateField("email", e.target.value)}
            className="mb-2 w-full rounded border border-slate-300 p-2.5 text-slate-950"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => updateField("password", e.target.value)}
            className="mb-2 w-full rounded border border-slate-300 p-2.5 text-slate-950"
            required
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={(e) => updateField("confirmPassword", e.target.value)}
            className="mb-2 w-full rounded border border-slate-300 p-2.5 text-slate-950"
            required
          />
          <select
            value={formData.role}
            onChange={(e) => updateField("role", e.target.value)}
            className="mb-2 w-full rounded border border-slate-300 p-2.5 text-slate-950"
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
            placeholder="Domain (optional)"
            value={formData.domain}
            onChange={(e) => updateField("domain", e.target.value)}
            className="mb-2 w-full rounded border border-slate-300 p-2.5 text-slate-950"
          />
          <textarea
            placeholder="Bio (optional)"
            value={formData.bio}
            onChange={(e) => updateField("bio", e.target.value)}
            className="mb-2 min-h-28 w-full rounded border border-slate-300 p-2.5 text-slate-950"
          />
          {error && <div className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-600">{error}</div>}
          {notice && <div className="mb-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">{notice}</div>}
          <button
            type="submit"
            className="w-full rounded bg-blue-600 p-2.5 font-semibold text-white transition hover:bg-blue-700"
          >
            Submit Request
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
