import { StudentJourney } from '../../types/school.types';
import { StudentJourneyDrawerBase } from '../institution/StudentJourneyDrawerBase';

type Props = {
  journey?: StudentJourney;
  open: boolean;
  onClose: () => void;
};

export default function StudentJourneyDrawer(props: Props) {
  return <StudentJourneyDrawerBase {...props} />;
}
