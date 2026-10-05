import type { CRUDStatCard } from './GenericCRUDPage.types';
import { Card, CardContent } from '../ui/CardV2';

/** Read-only summaries retain their complete label, value and scope on phones. */
export function CRUDSummary({ stats, desktopColumns = 4 }: { stats: readonly CRUDStatCard[]; desktopColumns?: 4 | 5 }) {
  return <div role="group" aria-label="Resumen de registros" className={`grid grid-cols-2 ${desktopColumns === 5 ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-2 sm:gap-4`}>
    {stats.map((stat, index) => <Card key={index} padding="none">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className={`p-1.5 sm:p-2 ${stat.iconBg} ${stat.iconColor} rounded-lg shrink-0`}>
            {stat.icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg sm:text-2xl font-bold text-neutral-900 break-words">{stat.value}</p>
            <p className="text-xs sm:text-sm leading-5 text-neutral-600 whitespace-normal break-words">{stat.label}</p>
          </div>
        </div>
      </CardContent>
    </Card>)}
  </div>;
}
