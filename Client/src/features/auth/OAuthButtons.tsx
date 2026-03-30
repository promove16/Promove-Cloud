import { Chrome, Linkedin } from 'lucide-react';
import { startOAuthLogin } from './oauth';

export function OAuthButtons() {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => startOAuthLogin('google')}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-600 hover:bg-slate-900"
      >
        <Chrome className="h-5 w-5 text-slate-200" />
        Continue with Google
      </button>
      <button
        type="button"
        onClick={() => startOAuthLogin('linkedin')}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:border-slate-600 hover:bg-slate-900"
      >
        <Linkedin className="h-5 w-5 text-sky-400" />
        Continue with LinkedIn
      </button>
    </div>
  );
}
