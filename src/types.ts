export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface Student {
  id: string;
  name: string;
  avatarUrl: string;
  phone: string;
  email: string;
  subject: string;
  hourlyRate: number;
  notes: string;
  colorHex: string;
  isActive: boolean;
}

export interface Lesson {
  id: string;
  studentId: string;
  dateTime: string; // ISO String
  durationMinutes: number;
  topic: string;
  homework: string;
  isCompleted: boolean;
  isCancelled: boolean;
  isPaid: boolean;
}

export interface Payment {
  id: string;
  studentId: string;
  lessonId?: string;
  amount: number;
  date: string; // ISO String
  isReceived: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string; // ISO String
  isPinned: boolean;
  checklist?: ChecklistItem[];
  voiceDuration?: number; // in seconds
  voiceWaveform?: number[];
}

export interface Task {
  id: string;
  title: string;
  dueDate: string; // ISO String
  isCompleted: boolean;
  studentId?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  appName: string;
}
