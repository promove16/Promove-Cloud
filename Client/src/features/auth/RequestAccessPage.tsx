import { FormEvent, useState } from "react";
import { isAxiosError } from "axios";
import { Link, useNavigate } from "react-router-dom";
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
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Request Access (Non-Student)</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Full Name"
          value={formData.displayName}
          onChange={(e) => updateField("displayName", e.target.value)}
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => updateField("email", e.target.value)}
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) => updateField("password", e.target.value)}
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={formData.confirmPassword}
          onChange={(e) => updateField("confirmPassword", e.target.value)}
          className="w-full mb-2 p-2 border rounded"
          required
        />
        <select
          value={formData.role}
          onChange={(e) => updateField("role", e.target.value)}
          className="w-full mb-2 p-2 border rounded"
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
          className="w-full mb-2 p-2 border rounded"
        />
        <textarea
          placeholder="Bio (optional)"
          value={formData.bio}
          onChange={(e) => updateField("bio", e.target.value)}
          className="w-full mb-2 p-2 border rounded"
        />
        {error && <div className="text-red-600 mb-2">{error}</div>}
        {notice && <div className="text-green-600 mb-2">{notice}</div>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded"
        >
          Submit Request
        </button>
      </form>
      <div className="mt-4 text-center">
        <Link to="/login" className="text-blue-600 underline">
          Back to Login
        </Link>
      </div>
    </div>
  );
}
