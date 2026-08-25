import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface FormattedJobDescriptionProps {
  description: string;
  compact?: boolean;
  maxItems?: number;
  onReadMore?: () => void;
  className?: string;
}

export interface JobSection {
  title?: string;
  type: 'paragraph' | 'list' | 'meta';
  items?: string[];
  text?: string;
}

export function parseJobDescription(rawText: string): JobSection[] {
  if (!rawText || !rawText.trim()) {
    return [{ type: 'paragraph', text: 'No description provided.' }];
  }

  let text = rawText.trim();

  // Normalize raw text to insert double newlines before section headers if they are concatenated
  const headerRegex = /(?:\s|^)(Job Title:|Location:|Type:|Experience:|Experiance:|Role Overview|Overview|About the Role|About this role|Job Summary|Role Summary|Key Responsibilities|Responsibilities|Qualifications Required:|Qualifications Required|Qualifications:|Qualifications|Requirements:|Requirements|What you will do|What you'll do|What we are looking for|What we're looking for|Skills Required|Basic Qualifications|Perks & Benefits|Benefits|What We Offer|About the Company|Company Overview|About Us|Application Process|How to Apply)(?=\s|:|$)/gi;

  text = text.replace(headerRegex, (match) => `\n\n${match.trim()}\n`);

  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const sections: JobSection[] = [];
  let currentSection: JobSection | null = null;

  const isHeader = (line: string) => {
    const clean = line.replace(/:$/, '').trim().toLowerCase();
    const knownHeaders = [
      'role overview',
      'overview',
      'about the role',
      'about this role',
      'job summary',
      'role summary',
      'key responsibilities',
      'responsibilities',
      'qualifications required',
      'qualifications',
      'requirements',
      'perks & benefits',
      'benefits',
      'what we offer',
      'about the company',
      'company overview',
      'about us',
      'application process',
      'how to apply',
      'skills required',
      'basic qualifications',
      'what you will do',
      "what you'll do",
      'what we are looking for',
      "what we're looking for",
    ];
    return knownHeaders.includes(clean) || (line.endsWith(':') && line.length < 40 && !line.includes('|'));
  };

  const isListSectionTitle = (title?: string) => {
    if (!title) return false;
    const clean = title.toLowerCase();
    return [
      'responsibilities',
      'key responsibilities',
      'qualifications required',
      'qualifications',
      'requirements',
      'perks & benefits',
      'benefits',
      'skills required',
      'basic qualifications',
      'what you will do',
      "what you'll do",
      'what we are looking for',
      "what we're looking for",
    ].includes(clean);
  };

  const splitConcatenatedBullets = (str: string): string[] => {
    const pattern = /(?<=[.;\w])\s+(?=(?:Design|Develop|Build|Create|Collect|Clean|Evaluate|Deploy|Integrate|Work|Write|Stay|Maintain|Implement|Architect|Lead|Collaborate|Formulate|Optimize|Analyze|Define|Drive|Deliver|Manage|Establish|Ensure|Partner|Bachelor's|Bachelors|Master's|Masters|Degree|Strong|Solid|Hands-on|Working|Proficiency|Proven|Experience|Good|Ability|Understanding|Knowledge)\b)/g;
    const parts = str.split(pattern).map((p) => p.trim()).filter(Boolean);
    return parts.length > 1 ? parts : [str];
  };

  const isMetaLine = (line: string) => {
    const lower = line.toLowerCase();
    return lower.startsWith('job title:') || (lower.includes('location:') && (lower.includes('type:') || lower.includes('experiance:') || lower.includes('experience:')));
  };

  for (const line of rawLines) {
    if (isMetaLine(line)) {
      if (currentSection && (currentSection.text || (currentSection.items && currentSection.items.length > 0))) {
        sections.push(currentSection);
        currentSection = null;
      }
      sections.push({ type: 'meta', text: line });
      continue;
    }

    if (isHeader(line)) {
      if (currentSection && (currentSection.text || (currentSection.items && currentSection.items.length > 0))) {
        sections.push(currentSection);
      }
      const title = line.replace(/:$/, '').trim();
      currentSection = {
        title,
        type: isListSectionTitle(title) ? 'list' : 'paragraph',
        items: [],
        text: '',
      };
      continue;
    }

    if (!currentSection) {
      currentSection = { type: 'paragraph', text: '' };
    }

    const bullets = splitConcatenatedBullets(line);
    const isBulletLine = bullets.length > 1 || /^[-*•\d+\.]/.test(line);

    if (isBulletLine || currentSection.type === 'list') {
      if (currentSection.type !== 'list') {
        if (currentSection.text?.trim()) {
          sections.push(currentSection);
        }
        currentSection = { type: 'list', items: [] };
      }
      for (const b of bullets) {
        const cleaned = b.replace(/^[-*•\d+\.]\s*/, '').trim();
        if (cleaned) {
          currentSection.items?.push(cleaned);
        }
      }
    } else {
      currentSection.text = currentSection.text ? `${currentSection.text}\n${line}` : line;
    }
  }

  if (currentSection && (currentSection.text || (currentSection.items && currentSection.items.length > 0))) {
    sections.push(currentSection);
  }

  return sections;
}

