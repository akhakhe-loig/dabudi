import React, { useState, useEffect } from "react";
import { 
  Play, CheckCircle2, Circle, Clock, DollarSign, Plus, UserPlus, 
  TrendingUp, Calendar, AlertCircle, MessageCircle, ArrowRight, Check 
} from "lucide-react";
import { Student, Lesson, Task, Payment } from "../types";
import { lessonsWord } from "../utils";

interface HomeTabProps {
  students: Student[];
  lessons: Lesson[];
  tasks: Task[];
  payments: Payment[];
  toggleTask: (id: string) => void;
  onStartLiveActivity: (studentName: string, durationMinutes: number) => void;
  isLiveActivityActive: boolean;
  onOpenSheet: (sheetType: "addStudent" | "addLesson" | "addPayment") => void;
  onMarkLessonCompleted: (lessonId: string) => void;
  onMarkLessonPaid: (lessonId: string) => void;
  activeDarkMode: boolean;
}

export default function HomeTab({
  students,
  lessons,
  tasks,
  payments,
  toggleTask,
  onStartLiveActivity,
  isLiveActivityActive,
  onOpenSheet,
  onMarkLessonCompleted,
  onMarkLessonPaid,
  activeDarkMode
}: HomeTabProps) {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [shakeId, setShakeId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format today's date in Russian like Apple Calendar
  const formatDate = () => {
    const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
    const months = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря"
    ];
    const d = new Date();
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`.toUpperCase();
  };

  // Find today's lessons
  const todayLessons = lessons.filter(l => {
    const lDate = new Date(l.dateTime);
    const today = new Date();
    return lDate.getDate() === today.getDate() &&
           lDate.getMonth() === today.getMonth() &&
           lDate.getFullYear() === today.getFullYear() &&
           !l.isCancelled;
  }).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

  // Find upcoming lesson (not completed, in future or starting soon)
  const upcomingLesson = lessons.find(l => {
    const lTime = new Date(l.dateTime).getTime();
    const now = new Date().getTime();
    return !l.isCompleted && !l.isCancelled && (lTime + l.durationMinutes * 60 * 1000) > now;
  });

  const getStudentForLesson = (studentId: string) => {
    return students.find(s => s.id === studentId);
  };

  // Calculate earnings for today (completed lessons)
  const todayEarnings = lessons
    .filter(l => {
      const lDate = new Date(l.dateTime);
      const today = new Date();
      return lDate.getDate() === today.getDate() &&
             lDate.getMonth() === today.getMonth() &&
             lDate.getFullYear() === today.getFullYear() &&
             l.isCompleted && !l.isCancelled;
    })
    .reduce((sum, l) => {
      const student = getStudentForLesson(l.studentId);
      const rate = student ? student.hourlyRate : 0;
      return sum + (l.durationMinutes / 60) * rate;
    }, 0);

  // Calculate earnings for current month
  const monthEarnings = payments
    .filter(p => {
      const pDate = new Date(p.date);
      const today = new Date();
      return pDate.getMonth() === today.getMonth() &&
             pDate.getFullYear() === today.getFullYear() &&
             p.isReceived;
    })
    .reduce((sum, p) => sum + p.amount, 0);

  // Unpaid lessons count & list
  const unpaidLessons = lessons.filter(l => l.isCompleted && !l.isPaid && !l.isCancelled);

  // Today's task list (filtered)
  const todayTasks = tasks.filter(t => {
    const tDate = new Date(t.dueDate);
    const today = new Date();
    return tDate.getDate() === today.getDate() &&
           tDate.getMonth() === today.getMonth() &&
           tDate.getFullYear() === today.getFullYear();
  });

  // Calculate countdown
  const getCountdownString = (dateTimeStr: string) => {
    const target = new Date(dateTimeStr).getTime();
    const now = currentTime.getTime();
    const diff = target - now;

    if (diff <= 0) {
      return "Идёт сейчас";
    }

    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    if (hrs > 0) {
      return `через ${hrs} ч. ${mins} мин.`;
    }
    return `через ${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 pb-24 space-y-5">
      {/* Date & Title Header */}
      <div className="space-y-0.5 pt-2">
        <span className="text-[10px] font-bold tracking-wider opacity-60 text-rose-500 uppercase">
          {formatDate()}
        </span>
        <h1 className={`text-2xl font-black tracking-tight ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>
          Сегодня
        </h1>
      </div>

      {/* Top Interactive Widget: Upcoming Lesson Card (Apple Health/Fantastical style) */}
      {upcomingLesson ? (
        (() => {
          const student = getStudentForLesson(upcomingLesson.studentId);
          if (!student) return null;
          const lessonTime = new Date(upcomingLesson.dateTime);
          return (
            <div 
              id="upcoming_lesson_card"
              className={`p-4 rounded-[var(--radius)] relative overflow-hidden transition-all duration-300 shadow-sm ${
                activeDarkMode 
                  ? "bg-[#2C2C2E] border border-[#3A3A3C]" 
                  : "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      activeDarkMode ? "bg-blue-500/20 text-blue-500" : "bg-white/20 text-white"
                    }`}>
                      Ближайший урок
                    </span>
                    <span className="text-xs font-semibold opacity-85 flex items-center gap-1">
                      <Clock size={11} />
                      {lessonTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold leading-tight pt-1">
                    {student.name}
                  </h3>
                  <p className="text-xs opacity-80 font-medium">
                    {student.subject} • {upcomingLesson.topic || "Новая тема"}
                  </p>
                </div>

                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${
                  activeDarkMode ? "bg-neutral-800 text-white border border-neutral-700" : "bg-white/15 text-white"
                }`} style={{ borderColor: activeDarkMode ? student.colorHex : "transparent" }}>
                  {student.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                </div>
              </div>

              {/* Bottom bar with Live Timer and Launch Action */}
              <div className="mt-5 pt-3 border-t border-white/10 flex items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] opacity-70 uppercase tracking-widest font-semibold">Начало</span>
                  <span className="text-sm font-black tracking-tight">
                    {getCountdownString(upcomingLesson.dateTime)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()
      ) : (
        <div className={`p-4 rounded-[var(--radius)] border text-center py-6 ${
          activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] text-neutral-400" : "bg-white border-[#E5E5EA] text-neutral-500"
        }`}>
          <Calendar size={28} className="mx-auto opacity-50 mb-2" />
          <p className="text-xs font-semibold">На сегодня занятий больше нет</p>
          <button 
            onClick={() => onOpenSheet("addLesson")}
            className="text-[11px] font-bold text-blue-500 mt-1 hover:underline"
          >
            Запланировать урок
          </button>
        </div>
      )}

      {/* Quick Actions (Apple Grid) */}
      <div className="grid grid-cols-3 gap-3">
        <button
          id="quick_action_add_student"
          onClick={() => onOpenSheet("addStudent")}
          className={`p-3 rounded-[var(--radius)] flex flex-col items-center justify-center gap-1.5 transition text-center shadow-xs active:scale-95 border ${
            activeDarkMode ? "bg-[#2C2C2E] hover:bg-[#3A3A3C] border-[#3A3A3C] text-white" : "bg-white hover:bg-neutral-50 border-[#E5E5EA] text-neutral-900"
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <UserPlus size={16} />
          </div>
          <span className="text-[10px] font-bold tracking-tight">Ученик</span>
        </button>

        <button
          id="quick_action_add_lesson"
          onClick={() => onOpenSheet("addLesson")}
          className={`p-3 rounded-[var(--radius)] flex flex-col items-center justify-center gap-1.5 transition text-center shadow-xs active:scale-95 border ${
            activeDarkMode ? "bg-[#2C2C2E] hover:bg-[#3A3A3C] border-[#3A3A3C] text-white" : "bg-white hover:bg-neutral-50 border-[#E5E5EA] text-neutral-900"
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Calendar size={16} />
          </div>
          <span className="text-[10px] font-bold tracking-tight">Занятие</span>
        </button>

        <button
          id="quick_action_log_payment"
          onClick={() => onOpenSheet("addPayment")}
          className={`p-3 rounded-[var(--radius)] flex flex-col items-center justify-center gap-1.5 transition text-center shadow-xs active:scale-95 border ${
            activeDarkMode ? "bg-[#2C2C2E] hover:bg-[#3A3A3C] border-[#3A3A3C] text-white" : "bg-white hover:bg-neutral-50 border-[#E5E5EA] text-neutral-900"
          }`}
        >
          <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
            <DollarSign size={16} />
          </div>
          <span className="text-[10px] font-bold tracking-tight">Оплата</span>
        </button>
      </div>

      {/* Finance Metrics Overview (Apple Activity Rings summary style) */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3.5 rounded-[var(--radius)] border flex items-center gap-3 shadow-xs ${
          activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] text-white" : "bg-white border-[#E5E5EA] text-neutral-900"
        }`}>
          <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <TrendingUp size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider opacity-60 font-bold">Сегодня</span>
            <span className="text-base font-black tracking-tight">{todayEarnings.toLocaleString()} ₽</span>
          </div>
        </div>

        <div className={`p-3.5 rounded-[var(--radius)] border flex items-center gap-3 shadow-xs ${
          activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] text-white" : "bg-white border-[#E5E5EA] text-neutral-900"
        }`}>
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <DollarSign size={16} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider opacity-60 font-bold">Этот месяц</span>
            <span className="text-base font-black tracking-tight">{monthEarnings.toLocaleString()} ₽</span>
          </div>
        </div>
      </div>

      {/* Today's Schedule Timeline (Apple Calendar style) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className={`text-xs font-extrabold uppercase tracking-widest ${activeDarkMode ? "text-neutral-400" : "text-neutral-500"}`}>
            Сетка занятий на сегодня
          </h2>
          <span className={`text-[10px] font-bold ${activeDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>
            {todayLessons.length} {lessonsWord(todayLessons.length)}
          </span>
        </div>

        {todayLessons.length > 0 ? (
          <div className={`rounded-[var(--radius)] border overflow-hidden divide-y ${
            activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"
          }`}>
            {todayLessons.map(lesson => {
              const student = getStudentForLesson(lesson.studentId);
              if (!student) return null;
              const time = new Date(lesson.dateTime);
              return (
                <div 
                  key={lesson.id} 
                  id={`timeline_row_${lesson.id}`}
                  className="p-3 flex items-center justify-between group hover:bg-neutral-500/5 transition duration-150"
                >
                  <div className="flex items-center gap-3">
                    {/* Time block */}
                    <div className="flex flex-col items-center justify-center border-r pr-3 min-w-[50px] border-neutral-200/50">
                      <span className={`text-xs font-black tracking-tight ${activeDarkMode ? "text-neutral-200" : "text-neutral-800"}`}>
                        {time.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-[9px] opacity-60 font-semibold">{lesson.durationMinutes} мин</span>
                    </div>

                    {/* Student Info */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: student.colorHex }} />
                        <span className={`text-xs font-bold ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>
                          {student.name}
                        </span>
                      </div>
                      <p className={`text-[10px] ${activeDarkMode ? "text-neutral-400" : "text-neutral-500"}`}>
                        {student.subject} {lesson.topic && `• ${lesson.topic}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions / Status Indicators */}
                  <div className="flex items-center gap-1.5">
                    {lesson.isCompleted ? (
                      <span className="text-[9px] bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full font-bold opacity-80 text-neutral-500 flex items-center gap-0.5">
                        Завершен
                      </span>
                    ) : (
                      <button
                        onClick={() => onMarkLessonCompleted(lesson.id)}
                        className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-1 rounded-full hover:bg-blue-500/20 active:scale-95 transition"
                      >
                        Завершить
                      </button>
                    )}

                    {!lesson.isPaid && lesson.isCompleted ? (
                      <button
                        onClick={() => onMarkLessonPaid(lesson.id)}
                        className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full hover:bg-amber-500/20 active:scale-95 transition"
                      >
                        ₽ Долг
                      </button>
                    ) : lesson.isPaid ? (
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <Check size={11} className="stroke-[3]" />
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`p-5 rounded-[var(--radius)] border text-center ${
            activeDarkMode ? "bg-neutral-900/40 border-neutral-800 text-neutral-500" : "bg-neutral-50 border-neutral-150 text-neutral-400"
          }`}>
            <span className="text-xs font-medium">Нет запланированных уроков на сегодня</span>
          </div>
        )}
      </div>

      {/* Unpaid Lessons Alert (Apple Reminders style) */}
      {unpaidLessons.length > 0 && (
        <div className={`p-3.5 rounded-[var(--radius)] border ${
          activeDarkMode ? "bg-amber-500/5 border-amber-500/25 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-900"
        }`}>
          <div className="flex items-start gap-2.5">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
            <div className="flex-1 space-y-1">
              <h4 className="text-xs font-bold leading-none">Неоплаченные уроки ({unpaidLessons.length})</h4>
              <p className="text-[10px] opacity-80 font-medium">
                Некоторые ученики провели занятия, но оплата ещё не зачислена.
              </p>
              
              {/* Mini list */}
              <div className="pt-2 space-y-1.5">
                {unpaidLessons.slice(0, 3).map(ul => {
                  const s = getStudentForLesson(ul.studentId);
                  if (!s) return null;
                  const dateStr = new Date(ul.dateTime).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
                  const amount = (ul.durationMinutes / 60) * s.hourlyRate;
                  return (
                    <div key={ul.id} className="flex items-center justify-between text-[10px] bg-neutral-500/5 p-1.5 rounded-lg border border-neutral-500/10">
                      <span className="font-bold">{s.name} ({dateStr})</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold">{amount} ₽</span>
                        <a 
                          href={`https://wa.me/${s.phone}?text=${encodeURIComponent(
                            `Здравствуйте, ${s.name}! Напоминаю об оплате занятия от ${dateStr} на сумму ${amount} руб. Спасибо!`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500"
                          title="Напомнить в WhatsApp"
                        >
                          <MessageCircle size={10} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CRM Reminders Checklist (Things 3 style) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className={`text-xs font-extrabold uppercase tracking-widest ${activeDarkMode ? "text-neutral-400" : "text-neutral-500"}`}>
            Список дел на сегодня
          </h2>
          <span className={`text-[10px] font-bold ${activeDarkMode ? "text-neutral-500" : "text-neutral-400"}`}>
            {todayTasks.filter(t => t.isCompleted).length}/{todayTasks.length}
          </span>
        </div>

        {todayTasks.length > 0 ? (
          <div className={`rounded-[var(--radius)] border divide-y overflow-hidden ${
            activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"
          }`}>
            {todayTasks.map(task => (
              <div 
                key={task.id} 
                onClick={() => toggleTask(task.id)}
                className="p-3 flex items-center gap-3 hover:bg-neutral-500/5 cursor-pointer transition"
              >
                {task.isCompleted ? (
                  <CheckCircle2 size={16} className="text-blue-500 shrink-0" />
                ) : (
                  <Circle size={16} className="text-neutral-400 shrink-0" />
                )}
                <span className={`text-xs font-semibold select-none ${
                  task.isCompleted 
                    ? "line-through text-neutral-400 dark:text-neutral-500" 
                    : activeDarkMode ? "text-white" : "text-neutral-800"
                }`}>
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className={`p-5 rounded-[var(--radius)] border text-center ${
            activeDarkMode ? "bg-neutral-900/40 border-neutral-800 text-neutral-500" : "bg-neutral-50 border-neutral-150 text-neutral-400"
          }`}>
            <span className="text-xs font-medium">Все дела на сегодня выполнены! 🎉</span>
          </div>
        )}
      </div>
    </div>
  );
}
