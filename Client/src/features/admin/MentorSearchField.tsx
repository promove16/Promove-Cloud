import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import type { AdminMentorListItem } from '../../types/mentorship.types';
import { formLabelClassName } from './mentorshipAdminShared';

const normalize = (value: string) => value.trim().toLowerCase();
const tokenize = (value?: string) =>
  normalize(value ?? '')
    .split(/\s+/)
    .filter(Boolean);
const getMentorLoad = (mentor: AdminMentorListItem) => mentor.assignedPrograms + mentor.assignedProjects;

const getMentorSearchScore = (
  mentor: AdminMentorListItem,
  searchQuery: string,
  preferredExpertise?: string,
) => {
  const queryTokens = tokenize(searchQuery);
  const expertiseTokens = tokenize(preferredExpertise);
  const name = normalize(mentor.displayName);
  const domain = normalize(mentor.domain ?? '');
  const headline = normalize(mentor.headline ?? '');
  const bio = normalize(mentor.bio ?? '');
  let score = 0;

  for (const token of queryTokens) {
    if (name.startsWith(token)) score += 100;
    else if (name.includes(token)) score += 70;
    if (domain.startsWith(token) || headline.startsWith(token)) score += 55;
    else if (domain.includes(token) || headline.includes(token)) score += 35;
    if (bio.includes(token)) score += 20;
  }

  for (const token of expertiseTokens) {
    if (domain.includes(token)) score += 24;
    if (headline.includes(token)) score += 18;
    if (bio.includes(token)) score += 12;
  }

  if (queryTokens.length === 0 && expertiseTokens.length === 0) score += 10;

  return score - getMentorLoad(mentor) * 2;
};

type Props = {
  mentors: AdminMentorListItem[];
  value: string;
  onChange: (mentorId: string) => void;
  label?: string;
  placeholder?: string;
  preferredExpertise?: string;
};

export function MentorSearchField({
  mentors,
  value,
  onChange,
  label = 'Assigned Mentor',
  placeholder = 'Search by name or domain',
  preferredExpertise,
}: Props) {
  const selectedMentor = useMemo(
    () => mentors.find((mentor) => mentor._id === value) ?? null,
    [mentors, value],
  );
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!selectedMentor) setQuery('');
  }, [selectedMentor]);

  const rankedMentors = useMemo(
    () =>
      [...mentors].sort((left, right) => {
        const scoreDelta =
          getMentorSearchScore(right, deferredQuery, preferredExpertise) -
          getMentorSearchScore(left, deferredQuery, preferredExpertise);
        if (scoreDelta !== 0) return scoreDelta;
        const loadDelta = getMentorLoad(left) - getMentorLoad(right);
        if (loadDelta !== 0) return loadDelta;
        return left.displayName.localeCompare(right.displayName);
      }),
    [deferredQuery, mentors, preferredExpertise],
  );

  const visibleMentors = useMemo(() => rankedMentors.slice(0, 6), [rankedMentors]);

  const showResultList = deferredQuery.trim().length > 0 && !selectedMentor;

  const handleSelect = (mentor: AdminMentorListItem) => {
    onChange(mentor._id);
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
        {selectedMentor ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/25 bg-cyan-500/8 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <span className="truncate text-sm font-medium text-white">
                {selectedMentor.displayName}
              </span>
              {selectedMentor.domain ? (
                <span className="shrink-0 text-xs text-slate-500">{selectedMentor.domain}</span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-slate-600">
                {getMentorLoad(selectedMentor)} tasks
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-500 transition hover:text-slate-300"
                aria-label="Clear selection"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
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
            {visibleMentors.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">No mentors found.</div>
            ) : (
              visibleMentors.map((mentor) => (
                <button
                  key={mentor._id}
                  type="button"
                  onClick={() => handleSelect(mentor)}
                  className="flex w-full items-center justify-between gap-3 border-b border-slate-800/50 px-3 py-2.5 text-left last:border-0 transition hover:bg-slate-900"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white">{mentor.displayName}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {mentor.domain ?? mentor.headline ?? 'General'}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-slate-600">
                    {getMentorLoad(mentor)} tasks
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