export function FormattedJobDescription({
  description,
  compact = false,
  maxItems = 3,
  onReadMore,
  className = '',
}: FormattedJobDescriptionProps) {
  const sections = parseJobDescription(description);

  if (compact) {
    const previewItems: string[] = [];

    for (const section of sections) {
      if (section.type === 'list' && section.items) {
        for (const item of section.items) {
          previewItems.push(item);
          if (previewItems.length >= maxItems) break;
        }
      } else if (section.text && section.type === 'paragraph') {
        const sentences = section.text
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const sentence of sentences) {
          if (
            !sentence.toLowerCase().startsWith('job title:') &&
            !sentence.toLowerCase().startsWith('location:') &&
            !sentence.toLowerCase().startsWith('type:') &&
            !sentence.toLowerCase().startsWith('experiance:') &&
            !sentence.toLowerCase().startsWith('experience:')
          ) {
            previewItems.push(sentence);
            if (previewItems.length >= maxItems) break;
          }
        }
      }
      if (previewItems.length >= maxItems) break;
    }

    if (previewItems.length === 0 && description.trim()) {
      previewItems.push(description.slice(0, 160) + '...');
    }

    return (
      <div className={`space-y-2.5 ${className}`}>
        {previewItems.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
            <span className="min-w-0 flex-1">{item}</span>
          </div>
        ))}

        {onReadMore ? (
          <div className="pt-1">
            <button
              type="button"
              onClick={onReadMore}
              className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 transition hover:text-cyan-300 hover:underline"
            >
              Read more <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`space-y-4 text-sm leading-relaxed text-slate-300 ${className}`}>
      {sections.map((section, idx) => {
        if (section.type === 'meta' && section.text) {
          const parts = section.text.split('|').map((p) => p.trim()).filter(Boolean);
          return (
            <div key={idx} className="flex flex-wrap gap-2 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-xs text-slate-400">
              {parts.map((part, pIdx) => (
                <span key={pIdx} className="inline-flex items-center gap-1">
                  {pIdx > 0 && <span className="mr-1 text-slate-600">•</span>}
                  <span>{part}</span>
                </span>
              ))}
            </div>
          );
        }

        return (
          <div key={idx} className="space-y-2">
            {section.title && (
              <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                {section.title}
              </h4>
            )}
            {section.type === 'list' && section.items && section.items.length > 0 ? (
              <ul className="space-y-2 pl-1">
                {section.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                    <span className="min-w-0 flex-1 leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            ) : section.text ? (
              <div className="whitespace-pre-wrap break-words leading-6 text-slate-300">
                {section.text}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default FormattedJobDescription;
