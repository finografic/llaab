/**
 * Icons.generated.ts
 *
 * !! GENERATED FILE — managed by @finografic/icons icon manager.
 * !! To update: run your icons manager script (pnpm icons or similar).
 */

import { createIconWrapper } from '@finografic/icons';
import * as Lucide from 'lucide-react';

// ── Icon registry ──────────────────────────────────────────────────────────────

const ICONS = {
  AddIcon: Lucide.Plus,
  AlarmClockCheckIcon: Lucide.AlarmClockCheck,
  ApertureIcon: Lucide.Aperture,
  AppleIcon: Lucide.Apple,
  ArrowDownIcon: Lucide.ArrowDown,
  ArrowDownToLineIcon: Lucide.ArrowDownToLine,
  ArrowLeftIcon: Lucide.ArrowLeft,
  ArrowRightIcon: Lucide.ArrowRight,
  ArrowUpIcon: Lucide.ArrowUp,
  BadgeCheckIcon: Lucide.BadgeCheck,
  BrushCleaningIcon: Lucide.BrushCleaning,
  CheckIcon: Lucide.Check,
  CheckCircleIcon: Lucide.CheckCircle2,
  ChevronDownIcon: Lucide.ChevronDown,
  ChevronLeftIcon: Lucide.ChevronLeft,
  ChevronRightIcon: Lucide.ChevronRight,
  ChevronsUpDownIcon: Lucide.ChevronsUpDown,
  ChevronUpIcon: Lucide.ChevronUp,
  ClipboardIcon: Lucide.Clipboard,
  CloseIcon: Lucide.X,
  CoffeeIcon: Lucide.Coffee,
  Columns3Icon: Lucide.Columns3,
  Columns4Icon: Lucide.Columns4,
  CountdownTimerIcon: Lucide.Hourglass,
  Cross2Icon: Lucide.X,
  DeleteIcon: Lucide.X,
  DialogIcon: Lucide.AppWindowMac,
  DoubleArrowLeftIcon: Lucide.ChevronsLeft,
  DoubleArrowRightIcon: Lucide.ChevronsRight,
  DropdownIcon: Lucide.ChevronDown,
  EditIcon: Lucide.PencilLine,
  ExclamationTriangleIcon: Lucide.TriangleAlert,
  EyeOffIcon: Lucide.EyeOff,
  EyeOnIcon: Lucide.Eye,
  FastForwardIcon: Lucide.FastForward,
  FileIcon: Lucide.File,
  FolderIcon: Lucide.Folder,
  FolderCodeIcon: Lucide.FolderCode,
  FolderKanbanIcon: Lucide.FolderKanban,
  FolderOpenIcon: Lucide.FolderOpen,
  FolderRootIcon: Lucide.FolderRoot,
  FolderSyncIcon: Lucide.FolderSync,
  FolderTreeIcon: Lucide.FolderTree,
  FullscreenIcon: Lucide.Fullscreen,
  GridIcon: Lucide.Grid3x3,
  HomeIcon: Lucide.House,
  InfoCircledIcon: Lucide.Info,
  LanguageIcon: Lucide.Languages,
  ListIcon: Lucide.List,
  ListChecksIcon: Lucide.ListChecks,
  LoaderIcon: Lucide.Loader,
  LockIcon: Lucide.Lock,
  MagnifyingGlassIcon: Lucide.Search,
  MenuIcon: Lucide.Menu,
  MinimizeIcon: Lucide.Minimize,
  MinusIcon: Lucide.Minus,
  MoonIcon: Lucide.Moon,
  PanelBottomCloseIcon: Lucide.PanelBottomClose,
  PanelBottomOpenIcon: Lucide.PanelBottomOpen,
  PanelLeftCloseIcon: Lucide.PanelLeftClose,
  PanelLeftOpenIcon: Lucide.PanelLeftOpen,
  PlayIcon: Lucide.Play,
  PlusIcon: Lucide.Plus,
  RadioIcon: Lucide.Radio,
  RefreshIcon: Lucide.RefreshCcw,
  ReloadIcon: Lucide.RotateCw,
  SettingsIcon: Lucide.Cog,
  ShieldCheckIcon: Lucide.ShieldCheck,
  ShuffleIcon: Lucide.Shuffle,
  SpeakerLoudIcon: Lucide.Volume2,
  StarIcon: Lucide.Star,
  StopIcon: Lucide.CircleStop,
  SunIcon: Lucide.Sun,
  TempIcon: Lucide.Thermometer,
  TextAlignLeftIcon: Lucide.AlignLeft,
  TextAlignTopIcon: Lucide.AlignStartVertical,
  TimerIcon: Lucide.Timer,
  TimerResetIcon: Lucide.TimerReset,
  TrashIcon: Lucide.Trash2,
  UploadIcon: Lucide.Upload,
  UserIcon: Lucide.User,
  UserCircleIcon: Lucide.CircleUserRound,
  UserLockIcon: Lucide.UserLock,
  UserRoundCheckIcon: Lucide.UserRoundCheck,
  UserShieldIcon: Lucide.ShieldUser,
  VolumeIcon: Lucide.Volume2,
  VolumeOffIcon: Lucide.VolumeOff,
  WindowIcon: Lucide.AppWindowMac,
  WineIcon: Lucide.Wine,
  XIcon: Lucide.X,
  ZapIcon: Lucide.Zap,
} as const;

// ── Auto-wrap ──────────────────────────────────────────────────────────────────

type WrappedIconMap = { [K in keyof typeof ICONS]: ReturnType<typeof createIconWrapper> };

const wrappedIcons = Object.fromEntries(
  Object.entries(ICONS).map(([name, icon]) => [name, createIconWrapper(icon, name)]),
) as WrappedIconMap;

// ── Public API ─────────────────────────────────────────────────────────────────

/** All registered icons as a strongly-typed object. */
export const icons = wrappedIcons;

/** Union of all registered icon export names. */
export type IconName = keyof typeof ICONS;

/** Sorted list of all registered icon names. */
export const ICON_NAMES = (Object.keys(ICONS) as IconName[]).sort();

/** Type of any wrapped icon component. */
export type IconComponent = ReturnType<typeof createIconWrapper>;
