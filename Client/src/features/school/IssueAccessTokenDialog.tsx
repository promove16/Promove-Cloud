import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound } from 'lucide-react';
import { isAxiosError } from 'axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../app/components/ui/dialog';
import { toast } from '../../app/components/ui/sonner';
import { schoolApi } from '../../api/school.api';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ApiErrorResponse } from '../../types/auth.types';
import { copyTextToClipboard } from '../../utils/clipboard';

type IssueAccessTokenDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function getErrorMessage(error: unknown, fallback: string) {
  return isAxiosError<ApiErrorResponse>(error) && error.response?.data?.error?.message
    ? error.response.data.error.message
    : fallback;
}

function formatExpiry(expiresAt?: string) {
  if (!expiresAt) {
    return 'No expiry';
  }

  return `Expires ${new Date(expiresAt).toLocaleDateString('en-IN')}`;
}

export function IssueAccessTokenDialog({ open, onOpenChange }: IssueAccessTokenDialogProps) {
  const queryClient = useQueryClient();
  const [tokenLabel, setTokenLabel] = useState('');

  const tokensQuery = useQuery({
    queryKey: ['school-student-access-tokens'],
    queryFn: schoolApi.getStudentAccessTokens,
    enabled: open,
  });

  const createTokenMutation = useMutation({
    mutationFn: schoolApi.createStudentAccessToken,
    onSuccess: async () => {
      setTokenLabel('');
      toast.success('Access token issued.');
      await queryClient.invalidateQueries({ queryKey: ['school-student-access-tokens'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Unable to issue an access token right now.'));
    },
  });

  const latestTokens = useMemo(() => (tokensQuery.data ?? []).slice(0, 5), [tokensQuery.data]);

  const handleCreateToken = () => {
    createTokenMutation.mutate({
      ...(tokenLabel.trim() ? { label: tokenLabel.trim() } : {}),
    });
  };

  const handleCopyToken = async (token: string) => {
    try {
      await copyTextToClipboard(token);
      toast.success('Access token copied.');
    } catch (_error) {
      toast.error('Unable to copy this token.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300">
            <KeyRound className="h-6 w-6" />
          </div>
          <DialogTitle className="mt-4 text-2xl text-white">Issue Access Token</DialogTitle>
          <DialogDescription>
            Generate a student onboarding token and share it with new learners so they can register against your school.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-[minmax(0,1fr),auto]">
          <div>
            <label htmlFor="school-token-label" className="text-sm font-medium text-white">
              Token Label
            </label>
            <p className="mt-1 text-sm text-slate-400">
              Optional. Use a cohort or class label to track where the token is shared.
            </p>
            <Input
              id="school-token-label"
              value={tokenLabel}
              onChange={(event) => setTokenLabel(event.target.value)}
              placeholder="Grade 12 innovators"
              className="mt-3"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleCreateToken} disabled={createTokenMutation.isPending}>
              {createTokenMutation.isPending ? 'Issuing...' : 'Issue Token'}
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Recent Tokens</div>
              <div className="mt-1 text-sm text-slate-400">Use these for onboarding until they expire.</div>
            </div>
            <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
              {(tokensQuery.data ?? []).length} active
            </div>
          </div>

          {tokensQuery.isLoading ? (
            <div className="text-sm text-slate-400">Loading issued tokens...</div>
          ) : latestTokens.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-400">
              No access tokens have been issued yet.
            </div>
          ) : (
            <div className="space-y-3">
              {latestTokens.map((token) => (
                <div
                  key={token._id}
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-mono text-base font-semibold text-cyan-300">{token.token}</div>
                    <div className="mt-1 text-sm text-slate-400">{token.label ?? 'General school onboarding token'}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {token.usageCount} registrations • {formatExpiry(token.expiresAt)}
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => void handleCopyToken(token.token)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
