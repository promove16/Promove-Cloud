import { useMemo } from 'react';
import { isAxiosError } from 'axios';
import { ShieldCheck } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { userApi } from '../../api/user.api';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';

type TermsContent = {
  sectorLabel: string;
  intro: string;
  commitments: string[];
};

const TERMS_CONTENT: Record<UserRole, TermsContent> = {
  [UserRole.STUDENT]: {
    sectorLabel: 'Student',
    intro:
      'Use ProMove for authentic academic, innovation, and collaboration work. Submissions, profiles, and outreach must reflect your own participation and authorized team activity.',
    commitments: [
      'Only upload work, IP, credentials, and portfolio material you are allowed to share.',
      'Do not misuse mentor, recruiter, investor, or institution channels for spam, impersonation, or false claims.',
      'Keep institution-linked activity compliant with your school or college policies and review workflows.',
    ],
  },
  [UserRole.INVESTOR]: {
    sectorLabel: 'Investor',
    intro:
      'Use ProMove for legitimate startup discovery and deal activity. Portfolio signals, outreach, and investment-stage actions must be lawful, accurate, and commercially responsible.',
    commitments: [
      'Treat startup information, cap-table details, and diligence material as confidential unless disclosure is authorized.',
      'Do not misrepresent intent, authority, funding status, or binding commercial terms through the platform.',
      'Respect staged deal workflows, platform safeguards, and applicable securities or investment rules.',
    ],
  },
  [UserRole.MENTOR]: {
    sectorLabel: 'Mentor',
    intro:
      'Use ProMove to guide students responsibly. Feedback, sessions, and shared material should support learning outcomes and stay within authorized mentoring boundaries.',
    commitments: [
      'Keep student information and workspace context confidential unless sharing is explicitly permitted.',
      'Provide professional, non-abusive guidance and avoid conflicts of interest or exploitative requests.',
      'Use platform messaging and session tools for legitimate mentoring activity only.',
    ],
  },
  [UserRole.RECRUITER]: {
    sectorLabel: 'Recruiter',
    intro:
      'Use ProMove for genuine hiring and talent evaluation. Candidate engagement, drive management, and onboarding actions must be accurate, fair, and policy-compliant.',
    commitments: [
      'Do not scrape, resell, or misuse candidate data beyond authorized recruiting workflows.',
      'Represent roles, compensation, timelines, and hiring status truthfully in all outreach.',
      'Respect student, college, and platform consent boundaries when messaging or shortlisting talent.',
    ],
  },
  [UserRole.SCHOOL]: {
    sectorLabel: 'School',
    intro:
      'Use ProMove to manage school-led student innovation and verification workflows. Institution actions should be accurate, auditable, and performed by authorized staff.',
    commitments: [
      'Verify student data, roster actions, and institutional approvals carefully before submission.',
      'Protect student records and use institution dashboards only for legitimate academic operations.',
      'Do not share access tokens, dashboards, or compliance data outside approved stakeholders.',
    ],
  },
  [UserRole.COLLEGE]: {
    sectorLabel: 'College',
    intro:
      'Use ProMove to manage college-led verification, placement, and innovation operations. Institutional decisions and published data must remain accurate and authorized.',
    commitments: [
      'Handle student placement, event, and compliance records with appropriate confidentiality and care.',
      'Use recruiter and investor connections only for legitimate institution-approved activity.',
      'Ensure staff actions on behalf of the college remain traceable and policy-compliant.',
    ],
  },
  [UserRole.ADMIN]: {
    sectorLabel: 'Admin',
    intro:
      'Use ProMove administrative access only for platform governance, safety, and operational review. Elevated permissions must be exercised conservatively and with clear accountability.',
    commitments: [
      'Limit user, patent, award, and deal actions to necessary platform operations and documented review decisions.',
      'Protect confidential platform data and avoid unnecessary access to user information.',
      'Use administrative privileges in line with audit, security, and least-privilege expectations.',
    ],
  },
};

export function TermsAcceptanceGate() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setUser = useAuthStore((state) => state.setUser);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('No authenticated user found.');
      }

      return userApi.acceptTerms(user.termsCurrentVersion);
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
    },
  });

  const content = useMemo(() => {
    if (!user) {
      return null;
    }

    return TERMS_CONTENT[user.role];
  }, [user]);

  if (
    isLoading ||
    !isAuthenticated ||
    !user ||
    user.role === UserRole.ADMIN ||
    user.hasAcceptedCurrentTerms ||
    !content
  ) {
    return null;
  }

  const errorMessage = isAxiosError(acceptMutation.error)
    ? acceptMutation.error.response?.data?.error?.message ?? 'Unable to record acceptance right now.'
    : acceptMutation.error instanceof Error
      ? acceptMutation.error.message
      : '';

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        aria-describedby="terms-description"
        className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 shadow-[0_40px_120px_rgba(2,6,23,0.85)]"
      >
        <div className="border-b border-slate-800 bg-gradient-to-r from-cyan-500/10 via-slate-950 to-emerald-500/10 px-6 py-5 sm:px-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                {content.sectorLabel} Terms
              </div>
              <h2 id="terms-title" className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
                Review and accept the Terms &amp; Conditions
              </h2>
              <p id="terms-description" className="mt-3 text-sm leading-6 text-slate-300 sm:text-base">
                {content.intro}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
            Access is blocked until you accept the current version of the Terms &amp; Conditions for your
            sector.
            <span className="ml-2 font-semibold text-white">Version {user.termsCurrentVersion}</span>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              By proceeding, you confirm that you will:
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-200 sm:text-base">
              {content.commitments.map((commitment) => (
                <li key={commitment} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
                  <span>{commitment}</span>
                </li>
              ))}
            </ul>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            className="w-full py-4 text-base"
          >
            {acceptMutation.isPending ? 'Recording acceptance...' : 'Agree & Proceed'}
          </Button>
        </div>
      </div>
    </div>
  );
}
