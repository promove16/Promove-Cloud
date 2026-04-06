import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../app/components/ui/dropdown-menu';
import {
  TemporaryMemoryMode,
  TEMPORARY_MEMORY_RETENTION_HOURS,
  getTemporaryMemorySummary,
  isTemporaryMemory,
} from '../../lib/temporaryMemory';

export function TemporaryMemoryMenu({
  value,
  onChange,
  className = '',
  align = 'start',
}: {
  value: TemporaryMemoryMode;
  onChange: (value: TemporaryMemoryMode) => void;
  className?: string;
  align?: 'start' | 'center' | 'end';
}) {
  const temporary = isTemporaryMemory(value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            temporary
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15'
              : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
          } ${className}`}
          aria-label="Temporary memory settings"
        >
          {temporary ? `Temporary ${TEMPORARY_MEMORY_RETENTION_HOURS}h` : 'Standard'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-72 border-slate-800 bg-slate-950 text-white">
        <DropdownMenuLabel className="px-2 py-2 text-sm font-semibold text-white">
          Memory mode
        </DropdownMenuLabel>
        <div className="px-2 pb-2 text-xs leading-5 text-slate-400">
          Choose whether this upload or message stays normally or auto-clears after {TEMPORARY_MEMORY_RETENTION_HOURS} hours.
        </div>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) => onChange(nextValue as TemporaryMemoryMode)}
        >
          <DropdownMenuRadioItem
            value="standard"
            className="cursor-pointer rounded-lg px-3 py-2 focus:bg-slate-900"
          >
            <div className="space-y-1">
              <div className="font-medium text-white">Standard memory</div>
              <div className="text-xs text-slate-400">{getTemporaryMemorySummary('standard')}</div>
            </div>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="temporary"
            className="cursor-pointer rounded-lg px-3 py-2 focus:bg-slate-900"
          >
            <div className="space-y-1">
              <div className="font-medium text-white">Temporary memory</div>
              <div className="text-xs text-slate-400">{getTemporaryMemorySummary('temporary')}</div>
            </div>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
