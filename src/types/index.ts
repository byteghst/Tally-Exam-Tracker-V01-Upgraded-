// ---------- Shared ----------

export type ID = string;

export interface BaseEntity {
  id: ID;
  createdAt: number;
  updatedAt: number;
}

// ---------- Exam configs (reusable course scoring templates) ----------
// e.g. "উদ্ভাসে ভার্সিটি 'ক' কোর্স" — one config holds the MCQ/written
// structure for each of daily/weekly/monthly, plus a shared negative-marking
// rate. Adding an exam against a config auto-fills the structure so you only
// ever type the actual result.

export type ExamType = 'daily' | 'weekly' | 'monthly';

export interface ExamConfigTypeSetting {
  type: ExamType;
  mcqCount: number;
  mcqMarksEach: number;
  writtenCount: number;
  writtenMarksEach: number;
}

export interface ExamConfig extends BaseEntity {
  name: string;
  negativeMarkPerWrong: number;
  types: ExamConfigTypeSetting[];
}

// ---------- Exams (scheduling + recorded results) ----------

export type ExamStatus = 'upcoming' | 'completed' | 'missed';

export interface Exam extends BaseEntity {
  configId?: ID;
  name: string;
  type: ExamType;
  date: string; // ISO date (yyyy-mm-dd), local
  startTime?: string; // HH:mm
  status: ExamStatus;

  // Scoring structure — snapshotted from the chosen config at creation time
  // (or entered manually if no config is used) so later config edits never
  // silently rewrite the history of an already-recorded exam.
  mcqCount: number;
  mcqMarksEach: number;
  writtenCount: number;
  writtenMarksEach: number;
  negativeMarkPerWrong: number;

  // Recorded result
  mcqCorrect?: number;
  mcqWrong?: number;
  mcqUnanswered?: number;
  writtenMarksObtained?: number;
  manualScoreOverride?: number;
  rank?: number;
  participants?: number;
  notes?: string;
  reminderMinutesBefore?: number;
}

// ---------- Tasks ----------

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'skipped' | 'archived';
export type RecurrenceFreq = 'daily' | 'weekdays' | 'weekly' | 'custom';

export interface RecurrenceRule {
  freq: RecurrenceFreq;
  daysOfWeek?: number[]; // 0=Sun..6=Sat, used for 'weekly' and 'custom'
  interval?: number; // every N days/weeks, default 1
  endDate?: string;
}

export interface Task extends BaseEntity {
  name: string;
  date?: string;
  time?: string;
  estimatedDuration?: number; // minutes
  actualDuration?: number;
  priority: TaskPriority;
  status: TaskStatus;
  category?: string;
  notes?: string;
  recurrence?: RecurrenceRule;
  seriesId?: ID; // links generated instances back to their recurring parent
  reminderMinutesBefore?: number;
}

// ---------- Settings ----------

export type ThemeMode = 'light' | 'dark' | 'system';
export type AnimationLevel = 'full' | 'reduced' | 'none';
export type DensityLevel = 'comfortable' | 'compact';

export interface WidgetConfig {
  id: string;
  visible: boolean;
  order: number;
  size?: 'sm' | 'md' | 'lg';
}

export interface NotificationPrefs {
  exams: boolean;
  tasks: boolean;
  /**
   * Automatic heads-up at 8 PM the evening before each upcoming exam.
   * Optional so settings saved before this existed still load; a missing
   * value counts as ON.
   */
  examEveningBefore?: boolean;
  /** Automatic 8 AM briefing on days with an exam or tasks due. Missing = ON. */
  morningBriefing?: boolean;
}

export interface AppSettings {
  theme: ThemeMode;
  accentColor: string;
  glassIntensity: number; // 0-100
  blurIntensity: number; // 0-100
  radius: number; // px
  density: DensityLevel;
  animationLevel: AnimationLevel;
  reducedTransparency: boolean;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  firstDayOfWeek: 0 | 1;
  scoringPrecision: number; // decimal places
  defaultExamType: ExamType;
  defaultTaskPriority: TaskPriority;
  notificationPrefs: NotificationPrefs;
  dashboardLayout: WidgetConfig[];
  streaksEnabled: boolean;
  onboardingCompleted: boolean;
  userName?: string;
  showFocusNow: boolean;
  showDailyMission: boolean;
  dailyMissionDismissedDate?: string;
  celebratedMilestoneIds: string[];
  celebrationBaselineDone: boolean;
  notifiedReminderIds: string[];
}

// ---------- Scoring engine I/O ----------

export interface ScoreInput {
  mcqCount: number;
  mcqMarksEach: number;
  writtenCount: number;
  writtenMarksEach: number;
  negativeMarkPerWrong: number;
  mcqCorrect?: number;
  mcqWrong?: number;
  mcqUnanswered?: number;
  writtenMarksObtained?: number;
  manualScore?: number;
}

export interface ScoreResult {
  totalMarks: number;
  mcqScore: number;
  writtenScore: number;
  calculatedScore: number;
  finalScore: number;
  isManualOverride: boolean;
  percentage: number | null;
  accuracy: number | null; // mcqCorrect / (mcqCorrect+mcqWrong)
  attemptRate: number | null; // (mcqCorrect+mcqWrong) / mcqCount
}
