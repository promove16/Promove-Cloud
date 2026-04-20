import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Check, MapPin, Search, Sparkles, X } from 'lucide-react';
import type { AdminUserListItem } from '../../api/admin.api';
import { Button } from '../../components/ui/Button';
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

  if (queryTokens.length === 0) {
    score += 10;
  }

  return score;
};

type Props = {
  institutions: AdminUserListItem[];
  value: string;
  onChange: (institutionId: string) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
};

export function InstitutionSearchField({
  institutions,
  value,
  onChange,
  label = 'Institution',
  placeholder = 'Search institution by name, location, or email',
  helperText,
}: Props) {
  const selectedInstitution = useMemo(
    () => institutions.find((institution) => institution._id === value) ?? null,
    [institutions, value],
  );
  const [query, setQuery] = useState(selectedInstitution ? getInstitutionLabel(selectedInstitution) : '');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (selectedInstitution) {
      setQuery(getInstitutionLabel(selectedInstitution));
      return;
    }

    setQuery('');
  }, [selectedInstitution]);

  const rankedInstitutions = useMemo(
    () =>
      [...institutions]
        .sort((left, right) => {
          const scoreDelta =
            getInstitutionSearchScore(right, deferredQuery) - getInstitutionSearchScore(left, deferredQuery);
          if (scoreDelta !== 0) {
            return scoreDelta;
          }

          return getInstitutionLabel(left).localeCompare(getInstitutionLabel(right));
        }),
    [deferredQuery, institutions],
  );

  const visibleInstitutions = useMemo(
    () => rankedInstitutions.slice(0, deferredQuery.trim() ? 6 : 5),
    [deferredQuery, rankedInstitutions],
  );
  const suggestedInstitutions = useMemo(
    () =>
      rankedInstitutions
        .filter((institution) => institution._id !== value)
        .slice(0, 3),
    [rankedInstitutions, value],
  );
  const showResultList = deferredQuery.trim().length > 0 || !selectedInstitution;

  const handleSelectInstitution = (institution: AdminUserListItem) => {
    onChange(institution._id);
    setQuery(getInstitutionLabel(institution));
  };

  const handleClear = () => {
    onChange('');
    setQuery('');
  };

  return (
    <div>
      <label className={formLabelClassName}>{label}</label>
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              if (
                selectedInstitution &&
                normalize(nextQuery) !== normalize(getInstitutionLabel(selectedInstitution))
              ) {
                onChange('');
              }
            }}
            placeholder={placeholder}
            className="border-slate-800 bg-slate-950 py-2.5 pl-10 pr-11 text-white placeholder:text-slate-500"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-300"
              aria-label="Clear institution search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {selectedInstitution ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            <div className="flex min-w-0 items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{getInstitutionLabel(selectedInstitution)}</span>
            </div>
            <span className="shrink-0 text-cyan-200/80">
              {getInstitutionPrimaryLocation(selectedInstitution) || selectedInstitution.role}
            </span>
          </div>
        ) : null}

        {suggestedInstitutions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <Sparkles className="h-3 w-3" />
              Suggestions
            </span>
            {suggestedInstitutions.map((institution) => (
              <Button
                key={institution._id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSelectInstitution(institution)}
                className="rounded-full border-slate-700 px-3 py-1 text-[11px] text-slate-200"
              >
                {getInstitutionLabel(institution)}
              </Button>
            ))}
          </div>
        ) : null}

        {showResultList ? (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80">
            {visibleInstitutions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">No institutions match this search.</div>
            ) : (
              visibleInstitutions.map((institution) => (
                <button
                  key={institution._id}
                  type="button"
                  onClick={() => handleSelectInstitution(institution)}
                  className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition ${
                    institution._id === value ? 'bg-cyan-500/10' : 'hover:bg-slate-900'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{getInstitutionLabel(institution)}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-400">
                      {institution.email}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-slate-500">
                    <div className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {getInstitutionPrimaryLocation(institution) || 'Location pending'}
                    </div>
                    {institution.institutionProfile?.academicYear ? (
                      <div>{institution.institutionProfile.academicYear}</div>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        ) : null}

        <div className="text-xs text-slate-500">
          {helperText ?? 'Type to search institutions instead of browsing a long option list.'}
        </div>
      </div>
    </div>
  );
}
