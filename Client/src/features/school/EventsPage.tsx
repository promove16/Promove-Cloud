import { schoolApi } from '../../api/school.api';
import { InstitutionEventsPageBase } from '../institution/InstitutionEventsPageBase';

export default function EventsPage() {
  return (
    <InstitutionEventsPageBase
      mode="school"
      title="School Events"
      subtitle="Upcoming institution events surfaced from the school overview."
      basePath="/dashboard/school"
      fetchEvents={schoolApi.getEvents}
    />
  );
}
