import { Card } from '../../components/ui/Card';
import { HiringPartner } from '../../types/placement.types';

type Props = {
  partners: HiringPartner[];
};

export default function HiringPartnersList({ partners }: Props) {
  if (partners.length === 0) {
    return (
      <Card className="p-5 text-sm text-slate-400">
        No recruiters with active jobs or drives are linked to this college yet.
      </Card>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {partners.map((partner) => (
        <Card key={partner._id} className="p-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-xl font-bold text-white">
              {partner.avatar ? (
                <img
                  src={partner.avatar}
                  alt={partner.displayName}
                  className="h-14 w-14 rounded-2xl object-cover"
                />
              ) : (
                partner.displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <div className="text-xl font-semibold text-white">{partner.displayName}</div>
              <div className="mt-1 text-sm text-amber-300">{partner.company}</div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-400">
                <div>
                  <div className="text-lg font-semibold text-white">{partner.openPositions}</div>
                  Open Positions
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">{partner.activeDrives}</div>
                  Active Drives
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {partner.domains.map((domain) => (
                  <span
                    key={domain}
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
