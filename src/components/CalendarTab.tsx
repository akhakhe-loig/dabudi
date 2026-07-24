import React, { useState, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Clock, Search, BookOpen, AlertCircle, Sparkles, X
} from "lucide-react";
import { Student, Lesson } from "../types";
import { lessonsWord } from "../utils";

interface CalendarTabProps {
  students: Student[];
  lessons: Lesson[];
  onAddLesson: (newLesson: Omit<Lesson, "id">) => void;
  activeDarkMode: boolean;
}

export default function CalendarTab({
  students,
  lessons,
  onAddLesson,
  activeDarkMode
}: CalendarTabProps) {
  const [activeMode, setActiveMode] = useState<"day" | "week" | "month">("day");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [freeSlotsResult, setFreeSlotsResult] = useState<string[] | null>(null);

  // Form State for Quick Schedule
  const [formStudentId, setFormStudentId] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [formTime, setFormTime] = useState("14:00");
  const [formDuration, setFormDuration] = useState("60");
  const [formHomework, setFormHomework] = useState("");
  const [formRepeat, setFormRepeat] = useState<"none" | "weekly" | "biweekly">("none");
  const [formRepeatCount, setFormRepeatCount] = useState("8");

  // Подписи дней: getDay()-индексация (Вс=0) для меток дат,
  // и понедельник-первый порядок для сетки месяца/недели.
  const daysOfWeek = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const weekDaysMon = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const monthsRu = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];

  // Пролистывание месяцев (стрелки + свайп пальцем влево/вправо)
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const changeMonth = (delta: number) => {
    setSlideDir(delta > 0 ? "right" : "left");
    setSelectedDate((prev) => {
      const day = prev.getDate();
      const d = new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, lastDay));
      return d;
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x;
    const dy = e.changedTouches[0].clientY - s.y;
    // Горизонтальный свайп (и явно не вертикальный скролл) листает месяц
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      changeMonth(dx < 0 ? 1 : -1);
    }
  };

  const getLessonsForDate = (date: Date) => {
    return lessons.filter(l => {
      const lDate = new Date(l.dateTime);
      return lDate.getDate() === date.getDate() &&
             lDate.getMonth() === date.getMonth() &&
             lDate.getFullYear() === date.getFullYear() &&
             !l.isCancelled;
    }).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  };

  const activeLessons = getLessonsForDate(selectedDate);

  const getStudentForId = (studentId: string) => {
    return students.find(s => s.id === studentId);
  };

  // Find Free Slots Algorithm
  const handleFindFreeSlots = () => {
    // Standard working hours: 09:00 to 20:00 (11 hours)
    const takenHours = activeLessons.map(l => {
      const d = new Date(l.dateTime);
      return d.getHours();
    });

    const freeSlots: string[] = [];
    for (let hour = 9; hour <= 20; hour++) {
      if (!takenHours.includes(hour)) {
        freeSlots.push(`${hour < 10 ? "0" : ""}${hour}:00 - ${hour + 1 < 10 ? "0" : ""}${hour + 1}:00`);
      }
    }
    setFreeSlotsResult(freeSlots);
  };

  // Quick schedule action
  const handleCreateLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId) return;

    const [hours, minutes] = formTime.split(":").map(Number);
    const intervalDays = formRepeat === "weekly" ? 7 : formRepeat === "biweekly" ? 14 : 0;
    const count = formRepeat === "none" ? 1 : Math.max(1, Math.min(52, Number(formRepeatCount) || 1));

    // Создаём одно или серию повторяющихся занятий (напр. каждую среду)
    for (let i = 0; i < count; i++) {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + i * intervalDays);
      d.setHours(hours, minutes, 0, 0);
      onAddLesson({
        studentId: formStudentId,
        dateTime: d.toISOString(),
        durationMinutes: Number(formDuration),
        topic: formTopic,
        homework: formHomework,
        isCompleted: false,
        isCancelled: false,
        isPaid: false
      });
    }

    setFormStudentId("");
    setFormTopic("");
    setFormHomework("");
    setFormRepeat("none");
    setFormRepeatCount("8");
    setShowAddLessonModal(false);
  };

  // Generate Week View Dates
  const getWeekDates = () => {
    const current = new Date(selectedDate);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); // start from Monday
    const monday = new Date(current.setDate(diff));
    
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Tab Header (Picker selection) */}
      <div className="px-4 pt-4 pb-2 space-y-3 bg-neutral-500/5 border-b border-neutral-500/10 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className={`text-2xl font-black tracking-tight ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>
            Календарь
          </h1>
          <button
            onClick={() => setShowAddLessonModal(true)}
            className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500/20 active:scale-95 transition"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Picker Mode segmented picker (iOS native feel) */}
        <div className="flex bg-neutral-200/50 dark:bg-neutral-800/80 p-0.5 rounded-lg text-xs">
          {(["day", "week", "month"] as const).map(mode => (
            <button
              key={mode}
              onClick={() => {
                setActiveMode(mode);
                setFreeSlotsResult(null);
              }}
              className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition ${
                activeMode === mode
                  ? "bg-white dark:bg-neutral-700 shadow-xs font-black text-neutral-900 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
              }`}
            >
              {mode === "day" ? "День" : mode === "week" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>
      </div>

      {/* Date Navigation Subbar — месяц листается стрелками или свайпом пальцем */}
      <div className={`px-4 py-2.5 border-b flex items-center justify-between shrink-0 ${
        activeDarkMode ? "bg-neutral-900/60 border-neutral-800" : "bg-white border-neutral-150"
      }`}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeMonth(-1)}
            aria-label="Предыдущий месяц"
            className="p-1.5 rounded-lg bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-500 transition active:scale-90"
          >
            <ChevronLeft size={16} />
          </button>
          <span className={`text-sm font-black min-w-[128px] text-center ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>
            {monthsRu[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </span>
          <button
            onClick={() => changeMonth(1)}
            aria-label="Следующий месяц"
            className="p-1.5 rounded-lg bg-neutral-500/10 hover:bg-neutral-500/20 text-neutral-500 transition active:scale-90"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          onClick={() => { setSlideDir(null); setSelectedDate(new Date()); }}
          className="text-[9px] font-bold px-2.5 py-1.5 rounded-lg bg-neutral-500/10 hover:bg-neutral-500/20 text-blue-500 transition active:scale-95 uppercase tracking-wider"
        >
          Сегодня
        </button>
      </div>

      {/* Calendar content views — свайп пальцем листает месяцы */}
      <div
        className="flex-1 overflow-y-auto p-4 pb-24"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={`${selectedDate.getFullYear()}-${selectedDate.getMonth()}`}
          className={`space-y-4 ${
            slideDir === "right" ? "animate-slide-in-right" : slideDir === "left" ? "animate-slide-in-left" : ""
          }`}
        >

        {/* VIEW: DAY VIEW */}
        {activeMode === "day" && (
          <div className="space-y-4">
            
            {/* Horizontal mini 7-day selector */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }).map((_, i) => {
                const date = new Date(selectedDate);
                const currentDay = date.getDay();
                const mondayIndex = (currentDay + 6) % 7; // Пн=0 … Вс=6
                const offset = i - mondayIndex;
                const dateToShow = new Date(selectedDate);
                dateToShow.setDate(dateToShow.getDate() + offset);
                const isSelected = dateToShow.getDate() === selectedDate.getDate() &&
                                  dateToShow.getMonth() === selectedDate.getMonth();
                const isToday = dateToShow.getDate() === new Date().getDate() &&
                                dateToShow.getMonth() === new Date().getMonth();

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(dateToShow)}
                    className={`p-2 rounded-xl flex flex-col items-center gap-1 transition ${
                      isSelected 
                        ? "bg-blue-500 text-white font-bold" 
                        : isToday 
                          ? "bg-neutral-500/15 text-blue-500 font-bold" 
                          : "hover:bg-neutral-500/5 text-neutral-500"
                    }`}
                  >
                    <span className="text-[9px] uppercase tracking-wider font-semibold">
                      {daysOfWeek[dateToShow.getDay()]}
                    </span>
                    <span className="text-xs font-black">
                      {dateToShow.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Timetable schedule timeline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase opacity-60">Занятия на день</span>
                <button
                  id="btn_find_free_slots"
                  onClick={handleFindFreeSlots}
                  className="text-[10px] font-bold text-blue-500 flex items-center gap-1 hover:underline"
                >
                  <Sparkles size={11} /> Найти свободные окна
                </button>
              </div>

              {/* Free Slots Popover */}
              {freeSlotsResult && (
                <div className={`p-3 rounded-[var(--radius)] border relative animate-fade-in ${
                  activeDarkMode ? "bg-blue-500/5 border-blue-500/20 text-blue-200" : "bg-blue-50 border-blue-200 text-blue-900"
                }`}>
                  <button 
                    onClick={() => setFreeSlotsResult(null)}
                    className="absolute top-3 right-3 p-0.5 rounded-full hover:bg-neutral-500/10 text-neutral-400"
                  >
                    <X size={12} />
                  </button>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-blue-500 mb-1.5">
                    <Sparkles size={12} /> Доступные окна для записи
                  </h4>
                  {freeSlotsResult.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5 max-h-[100px] overflow-y-auto">
                      {freeSlotsResult.slice(0, 6).map((slot, sIdx) => (
                        <div 
                          key={sIdx} 
                          onClick={() => {
                            const hr = parseInt(slot.split(":")[0]);
                            setFormTime(`${hr < 10 ? "0" : ""}${hr}:00`);
                            setShowAddLessonModal(true);
                            setFreeSlotsResult(null);
                          }}
                          className="p-1 px-2 text-[9px] bg-white dark:bg-neutral-800 rounded-lg text-center font-bold border border-blue-200/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-neutral-700 transition"
                        >
                          {slot}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] opacity-85">К сожалению, сегодня все рабочие часы заняты!</p>
                  )}
                </div>
              )}

              {activeLessons.length > 0 ? (
                <div className="space-y-2.5">
                  {activeLessons.map(lesson => {
                    const student = getStudentForId(lesson.studentId);
                    if (!student) return null;
                    const lTime = new Date(lesson.dateTime);
                    return (
                      <div
                        key={lesson.id}
                        id={`calendar_event_${lesson.id}`}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs transition duration-150 ${
                          activeDarkMode 
                            ? "bg-[#2C2C2E] hover:bg-[#3A3A3C] border-[#3A3A3C] text-white" 
                            : "bg-white hover:bg-neutral-50 border-[#E5E5EA] text-neutral-900"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: student.colorHex }} />
                            <span className="font-extrabold text-[13px]">{student.name}</span>
                          </div>
                          <p className="opacity-70 text-[10px] font-semibold">{student.subject} {lesson.topic && `• ${lesson.topic}`}</p>
                          <div className="flex items-center gap-1.5 text-[9px] text-neutral-400">
                            <Clock size={10} />
                            <span>
                              {lTime.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} ({lesson.durationMinutes} мин)
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            lesson.isCompleted ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
                          }`}>
                            {lesson.isCompleted ? "Проведен" : "Ожидание"}
                          </span>
                          <span className="block text-[10px] font-black">{student.hourlyRate * (lesson.durationMinutes / 60)} ₽</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`p-8 rounded-xl border text-center ${
                  activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] text-neutral-500" : "bg-white border-[#E5E5EA] text-neutral-400"
                }`}>
                  <AlertCircle size={22} className="mx-auto mb-1 opacity-50" />
                  <p className="text-xs font-semibold">Уроков нет на этот день</p>
                  <button 
                    onClick={() => setShowAddLessonModal(true)}
                    className="text-[10px] font-bold text-blue-500 hover:underline mt-1"
                  >
                    Запланировать занятие
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* VIEW: WEEK VIEW */}
        {activeMode === "week" && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase opacity-60">Обзор недели</span>
            <div className="space-y-2">
              {getWeekDates().map((wDate, idx) => {
                const lessonsCount = getLessonsForDate(wDate).length;
                const isSelected = wDate.getDate() === selectedDate.getDate() &&
                                  wDate.getMonth() === selectedDate.getMonth();
                const totalSalary = getLessonsForDate(wDate).reduce((sum, l) => {
                  const s = getStudentForId(l.studentId);
                  return sum + (s ? s.hourlyRate * (l.durationMinutes / 60) : 0);
                }, 0);

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDate(wDate);
                      setActiveMode("day");
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs cursor-pointer hover:scale-[1.01] active:scale-98 transition ${
                      isSelected 
                        ? "bg-blue-500/5 border-blue-500/30 dark:bg-blue-500/10" 
                        : activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C]" : "bg-white border-[#E5E5EA]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center font-bold ${
                        isSelected ? "bg-blue-500 text-white" : "bg-neutral-500/10"
                      }`}>
                        <span className="text-[8px] uppercase">{daysOfWeek[wDate.getDay()]}</span>
                        <span className="text-[11px] leading-tight">{wDate.getDate()}</span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="font-bold">
                          {lessonsCount > 0 ? `${lessonsCount} ${lessonsWord(lessonsCount)} за день` : "Свободный день"}
                        </span>
                        <span className="text-[10px] opacity-60 block">Ожидаемый доход: {totalSalary} ₽</span>
                      </div>
                    </div>

                    <ChevronRight size={14} className="text-neutral-400" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW: MONTH VIEW — понедельник первый, правильный сдвиг, нажатие на дату добавляет занятие */}
        {activeMode === "month" && (() => {
          const year = selectedDate.getFullYear();
          const month = selectedDate.getMonth();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Пн=0 … Вс=6
          const today = new Date();
          const cells: (number | null)[] = [
            ...Array.from({ length: firstWeekday }, () => null),
            ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
          ];

          return (
            <div className="space-y-3">
              <div className="grid grid-cols-7 gap-1 bg-neutral-500/5 p-2 rounded-[var(--radius)] border border-neutral-500/10">
                {weekDaysMon.map(d => (
                  <div key={d} className="text-center text-[9px] font-bold py-1 text-neutral-400">{d}</div>
                ))}
                {cells.map((dayNum, idx) => {
                  if (dayNum === null) return <div key={`empty-${idx}`} className="aspect-square" />;
                  const mDate = new Date(year, month, dayNum);
                  const hasLessons = lessons.some(l => {
                    const lD = new Date(l.dateTime);
                    return lD.getDate() === dayNum && lD.getMonth() === month &&
                           lD.getFullYear() === year && !l.isCancelled;
                  });
                  const isSelected = dayNum === selectedDate.getDate();
                  const isToday = dayNum === today.getDate() && month === today.getMonth() && year === today.getFullYear();

                  return (
                    <button
                      key={dayNum}
                      onClick={() => {
                        setSelectedDate(mDate);
                        setShowAddLessonModal(true);
                      }}
                      className={`aspect-square rounded-lg flex flex-col items-center justify-center relative text-xs font-bold transition ${
                        isSelected
                          ? "bg-blue-500 text-white"
                          : isToday
                            ? `ring-1 ring-blue-500 ${activeDarkMode ? "text-white" : "text-neutral-900"}`
                            : activeDarkMode
                              ? "hover:bg-neutral-800 text-white"
                              : "hover:bg-neutral-100 text-neutral-900"
                      }`}
                    >
                      <span>{dayNum}</span>
                      {hasLessons && (
                        <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`} />
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-center opacity-50 px-4">
                Нажмите на дату, чтобы добавить занятие. Свайп влево/вправо листает месяцы.
              </p>
            </div>
          );
        })()}

        </div>
      </div>

      {/* Quick Add Lesson Dialog */}
      {showAddLessonModal && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs">
          <div className={`max-h-[85%] flex flex-col rounded-t-3xl shadow-2xl overflow-hidden ${
            activeDarkMode ? "bg-neutral-900 text-white" : "bg-[#f2f2f7] text-neutral-900"
          }`}>
            <div className="px-4 py-3 border-b flex items-center justify-between bg-white dark:bg-neutral-800 shrink-0">
              <div>
                <h2 className="text-sm font-black">Добавить занятие</h2>
                <p className="text-[10px] opacity-60 font-semibold capitalize">
                  {selectedDate.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
                </p>
              </div>
              <button
                onClick={() => setShowAddLessonModal(false)}
                className="w-7 h-7 rounded-full bg-neutral-500/10 flex items-center justify-center text-neutral-500"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateLesson} className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Выберите Ученика *</label>
                <select
                  required
                  value={formStudentId}
                  onChange={(e) => setFormStudentId(e.target.value)}
                  className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                    activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                  }`}
                >
                  <option value="">-- Ученик не выбран --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.subject})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Тема Урока</label>
                <input
                  type="text"
                  placeholder="Например, Квадратные уравнения"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                    activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Время начала</label>
                  <input
                    type="time"
                    required
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                      activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Длительность (мин)</label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                      activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                    }`}
                  >
                    <option value="45">45 мин (школьный)</option>
                    <option value="60">60 мин (1 час)</option>
                    <option value="90">90 мин (полтора)</option>
                    <option value="120">120 мин (2 часа)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Повторение</label>
                  <select
                    value={formRepeat}
                    onChange={(e) => setFormRepeat(e.target.value as "none" | "weekly" | "biweekly")}
                    className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                      activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                    }`}
                  >
                    <option value="none">Не повторять</option>
                    <option value="weekly">Каждую неделю</option>
                    <option value="biweekly">Каждые 2 недели</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Сколько занятий</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={formRepeatCount}
                    disabled={formRepeat === "none"}
                    onChange={(e) => setFormRepeatCount(e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 disabled:opacity-40 ${
                      activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                    }`}
                  />
                </div>
              </div>

              {formRepeat !== "none" && (
                <p className="text-[10px] opacity-70 -mt-2 flex items-start gap-1.5 leading-relaxed">
                  <Sparkles size={12} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    Будет создано {Math.max(1, Math.min(52, Number(formRepeatCount) || 1))}{" "}
                    {lessonsWord(Math.max(1, Math.min(52, Number(formRepeatCount) || 1)))}{" "}
                    {formRepeat === "weekly" ? "каждую неделю" : "каждые 2 недели"} в это же время и день.
                  </span>
                </p>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Домашнее задание</label>
                <textarea
                  rows={2}
                  placeholder="Решить задачи 5-10 на стр. 42"
                  value={formHomework}
                  onChange={(e) => setFormHomework(e.target.value)}
                  className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 resize-none ${
                    activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                  }`}
                />
              </div>

              <button
                type="submit"
                id="btn_submit_add_lesson"
                className="w-full py-3 rounded-xl bg-blue-500 text-white font-bold text-xs hover:bg-blue-600 active:scale-98 transition shadow-md"
              >
                {formRepeat === "none"
                  ? "Запланировать урок"
                  : `Запланировать ${Math.max(1, Math.min(52, Number(formRepeatCount) || 1))} ${lessonsWord(Math.max(1, Math.min(52, Number(formRepeatCount) || 1)))}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
