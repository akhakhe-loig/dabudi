import React, { useState, useEffect } from "react";
import { Student, Lesson, Note, Task, Payment } from "./types";
import AppShell from "./components/AppShell";
import HomeTab from "./components/HomeTab";
import StudentsTab from "./components/StudentsTab";
import CalendarTab from "./components/CalendarTab";
import NotesTab from "./components/NotesTab";
import FinancesTab from "./components/FinancesTab";
import SettingsTab from "./components/SettingsTab";
import AppearanceScreen from "./components/AppearanceScreen";
import { AppTheme, DEFAULT_THEME, getAccent, getRadiusValue, wallpaperUrl } from "./theme";

// Pre-populated high-quality initial data bank to simulate SwiftData persistent storage
const INITIAL_STUDENTS: Student[] = [
  {
    id: "1",
    name: "Александр Волков",
    phone: "+7 (916) 123-45-67",
    email: "sasha.volkov@mail.ru",
    subject: "Математика ЕГЭ",
    hourlyRate: 1800,
    colorHex: "#007AFF", // iOS Blue
    isActive: true,
    notes: "Готовимся к профильному ЕГЭ по математике. Слабые места: стереометрия и задачи с параметром (№18). Цель: 85+ баллов.",
    avatarUrl: ""
  },
  {
    id: "2",
    name: "Мария Лебедева",
    phone: "+7 (925) 987-65-43",
    email: "masha.lebedeva@yandex.ru",
    subject: "Английский B2",
    hourlyRate: 1500,
    colorHex: "#34C759", // iOS Green
    isActive: true,
    notes: "Изучаем грамматику продвинутого уровня, готовимся к сдаче FCE. Большой упор делаем на устную речь (Speaking) и эссе (Writing).",
    avatarUrl: ""
  },
  {
    id: "3",
    name: "Дмитрий Морозов",
    phone: "+7 (903) 111-22-33",
    email: "dima_phys@gmail.com",
    subject: "Физика ОГЭ",
    hourlyRate: 1600,
    colorHex: "#FF9500", // iOS Orange
    isActive: true,
    notes: "Разбираем основы механики и электродинамики для сдачи ОГЭ. Дима смышленый, но иногда ленится оформлять задачи.",
    avatarUrl: ""
  }
];

const INITIAL_LESSONS = (): Lesson[] => {
  const today = new Date();
  
  // Set up lesson times on today's schedule
  const lesson1 = new Date(today);
  lesson1.setHours(15, 0, 0, 0); // today 15:00

  const lesson2 = new Date(today);
  lesson2.setHours(18, 30, 0, 0); // today 18:30

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(16, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);

  return [
    {
      id: "l1",
      studentId: "1",
      dateTime: lesson1.toISOString(),
      durationMinutes: 90,
      topic: "Уравнения с параметрами",
      homework: "Решить задачи 12-16 из тренировочного варианта №4",
      isCompleted: false,
      isCancelled: false,
      isPaid: false
    },
    {
      id: "l2",
      studentId: "2",
      dateTime: lesson2.toISOString(),
      durationMinutes: 60,
      topic: "Present Perfect vs Past Simple",
      homework: "Составить 10 предложений о своих путешествиях с временами Perfect",
      isCompleted: false,
      isCancelled: false,
      isPaid: false
    },
    {
      id: "l3",
      studentId: "3",
      dateTime: yesterday.toISOString(),
      durationMinutes: 60,
      topic: "Законы Ньютона",
      homework: "Сборник Демидовой, задачи 1.15 - 1.25",
      isCompleted: true,
      isCancelled: false,
      isPaid: false // unpaid to demonstrate debt alerts!
    },
    {
      id: "l4",
      studentId: "1",
      dateTime: tomorrow.toISOString(),
      durationMinutes: 90,
      topic: "Площади плоских фигур",
      homework: "Выучить формулы площадей четырехугольников",
      isCompleted: false,
      isCancelled: false,
      isPaid: false
    }
  ];
};

const INITIAL_PAYMENTS: Payment[] = [
  {
    id: "p1",
    studentId: "1",
    amount: 2700, // 1.5 hours * 1800
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    isReceived: true
  },
  {
    id: "p2",
    studentId: "2",
    amount: 1500,
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isReceived: true
  }
];

