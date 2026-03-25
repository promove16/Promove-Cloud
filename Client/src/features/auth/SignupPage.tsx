import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  GraduationCap,
  Lock,
  Mail,
  MapPin,
  NotebookPen,
  Rocket,
  Ticket,
  UserCircle,
  Users,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { RoleSelector } from './RoleSelector';
import { useSignupMutation } from './useAuth';
import { UserRole } from '../../types/roles.types';
import { roleRedirect } from '../../utils/roleRedirect';

const ROLE_COPY: Record<
  UserRole,
  {
    displayNameLabel: string;
    displayNamePlaceholder: string;
    institutionTokenPlaceholder?: string;
    institutionTokenHelp?: string;
    domainLabel?: string;
    domainPlaceholder?: string;
    bioLabel?: string;
    bioPlaceholder?: string;
    needsInstitutionProfile?: boolean;
  }
> = {
  [UserRole.STUDENT]: {
    displayNameLabel: 'Student Name',
    displayNamePlaceholder: 'Sarah Chen',
    institutionTokenPlaceholder: 'SCH-AB12CD34',
    institutionTokenHelp:
      'Enter the institution token shared by your school or college. Your account stays pending until they approve it.',
    domainLabel: 'Innovation Domain',
    domainPlaceholder: 'AgriTech, AI, HealthTech',
    bioLabel: 'Short Bio',
    bioPlaceholder: 'Tell us what you are building or exploring',
  },
  [UserRole.SCHOOL]: {
    displayNameLabel: 'Coordinator Name',
    displayNamePlaceholder: 'Innovation Coordinator',
    needsInstitutionProfile: true,
  },
  [UserRole.COLLEGE]: {
    displayNameLabel: 'Coordinator Name',
    displayNamePlaceholder: 'Incubation Program Lead',
    needsInstitutionProfile: true,
  },
  [UserRole.MENTOR]: {
    displayNameLabel: 'Mentor Name',
    displayNamePlaceholder: 'Dr. Anika Rao',
    domainLabel: 'Mentorship Domain',
    domainPlaceholder: 'Product Strategy, AI, FinTech',
    bioLabel: 'Mentor Bio',
    bioPlaceholder: 'What kinds of builders or products do you guide?',
  },
  [UserRole.INVESTOR]: {
    displayNameLabel: 'Investor Name',
    displayNamePlaceholder: 'Arjun Ventures',
    domainLabel: 'Investment Focus',
    domainPlaceholder: 'ClimateTech, SaaS, DeepTech',
    bioLabel: 'Investment Thesis',
    bioPlaceholder: 'What kinds of startups do you back?',
  },
  [UserRole.RECRUITER]: {
    displayNameLabel: 'Recruiter Name',
    displayNamePlaceholder: 'Talent Partner',
    domainLabel: 'Hiring Domain',
    domainPlaceholder: 'Data, Product, Hardware',
    bioLabel: 'Organization Summary',
    bioPlaceholder: 'Tell candidates about your team or hiring focus',
  },
  [UserRole.ADMIN]: {
    displayNameLabel: 'Admin Name',
    displayNamePlaceholder: 'Platform Administrator',
  },
};

type SignupFormState = {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  institutionToken: string;
  domain: string;
  bio: string;
  institutionName: string;
  location: string;
  totalStudentsEnrolled: string;
  academicYear: string;
};

const initialFormState: SignupFormState = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
  institutionToken: '',
  domain: '',
  bio: '',
  institutionName: '',
  location: '',
  totalStudentsEnrolled: '',
  academicYear: '',
};

