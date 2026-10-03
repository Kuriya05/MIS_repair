/**
 * ชุดไอคอนกลาง (ui-design-system.md ข้อ 14): inline SVG · viewBox 24 · stroke currentColor 1.8 · ปลายเส้นมน
 * ตั้งชื่อตาม Material Symbols · ไอคอนประกอบข้อความเป็น aria-hidden เสมอ (ส่ง title เมื่อใช้ไอคอนเดี่ยว)
 */
import type { ReactNode, SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Icon({ title, className = 'h-5 w-5', children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      focusable="false"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const DashboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
    <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" />
    <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
  </Icon>
);

export const BuildIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.7 6.3a4 4 0 0 0-5.3 5.3L3.5 17.5a1.8 1.8 0 0 0 2.6 2.6l5.9-5.9a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.3-.6-.6-2.3z" />
  </Icon>
);

export const AssignmentIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5V3.5h6v1M9 10h6M9 14h6M9 18h3" />
  </Icon>
);

export const AddIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const InboxIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 13.5 6.5 5h11l2.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
    <path d="M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20" />
  </Icon>
);

/** บอร์ดงาน (คอลัมน์ 3 แถว) */
export const BoardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="2" />
    <path d="M9.5 4v16M14.5 4v16" />
    <path d="M5.5 7.5h2M11 7.5h2M16.5 7.5h2M5.5 10.5h2M16.5 10.5h2" />
  </Icon>
);

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6" />
  </Icon>
);

export const QrCodeIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="6" height="6" rx="1" />
    <rect x="14.5" y="3.5" width="6" height="6" rx="1" />
    <rect x="3.5" y="14.5" width="6" height="6" rx="1" />
    <path d="M14.5 14.5h2.5v2.5M20.5 14.5v2M14.5 20.5h2M18 18h2.5v2.5" />
  </Icon>
);

export const NotificationsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);

export const PersonIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Icon>
);

export const GroupIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.2a6.5 6.5 0 0 1 4 5.8" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 20.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5h3.5" />
    <path d="M16 16.5 20.5 12 16 7.5M20.5 12H9.5" />
  </Icon>
);

export const MenuIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6.5h16M4 12h16M4 17.5h16" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20h4L19.5 8.5a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
);

export const DeleteIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3L9.5 4.5h5L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="m20.5 16-4.5-4.5-8.5 8" />
  </Icon>
);

export const ScheduleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.3 2.5 2.5 4.8-5" />
  </Icon>
);

export const WarningIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.3 4.3 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
    <path d="M12 9.5v4M12 17h.01" />
  </Icon>
);

export const ErrorIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5M12 16h.01" />
  </Icon>
);

export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);

export const ArrowBackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 5-7 7 7 7" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const PrintIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 8.5V3.5h10v5" />
    <rect x="3.5" y="8.5" width="17" height="8" rx="1.5" />
    <path d="M7 14h10v6.5H7z" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
  </Icon>
);

export const LocationIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0c0 5.6-6.5 11-6.5 11z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icon>
);

export const StarIcon = (p: IconProps & { filled?: boolean }) => {
  const { filled, ...rest } = p;
  return (
    <Icon {...rest} fill={filled ? 'currentColor' : 'none'}>
      <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8z" />
    </Icon>
  );
};

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12 20 4l-4.5 16-3.5-6.5z" />
    <path d="m12 13.5 8-9.5" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 6v12M15 6v12" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.5 5.5v13L18.5 12z" />
  </Icon>
);

export const BlockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 6 12 12" />
  </Icon>
);

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H5.5A1.5 1.5 0 0 1 4 19z" />
  </Icon>
);

export const FilterIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5.5h16l-6 7v6l-4 2v-8z" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L19.5 9" />
    <path d="M19.5 4v5h-5" />
  </Icon>
);

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
);

export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4.5h3.5l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5z" />
  </Icon>
);

export const MailIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </Icon>
);

export const OpenInNewIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Icon>
);

export const KeyboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" />
  </Icon>
);

export const ApartmentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20.5V5.5A1.5 1.5 0 0 1 5.5 4h8A1.5 1.5 0 0 1 15 5.5v15M15 10h3.5a1.5 1.5 0 0 1 1.5 1.5v9M2.5 20.5h19" />
    <path d="M8 8h3M8 12h3M8 16h3" />
  </Icon>
);

