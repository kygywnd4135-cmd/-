import {STARTER_AVATARS} from './lib/appearance';

export default function AccountAvatar({profile, size = 74, frame, className = ''}: {
  profile: {avatar?: number; avatarUrl?: string; frame?: string}; size?: number; frame?: string; className?: string;
}) {
  const border = frame ?? profile.frame;
  return <span className={`account-avatar ${border === 'crimson' ? 'frame-crime-city' : 'frame-none'} ${className}`} style={{width: size, height: size}}>
    <img src={profile.avatarUrl || STARTER_AVATARS[profile.avatar === 1 ? 1 : 0].url} alt="" draggable={false}/>
  </span>;
}