export function SignupPage() {
  const navigate = useNavigate();
  const signupMutation = useSignupMutation();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState<SignupFormState>(initialFormState);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const roleCopy = useMemo(
    () => (selectedRole ? ROLE_COPY[selectedRole] : null),
    [selectedRole],
  );

  const updateField = <K extends keyof SignupFormState>(key: K, value: SignupFormState[K]) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const roleRequiresDomain =
    selectedRole === UserRole.MENTOR ||
    selectedRole === UserRole.INVESTOR ||
    selectedRole === UserRole.RECRUITER;
  const studentNeedsInstitutionToken = selectedRole === UserRole.STUDENT;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (
      roleCopy?.needsInstitutionProfile &&
      (!formData.institutionName.trim() ||
        !formData.location.trim() ||
        !formData.totalStudentsEnrolled ||
        !formData.academicYear.trim())
    ) {
      setError('Please complete the institution details for this role');
      return;
    }

    if (roleRequiresDomain && !formData.domain.trim()) {
      setError('Please add the domain or focus area for this role');
      return;
    }

    if (studentNeedsInstitutionToken && !formData.institutionToken.trim()) {
      setError('Please enter the institution token shared by your school or college');
      return;
    }

    try {
      const payload = await signupMutation.mutateAsync({
        displayName: formData.displayName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: selectedRole,
        ...(studentNeedsInstitutionToken
          ? { institutionToken: formData.institutionToken.trim() }
          : {}),
        ...(formData.domain.trim() ? { domain: formData.domain.trim() } : {}),
        ...(formData.bio.trim() ? { bio: formData.bio.trim() } : {}),
        ...(roleCopy?.needsInstitutionProfile
          ? {
              institutionProfile: {
                institutionName: formData.institutionName.trim(),
                location: formData.location.trim(),
                totalStudentsEnrolled: Number(formData.totalStudentsEnrolled),
                academicYear: formData.academicYear.trim(),
                iicStarRating: 0,
              },
            }
          : {}),
      });

      if ('requiresVerification' in payload) {
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
          ? `${apiError.details[0].path ? `${apiError.details[0].path}: ` : ''}${apiError.details[0].message}`
          : undefined;
        setError(
          apiError?.code === 'CAPACITY_REACHED'
            ? 'Platform is at capacity for Year 1. Please join the waitlist.'
            : apiError?.code === 'INSTITUTION_TOKEN_EXPIRED'
              ? 'That institution token has expired. Please ask your school or college for a fresh one.'
              : detailMessage ?? apiError?.message ?? 'Unable to create your account right now.',
        );
        return;
      }

      setError('Unable to create your account right now.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="mx-auto w-full max-w-4xl py-8">
        <div className="mb-8 text-center">
          <Link to="/" className="mb-6 inline-flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Rocket className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">ProMove</div>
              <div className="text-xs text-slate-400">Innovation Cloud</div>
            </div>
          </Link>
          <h1 className="mb-2 text-3xl font-bold text-white">Create Your Account</h1>
          <p className="text-slate-400">Join the global innovation ecosystem</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="mb-6">
            <label className="mb-3 block text-sm font-semibold text-white">
              Select Your Role <span className="text-red-400">*</span>
            </label>
            <RoleSelector value={selectedRole} onChange={setSelectedRole} />
          </div>

          <div className="mb-6">
            <h2 className="mb-4 text-xl font-bold text-white">Account Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  {roleCopy?.displayNameLabel ?? 'Display Name'} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <UserCircle className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(event) => updateField('displayName', event.target.value)}
                    placeholder={roleCopy?.displayNamePlaceholder ?? 'Sarah Chen'}
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
                    onChange={(event) => updateField('email', event.target.value)}
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
                    onChange={(event) => updateField('password', event.target.value)}
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
                    onChange={(event) => updateField('confirmPassword', event.target.value)}
                    placeholder="********"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Password must be at least 8 characters long</p>
          </div>

          {roleCopy?.needsInstitutionProfile ? (
            <div className="mb-6">
              <h2 className="mb-4 text-xl font-bold text-white">Institution Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Institution Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={formData.institutionName}
                      onChange={(event) => updateField('institutionName', event.target.value)}
                      placeholder="Future Ready College"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Location <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(event) => updateField('location', event.target.value)}
                      placeholder="Bengaluru, India"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Total Students Enrolled <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min={1}
                      value={formData.totalStudentsEnrolled}
                      onChange={(event) => updateField('totalStudentsEnrolled', event.target.value)}
                      placeholder="1200"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    Academic Year <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <GraduationCap className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={formData.academicYear}
                      onChange={(event) => updateField('academicYear', event.target.value)}
                      placeholder="2025-26"
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {roleCopy?.domainLabel ? (
            <div className="mb-6">
              <h2 className="mb-4 text-xl font-bold text-white">Role Details</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">
                    {roleCopy.domainLabel}
                    {roleRequiresDomain ? <span className="text-red-400"> *</span> : null}
                  </label>
                  <div className="relative">
                    <GraduationCap className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={formData.domain}
                      onChange={(event) => updateField('domain', event.target.value)}
                      placeholder={roleCopy.domainPlaceholder}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      required={roleRequiresDomain}
                    />
                  </div>
                </div>

                {roleCopy.bioLabel ? (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-white">{roleCopy.bioLabel}</label>
                    <div className="relative">
                      <NotebookPen className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                      <textarea
                        value={formData.bio}
                        onChange={(event) => updateField('bio', event.target.value)}
                        placeholder={roleCopy.bioPlaceholder}
                        className="min-h-[108px] w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {studentNeedsInstitutionToken ? (
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-white">
                Institution Token <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Ticket className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.institutionToken}
                  onChange={(event) => updateField('institutionToken', event.target.value)}
                  placeholder={roleCopy?.institutionTokenPlaceholder ?? 'SCH-AB12CD34'}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {roleCopy?.institutionTokenHelp ??
                  'Enter the institution token provided by your school or college.'}
              </p>
            </div>
          ) : (
            <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
              Schools and colleges issue student verification tokens from their dashboards. Other roles can register without an access code.
            </div>
          )}

          <div className="mb-6">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-400">
                I agree to the <span className="font-semibold text-blue-500">Terms of Service</span> and{' '}
                <span className="font-semibold text-blue-500">Privacy Policy</span>
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
            {signupMutation.isPending ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-500 hover:text-blue-400">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
