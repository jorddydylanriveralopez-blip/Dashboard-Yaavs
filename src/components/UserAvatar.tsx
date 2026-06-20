import type { User } from '../types';
import './UserAvatar.css';

interface Props {
  user: Pick<User, 'name' | 'avatarColor' | 'avatarUrl'>;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function UserAvatar({ user, size = 'md', className = '' }: Props) {
  const letter = user.name.trim().charAt(0).toUpperCase() || '?';
  const classes = `user-avatar user-avatar--${size}${className ? ` ${className}` : ''}`;

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className={`${classes} user-avatar--photo`}
      />
    );
  }

  return (
    <div className={classes} style={{ background: user.avatarColor ?? 'var(--accent)' }}>
      {letter}
    </div>
  );
}