const INITIAL_NOTES: Note[] = [
  {
    id: "n1",
    title: "План на ЕГЭ: Александр Волков",
    content: "Александру нужно набрать минимум 82 балла для поступления на бюджет. \n\nПлан по блокам:\n- Сентябрь: Алгебраические уравнения и неравенства (№12, №14)\n- Октябрь: Экономические задачи (№15)\n- Ноябрь-Декабрь: Геометрия (планиметрия и стереометрия)\n- Январь: Теория чисел и параметры.",
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    isPinned: true,
    checklist: [
      { id: "c1", text: "Пройти тест на базовые формулы тригонометрии", isCompleted: true },
      { id: "c2", text: "Объяснить геометрический смысл производной", isCompleted: false },
      { id: "c3", text: "Разобрать схему Лагранжа в экономических задачах", isCompleted: false }
    ]
  },
  {
    id: "n2",
    title: "Разговорные темы: Мария Л.",
    content: "Список топиков для отработки разговорной части FCE:\n1. Global warming and environment protection.\n2. Traveling: off the beaten track vs package holidays.\n3. Modern professions: freelance, digital nomads and remote work.",
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    isPinned: false,
    checklist: []
  }
];

const INITIAL_TASKS = (): Task[] => {
  const today = new Date().toISOString().split("T")[0];
  return [
    {
      id: "t1",
      title: "Подготовить раздаточные материалы (Стереометрия)",
      dueDate: `${today}T12:00:00.000Z`,
      isCompleted: false,
      studentId: "1"
    },
    {
      id: "t2",
      title: "Проверить эссе по английскому у Маши",
      dueDate: `${today}T17:00:00.000Z`,
      isCompleted: false,
      studentId: "2"
    },
    {
      id: "t3",
      title: "Отправить домашнее задание родителям Димы",
      dueDate: `${today}T20:00:00.000Z`,
      isCompleted: true,
      studentId: "3"
    }
  ];
};