export const CategoryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 7 11.5h10z" />
    <circle cx="17" cy="17" r="3.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1" />
  </Icon>
);

export const InventoryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z" />
    <path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" />
  </Icon>
);

export const LockIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const VerifiedUserIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5 5 6.5v5c0 4.4 3 8 7 9 4-1 7-4.6 7-9v-5z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 18.5 3.5 21V6A2.5 2.5 0 0 1 6 3.5h12A2.5 2.5 0 0 1 20.5 6v9.5A2.5 2.5 0 0 1 18 18z" />
    <path d="M8 9h8M8 13h5" />
  </Icon>
);

export const HistoryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5" />
    <path d="M4 4v4.5h4.5M12 8v4.5l3 1.8" />
  </Icon>
);

export const SwapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.5 3.5 8 7 11.5M3.5 8h13M17 12.5l3.5 3.5-3.5 3.5M20.5 16h-13" />
  </Icon>
);

export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 6h.01M12 12h.01M12 18h.01" strokeWidth={2.6} />
  </Icon>
);

export const ZoomInIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5" />
  </Icon>
);

/** ระดับความเร่งด่วน: ลูกศรคู่ขึ้น · ลูกศรขึ้น · เส้นคู่ · ลูกศรลง */
export const PriorityUrgentIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 11 6-6 6 6M6 18l6-6 6 6" />
  </Icon>
);

export const PriorityHighIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 15 6-6 6 6" />
  </Icon>
);

export const PriorityMediumIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9.5h12M6 14.5h12" />
  </Icon>
);

export const PriorityLowIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

export const PushPinIcon = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p}>
    <path d="M9 3.5h6l-1 5.5 3.5 3.5v1.5h-11V12.5L10 9z" fill={filled ? 'currentColor' : 'none'} />
    <path d="M12 14v6.5" />
  </Icon>
);

/* ไอคอนประเภทอุปกรณ์ในห้อง (CategoryIcon ของ API) */

export const ComputerIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="13" height="10" rx="1.5" />
    <path d="M7 18h5M9.5 14v4" />
    <rect x="18" y="4" width="3" height="14" rx="1" />
    <path d="M19.5 7.5h0" />
  </Icon>
);

export const MonitorIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M8.5 20h7M12 16v4" />
  </Icon>
);

export const ProjectorIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="8" width="19" height="9" rx="2" />
    <circle cx="16" cy="12.5" r="2.5" />
    <path d="M6 11.5h4M6 14h2M5 17v2M19 17v2" />
  </Icon>
);

export const AirconIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4.5" width="19" height="8" rx="2" />
    <path d="M6 10h12" />
    <path d="M8 15.5c0 1.5-1 2-1 3.5M12 15.5v4M16 15.5c0 1.5 1 2 1 3.5" />
  </Icon>
);

export const FanIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="10" r="1.5" />
    <path d="M12 8.5C11 5.5 12 3.5 14 3.5s2 3-2 5M13.4 10.6c3-.6 4.9.6 4.6 2.6s-3.3 1.6-4.6-2.6M10.6 10.6c-2.2 2.2-4.4 2.3-5.3.5s1.6-3.2 5.3-.5" />
    <path d="M12 11.5v6M8.5 20.5h7" />
  </Icon>
);

export const LightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 17.5h6M10 20.5h4" />
    <path d="M12 3.5a6 6 0 0 0-3.6 10.8c.4.3.6.8.6 1.3v1.9h6v-1.9c0-.5.2-1 .6-1.3A6 6 0 0 0 12 3.5Z" />
  </Icon>
);

export const NetworkIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="5" rx="1" />
    <rect x="3" y="16" width="6" height="5" rx="1" />
    <rect x="15" y="16" width="6" height="5" rx="1" />
    <path d="M12 8v4M6 16v-4h12v4" />
  </Icon>
);

export const AudioIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </Icon>
);

export const FurnitureIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 9.5h18M5 9.5v10M19 9.5v10M5 14h14" />
    <path d="M7 9.5V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5v4" />
  </Icon>
);
