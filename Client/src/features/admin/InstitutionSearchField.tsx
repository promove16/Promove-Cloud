import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Check, MapPin, Search, X } from 'lucide-react';
import type { AdminUserListItem } from '../../api/admin.api';
import { Input } from '../../components/ui/Input';
import { formLabelClassName, getInstitutionLabel } from './mentorshipAdminShared';

const normalize = (value: string) => value.trim().toLowerCase();
const tokenize = (value?: string) =>
  normalize(value ?? '')
    .split(/\s+/)
    .filter(Boolean);

const getInstitutionPrimaryLocation = (institution: AdminUserListItem) =>
  institution.institutionProfile?.location?.trim() ||
  institution.institutionProfile?.locations?.find((location) => location.trim())?.trim() ||
  '';

const getInstitutionSearchScore = (institution: AdminUserListItem, searchQuery: string) => {
  const queryTokens = tokenize(searchQuery);
  const label = normalize(getInstitutionLabel(institution));
  const location = normalize(getInstitutionPrimaryLocation(institution));
  const academicYear = normalize(institution.institutionProfile?.academicYear ?? '');
  const email = normalize(institution.email);
  let score = 0;

  for (const token of queryTokens) {
    if (label.startsWith(token)) score += 100;
    else if (label.includes(token)) score += 70;
    if (location.startsWith(token)) score += 45;
    else if (location.includes(token)) score += 28;
    if (email.includes(token)) score += 22;
    if (academicYear.includes(token)) score += 12;
  }

  return score;
};

type Props = {
  institutions: AdminUserListItem[];
  value: string;
  onChange: (institutionId: string) => void;
  label?: string;
  placeholder?: string;
};

export function InstitutionSearchField({
  institutions,
  value,
  onChange,
  label = 'Institution',
  placeholder = 'Search by name or location',
}: Props) {
  const selectedInstitution = useMemo(
    () => institutions.find((institution) => institution._id === value) ?? null,
    [institutions, value],
  );
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!selectedInstitution) setQuery('');
  }, [selectedInstitution]);

  const rankedInstitutions = useMemo(
    () =>
      [...institutions].sort((left, right) => {
        const scoreDelta =
          getInstitutionSearchScore(right, deferredQuery) -
          getInstitutionSearchScore(left, deferredQuery);
        return scoreDelta !== 0
          ? scoreDelta
          : getInstitutionLabel(left).localeCompare(getInstitutionLabel(right));
      }),
    [deferredQuery, institutions],
  );

  const visibleInstitutions = useMemo(
    () => rankedInstitutions.slice(0, 6),
    [rankedInstitutions],
  );

  const showResultList = deferredQuery.trim().length > 0 && !selectedInstitution;

  const handleSelect = (institution: AdminUserListItem) => {
    onChange(institution._id);
    setQuery('');
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
  };

  return (
    <div>
      <label className={formLabelClassName}>{label}</label>
      <div className="space-y-2">
        {selectedInstitution ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/25 bg-cyan-500/8 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <span className="truncate text-sm font-medium text-white">
                {getInstitutionLabel(selectedInstitution)}
              </span>
              {getInstitutionPrimaryLocation(selectedInstitution) ? (
                <span className="shrink-0 text-xs text-slate-500">
                  {getInstitutionPrimaryLocation(selectedInstitution)}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 text-slate-500 transition hover:text-slate-300"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="border-slate-800 bg-slate-900/60 py-2.5 pl-10 pr-9 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/60"
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        )}

        {showResultList ? (
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            {visibleInstitutions.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">No institutions found.</div>
            ) : (
              visibleInstitutions.map((institution) => (
                <button
                  key={institution._id}
                  type="button"
                  onClick={() => handleSelect(institution)}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-800/50 px-3 py-2.5 text-left last:border-0 transition hover:bg-slate-900"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{getInstitutionLabel(institution)}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{institution.email}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-xs text-slate-600">
                    <MapPin className="h-3 w-3" />
                    {getInstitutionPrimaryLocation(institution) || '—'}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