export default function App() {
  const [activeTab, setActiveTab] = useState("home");

  // Внешний вид (тема, цвет, скругление, обои) — сохраняется в localStorage
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_THEME);
  const [showAppearance, setShowAppearance] = useState(false);
  const activeDarkMode = theme.dark;

  // Core CRM states (backed by local storage)
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Simulated Live Activity / Timer states
  const [isLiveActivityActive, setIsLiveActivityActive] = useState(false);
  const [liveActivityStudent, setLiveActivityStudent] = useState("");
  const [liveActivityTimeLeft, setLiveActivityTimeLeft] = useState(0);

  // Siri Interaction notification state
  const [siriMessage, setSiriMessage] = useState<{ text: string; response: string } | null>(null);

  // Active sheets
  const [showAddStudentSheet, setShowAddStudentSheet] = useState(false);
  const [showAddLessonSheet, setShowAddLessonSheet] = useState(false);
  const [showAddPaymentSheet, setShowAddPaymentSheet] = useState(false);

  // 1. Local Storage initialization
  useEffect(() => {
    const cachedStudents = localStorage.getItem("tutor_crm_students");
    const cachedLessons = localStorage.getItem("tutor_crm_lessons");
    const cachedPayments = localStorage.getItem("tutor_crm_payments");
    const cachedNotes = localStorage.getItem("tutor_crm_notes");
    const cachedTasks = localStorage.getItem("tutor_crm_tasks");

    if (cachedStudents) setStudents(JSON.parse(cachedStudents));
    else {
      setStudents(INITIAL_STUDENTS);
      localStorage.setItem("tutor_crm_students", JSON.stringify(INITIAL_STUDENTS));
    }

    if (cachedLessons) setLessons(JSON.parse(cachedLessons));
    else {
      const initL = INITIAL_LESSONS();
      setLessons(initL);
      localStorage.setItem("tutor_crm_lessons", JSON.stringify(initL));
    }

    if (cachedPayments) setPayments(JSON.parse(cachedPayments));
    else {
      setPayments(INITIAL_PAYMENTS);
      localStorage.setItem("tutor_crm_payments", JSON.stringify(INITIAL_PAYMENTS));
    }

    if (cachedNotes) setNotes(JSON.parse(cachedNotes));
    else {
      setNotes(INITIAL_NOTES);
      localStorage.setItem("tutor_crm_notes", JSON.stringify(INITIAL_NOTES));
    }

    if (cachedTasks) setTasks(JSON.parse(cachedTasks));
    else {
      const initT = INITIAL_TASKS();
      setTasks(initT);
      localStorage.setItem("tutor_crm_tasks", JSON.stringify(initT));
    }
  }, []);

  // Загрузка настроек внешнего вида
  useEffect(() => {
    const cached = localStorage.getItem("tutor_crm_theme");
    if (cached) {
      try {
        setTheme({ ...DEFAULT_THEME, ...JSON.parse(cached) });
      } catch {
        /* ignore malformed */
      }
    }
  }, []);

  // Сохранение настроек внешнего вида
  useEffect(() => {
    localStorage.setItem("tutor_crm_theme", JSON.stringify(theme));
  }, [theme]);

  // Применение акцентного цвета и скругления к :root — переопределяет
  // палитру blue-* из index.css, поэтому весь интерфейс следует теме.
  useEffect(() => {
    const a = getAccent(theme.accent);
    const root = document.documentElement;
    root.style.setProperty("--accent", a.accent);
    root.style.setProperty("--accent-dark", a.accentDark);
    root.style.setProperty("--radius", getRadiusValue(theme.radius));
  }, [theme.accent, theme.radius]);

  // Sync state triggers
  const saveState = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  // 2. State Actions handlers
  const handleAddStudent = (newS: Omit<Student, "id">) => {
    const student: Student = {
      ...newS,
      id: Date.now().toString()
    };
    const updated = [...students, student];
    setStudents(updated);
    saveState("tutor_crm_students", updated);
  };

  const handleDeleteStudent = (id: string) => {
    const updated = students.filter(s => s.id !== id);
    setStudents(updated);
    saveState("tutor_crm_students", updated);

    // Cascade delete lessons/payments
    const filteredL = lessons.filter(l => l.studentId !== id);
    setLessons(filteredL);
    saveState("tutor_crm_lessons", filteredL);

    const filteredP = payments.filter(p => p.studentId !== id);
    setPayments(filteredP);
    saveState("tutor_crm_payments", filteredP);
  };

  const handleAddLesson = (newL: Omit<Lesson, "id">) => {
    const lesson: Lesson = {
      ...newL,
      id: Date.now().toString()
    };
    const updated = [...lessons, lesson];
    setLessons(updated);
    saveState("tutor_crm_lessons", updated);
  };

  const handleAddPayment = (newP: Omit<Payment, "id">) => {
    const payment: Payment = {
      ...newP,
      id: Date.now().toString()
    };
    const updated = [...payments, payment];
    setPayments(updated);
    saveState("tutor_crm_payments", updated);
  };

  const handleUpdateLesson = (updatedL: Lesson) => {
    const updated = lessons.map(l => l.id === updatedL.id ? updatedL : l);
    setLessons(updated);
    saveState("tutor_crm_lessons", updated);
  };

  const handleMarkLessonCompleted = (lessonId: string) => {
    const updated = lessons.map(l => l.id === lessonId ? { ...l, isCompleted: true } : l);
    setLessons(updated);
    saveState("tutor_crm_lessons", updated);
  };

  // Mark lesson as paid and automatically insert Payment record
  const handleMarkLessonPaid = (lessonId: string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) return;

    // Settle lesson state
    const updatedLessons = lessons.map(l => l.id === lessonId ? { ...l, isPaid: true, isCompleted: true } : l);
    setLessons(updatedLessons);
    saveState("tutor_crm_lessons", updatedLessons);

    // Insert payment record
    const student = students.find(s => s.id === lesson.studentId);
    const amount = student ? student.hourlyRate * (lesson.durationMinutes / 60) : 1500;
    
    handleAddPayment({
      studentId: lesson.studentId,
      lessonId,
      amount,
      date: new Date().toISOString(),
      isReceived: true
    });
  };

  const handleToggleTask = (id: string) => {
    const updated = tasks.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t);
    setTasks(updated);
    saveState("tutor_crm_tasks", updated);
  };

  const handleAddNote = (newN: Omit<Note, "id">) => {
    const note: Note = {
      ...newN,
      id: Date.now().toString()
    };
    const updated = [note, ...notes];
    setNotes(updated);
    saveState("tutor_crm_notes", updated);
  };

  const handleUpdateNote = (updatedN: Note) => {
    const updated = notes.map(n => n.id === updatedN.id ? updatedN : n);
    setNotes(updated);
    saveState("tutor_crm_notes", updated);
  };

  const handleDeleteNote = (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    saveState("tutor_crm_notes", updated);
  };

  // 3. Live Activity decrement clock loop
  useEffect(() => {
    let timer: any = null;
    if (isLiveActivityActive && liveActivityTimeLeft > 0) {
      timer = setInterval(() => {
        setLiveActivityTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (liveActivityTimeLeft === 0 && isLiveActivityActive) {
      setIsLiveActivityActive(false);
      
      // Auto-complete and record billing in database for simulated lesson!
      const activeLesson = lessons.find(l => {
        const stud = students.find(s => s.id === l.studentId);
        return stud && stud.name === liveActivityStudent && !l.isCompleted;
      });

      if (activeLesson) {
        handleMarkLessonPaid(activeLesson.id);
        alert(`🎉 Урок с учеником ${liveActivityStudent} успешно завершен! Оплата зачислена на баланс.`);
      } else {
        alert(`🎉 Урок с учеником ${liveActivityStudent} успешно завершен!`);
      }
    }
    return () => clearInterval(timer);
  }, [isLiveActivityActive, liveActivityTimeLeft]);

  const handleStartLiveActivity = (studentName: string, durationMinutes: number) => {
    setLiveActivityStudent(studentName);
    setLiveActivityTimeLeft(60); // mock lesson for 60 seconds of real-time so it's fully observable!
    setIsLiveActivityActive(true);
  };

  const handleStopLiveActivity = () => {
    setIsLiveActivityActive(false);
  };

  // Siri command alerts
  const handleTriggerSiri = (command: string, response: string) => {
    setSiriMessage({ text: command, response });
    
    // Auto-trigger navigation context matching Siri response!
    if (command.includes("расписание")) {
      setActiveTab("home");
    } else if (command.includes("ученик")) {
      setActiveTab("students");
      setShowAddStudentSheet(true);
    }
  };

  return (
    <div className="h-[100dvh] w-full">
    <AppShell
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      activeDarkMode={activeDarkMode}
      wallpaperUrl={wallpaperUrl(theme.wallpaper)}
      isLiveActivityActive={isLiveActivityActive}
      liveActivityStudent={liveActivityStudent}
      liveActivityTimeLeft={liveActivityTimeLeft}
      onStopLiveActivity={handleStopLiveActivity}
      siriMessage={siriMessage}
      onClearSiri={() => setSiriMessage(null)}
    >
            {/* Active app tabs route director */}
            {activeTab === "home" && (
              <HomeTab
                students={students}
                lessons={lessons}
                tasks={tasks}
                payments={payments}
                toggleTask={handleToggleTask}
                onStartLiveActivity={handleStartLiveActivity}
                isLiveActivityActive={isLiveActivityActive}
                onOpenSheet={(type) => {
                  if (type === "addStudent") setShowAddStudentSheet(true);
                  else if (type === "addLesson") setShowAddLessonSheet(true);
                  else if (type === "addPayment") setShowAddPaymentSheet(true);
                }}
                onMarkLessonCompleted={handleMarkLessonCompleted}
                onMarkLessonPaid={handleMarkLessonPaid}
                activeDarkMode={activeDarkMode}
              />
            )}

            {activeTab === "students" && (
              <StudentsTab
                students={students}
                lessons={lessons}
                payments={payments}
                onAddStudent={handleAddStudent}
                onDeleteStudent={handleDeleteStudent}
                onAddLesson={handleAddLesson}
                onAddPayment={handleAddPayment}
                onUpdateLesson={handleUpdateLesson}
                activeDarkMode={activeDarkMode}
                showAddStudentSheet={showAddStudentSheet}
                onCloseAddStudentSheet={() => setShowAddStudentSheet(!showAddStudentSheet)}
              />
            )}

            {activeTab === "calendar" && (
              <CalendarTab
                students={students}
                lessons={lessons}
                onAddLesson={handleAddLesson}
                activeDarkMode={activeDarkMode}
              />
            )}

            {activeTab === "notes" && (
              <NotesTab
                notes={notes}
                onAddNote={handleAddNote}
                onUpdateNote={handleUpdateNote}
                onDeleteNote={handleDeleteNote}
                activeDarkMode={activeDarkMode}
              />
            )}

            {activeTab === "finances" && (
              <FinancesTab
                students={students}
                lessons={lessons}
                payments={payments}
                onMarkLessonPaid={handleMarkLessonPaid}
                activeDarkMode={activeDarkMode}
              />
            )}

            {activeTab === "settings" && (
              <SettingsTab
                students={students}
                lessons={lessons}
                payments={payments}
                activeDarkMode={activeDarkMode}
                onToggleDarkMode={() => setTheme((t) => ({ ...t, dark: !t.dark }))}
                onOpenAppearance={() => setShowAppearance(true)}
                onTriggerSiriAlert={handleTriggerSiri}
              />
            )}
    </AppShell>

      {showAppearance && (
        <AppearanceScreen
          theme={theme}
          onChange={setTheme}
          onClose={() => setShowAppearance(false)}
        />
      )}
    </div>
  );
}
