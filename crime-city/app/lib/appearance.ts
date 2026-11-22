export const STARTER_AVATARS = [
  {id: 0, name: '남자 A', url: '/assets/profiles/male-a.webp'},
  {id: 1, name: '여자 A', url: '/assets/profiles/female-a.webp'},
] as const;
export const STARTER_FRAMES = [
  {id: 'classic', name: '테두리 없음'},
  {id: 'crimson', name: '크라임 시티'},
] as const;
export const isStarterAvatar = (value: unknown): value is number => value === 0 || value === 1;
export const isStarterFrame = (value: unknown): value is string => value === 'classic' || value === 'crimson';
export function photoUrl(id: string, version: string) {return `/api/profile-photos/${id}?v=${encodeURIComponent(version)}`;}
export function avatarUrl(profile: {id?: string; avatar?: number; usePhoto?: number; photoVersion?: string | null}) {
  return profile.usePhoto && profile.id && profile.photoVersion ? photoUrl(profile.id, profile.photoVersion) : STARTER_AVATARS[profile.avatar === 1 ? 1 : 0].url;
}
