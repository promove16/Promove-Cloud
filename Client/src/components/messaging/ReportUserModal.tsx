import { useState } from 'react';
import { X, AlertTriangle, Send, CheckCircle } from 'lucide-react';
import { reportApi, ReportReason } from '../../api/report.api';

interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUserName: string;
}

const reportReasons: { value: ReportReason; label: string; description: string }[] = [
  {
    value: 'harassment',
    label: 'Harassment',
    description: 'Targeted bullying, threats, or intimidation',
  },
  {
    value: 'spam',
    label: 'Spam',
    description: 'Unsolicited promotional or repetitive messages',
  },
  {
    value: 'inappropriate_content',
    label: 'Inappropriate Content',
    description: 'Offensive, explicit, or harmful content',
  },
  {
    value: 'fake_profile',
    label: 'Fake Profile',
    description: 'Impersonating someone or using false information',
  },
  {
    value: 'privacy_violation',
    label: 'Privacy Violation',
    description: 'Sharing personal information without consent',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Other issues not listed above',
  },
];

export function ReportUserModal({ isOpen, onClose, reportedUserId, reportedUserName }: ReportUserModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await reportApi.createReport({
        reportedUserId,
        reason: selectedReason,
        description,
      });
      setIsSubmitted(true);
      setTimeout(() => {
        onClose();
        setIsSubmitted(false);
        setSelectedReason(null);
        setDescription('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setSelectedReason(null);
      setDescription('');
      setError(null);
      setIsSubmitted(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Report {reportedUserName}</h2>
              <p className="text-sm text-slate-400">Help us keep the community safe</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          {isSubmitted ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle className="h-8 w-8" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">Report Submitted</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Thank you for helping keep our community safe. We will review your report shortly.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="mb-3 text-sm font-medium text-slate-300">Select a reason for reporting:</p>
                <div className="space-y-2">
                  {reportReasons.map((reason) => (
                    <button
                      key={reason.value}
                      onClick={() => setSelectedReason(reason.value)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        selectedReason === reason.value
                          ? 'border-red-500/50 bg-red-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-full border-2 ${
                        selectedReason === reason.value
                          ? 'border-red-500 bg-red-500'
                          : 'border-slate-500'
                      }`} />
                      <div>
                        <div className="font-medium text-white">{reason.label}</div>
                        <div className="text-xs text-slate-400">{reason.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Additional details (optional):
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide any additional context that might help us understand the situation..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 p-3 text-sm text-white outline-none transition focus:border-red-500 placeholder:text-slate-500"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!selectedReason || isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Report
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-500">
                Reports are reviewed by our moderation team. False reports may result in action against your account.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
