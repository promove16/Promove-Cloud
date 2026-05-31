import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { AgreementViewer } from './AgreementViewer';

export default function AgreementPage() {
  const { agreementId } = useParams<{ agreementId: string }>();
  const currentUserId = useAuthStore((state) => state.user?._id);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white">Virtual Agreement</h1>
          <p className="mt-1 text-sm text-slate-400">
            Review the negotiated terms and acknowledge the agreement to advance the deal.
          </p>
        </div>

        {agreementId ? (
          <AgreementViewer agreementId={agreementId} currentUserId={currentUserId} />
        ) : (
          <Card className="p-6">
            <div className="text-sm text-slate-400">No agreement specified.</div>
          </Card>
        )}
      </div>
    </div>
  );
}
