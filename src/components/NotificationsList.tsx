import {
  formatNotificationTime,
  notificationKindLabel,
  type EmployeeNotification,
  type NotificationTarget,
} from '../utils/employeeNotifications';
import './NotificationsList.css';

interface Props {
  notifications: EmployeeNotification[];
  emptyMessage?: string;
  onSelect: (item: EmployeeNotification) => void;
  compact?: boolean;
}

export function NotificationsList({
  notifications,
  emptyMessage = 'No tienes notificaciones nuevas.',
  onSelect,
  compact = false,
}: Props) {
  if (notifications.length === 0) {
    return <p className="notifications-list-empty">{emptyMessage}</p>;
  }

  return (
    <ul className={`notifications-list ${compact ? 'notifications-list--compact' : ''}`}>
      {notifications.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={`notifications-list-item ${item.unread ? 'is-unread' : ''}`}
            onClick={() => onSelect(item)}
          >
            <span className={`notifications-list-kind kind-${item.kind}`}>
              {notificationKindLabel(item.kind)}
            </span>
            <strong>{item.title}</strong>
            <span className="notifications-list-detail">{item.detail}</span>
            <time dateTime={item.at}>{formatNotificationTime(item.at)}</time>
          </button>
        </li>
      ))}
    </ul>
  );
}

export type { NotificationTarget };
