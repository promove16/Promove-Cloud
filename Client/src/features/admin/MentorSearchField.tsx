import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Check, Search, Sparkles, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
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

  if (queryTokens.length === 0 && expertiseTokens.length === 0) {
    score += 10;
  }

  return score - getMentorLoad(mentor) * 2;
};

type Props = {
  mentors: AdminMentorListItem[];
  value: string;
  onChange: (mentorId: string) => void;
  label?: string;
  placeholder?: string;
  preferredExpertise?: string;
  helperText?: string;
};

export function MentorSearchField({
  mentors,
  value,
  onChange,
  label = 'Assigned Mentor',
  placeholder = 'Search mentors by name, domain, or headline',
  preferredExpertise,
  helperText,
}: Props) {
  const selectedMentor = useMemo(
    () => mentors.find((mentor) => mentor._id === value) ?? null,
    [mentors, value],
  );
  const [query, setQuery] = useState(selectedMentor?.displayName ?? '');
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (selectedMentor) {
      setQuery(selectedMentor.displayName);
      return;
    }

    setQuery('');
  }, [selectedMentor]);

  const rankedMentors = useMemo(
    () =>
      [...mentors].sort((left, right) => {
        const scoreDelta =
          getMentorSearchScore(right, deferredQuery, preferredExpertise) -
          getMentorSearchScore(left, deferredQuery, preferredExpertise);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }

        const loadDelta = getMentorLoad(left) - getMentorLoad(right);
        if (loadDelta !== 0) {
          return loadDelta;
        }

        return left.displayName.localeCompare(right.displayName);
      }),
    [deferredQuery, mentors, preferredExpertise],
  );

  const visibleMentors = useMemo(
    () => rankedMentors.slice(0, deferredQuery.trim() ? 6 : 5),
    [deferredQuery, rankedMentors],
  );
  const showResultList = deferredQuery.trim().length > 0 || !selectedMentor;
  const suggestedMentors = useMemo(
    () =>
      [...mentors]
        .sort((left, right) => {
          const scoreDelta =
            getMentorSearchScore(right, '', preferredExpertise) -
            getMentorSearchScore(left, '', preferredExpertise);
          if (scoreDelta !== 0) {
            return scoreDelta;
          }

          const loadDelta = getMentorLoad(left) - getMentorLoad(right);
          if (loadDelta !== 0) {
            return loadDelta;
          }

          return left.displayName.localeCompare(right.displayName);
        })
        .filter((mentor) => mentor._id !== value)
        .slice(0, 3),
    [mentors, preferredExpertise, value],
  );

  const handleSelectMentor = (mentor: AdminMentorListItem) => {
    onChange(mentor._id);
    setQuery(mentor.displayName);
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
              if (selectedMentor && normalize(nextQuery) !== normalize(selectedMentor.displayName)) {
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
              aria-label="Clear mentor search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {selectedMentor ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
            <div className="flex min-w-0 items-center gap-2">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {selectedMentor.displayName}
                {selectedMentor.domain ? ` · ${selectedMentor.domain}` : ''}
              </span>
            </div>
            <span className="shrink-0 text-cyan-200/80">
              {selectedMentor.assignedPrograms} programs · {selectedMentor.assignedProjects} projects
            </span>
          </div>
        ) : null}

        {suggestedMentors.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <Sparkles className="h-3 w-3" />
              Suggestions
            </span>
            {suggestedMentors.map((mentor) => (
              <Button
                key={mentor._id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSelectMentor(mentor)}
                className="rounded-full border-slate-700 px-3 py-1 text-[11px] text-slate-200"
              >
                {mentor.displayName}
              </Button>
            ))}
          </div>
        ) : null}

        {showResultList ? (
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80">
            {visibleMentors.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">No mentors match this search.</div>
            ) : (
              visibleMentors.map((mentor) => (
                <button
                  key={mentor._id}
                  type="button"
                  onClick={() => handleSelectMentor(mentor)}
                  className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition ${
                    mentor._id === value ? 'bg-cyan-500/10' : 'hover:bg-slate-900'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{mentor.displayName}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-400">
                      {mentor.domain ?? mentor.headline ?? mentor.bio ?? 'General mentorship'}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] text-slate-500">
                    <div>{mentor.assignedPrograms} programs</div>
                    <div>{mentor.assignedProjects} projects</div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : null}

        {helperText || preferredExpertise ? (
          <div className="text-xs text-slate-500">
            {helperText ?? `Suggestions are weighted toward "${preferredExpertise}" and lighter mentor workload.`}
          </div>
        ) : null}
      </div>
    </div>
  );
}
