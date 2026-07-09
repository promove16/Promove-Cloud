import { ExternalLink, LucideIcon } from 'lucide-react';

interface ResearchNoteProps {
  icon: LucideIcon;
  text: string;
  linkLabel?: string;
  linkHref?: string;
}

export function ResearchNote({ icon: Icon, text, linkLabel, linkHref }: ResearchNoteProps) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-violet-400" />
      <p className="text-xs leading-relaxed text-slate-500">
        {text}
        {linkLabel && linkHref && (
          <>
            {' '}
            <a
              href={linkHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-violet-400 transition hover:text-violet-300"
            >
              {linkLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          </>
        )}
      </p>
    </div>
  );
}
