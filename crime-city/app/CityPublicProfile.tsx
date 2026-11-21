'use client';

import CityExpandedProfile from './CityExpandedProfile';

export default function CityPublicProfile(props: {
  userId: string;
  scale: number;
  onClose: () => void;
  notify: (message: string) => void;
}) {
  return <CityExpandedProfile {...props}/>;
}
