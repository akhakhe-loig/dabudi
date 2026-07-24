import React, { useState } from "react";
import { 
  Search, Plus, X, Phone, Mail, Award, BookOpen, Clock, 
  Trash2, FileText, CheckSquare, Square, DollarSign, ArrowRight, UserPlus, FileUp
} from "lucide-react";
import { Student, Lesson, Payment } from "../types";
import { lessonsWord } from "../utils";

interface StudentsTabProps {
  students: Student[];
  lessons: Lesson[];
  payments: Payment[];
  onAddStudent: (newStudent: Omit<Student, "id">) => void;
  onDeleteStudent: (id: string) => void;
  onAddLesson: (newLesson: Omit<Lesson, "id">) => void;
  onAddPayment: (newPayment: Omit<Payment, "id">) => void;
  onUpdateLesson: (lesson: Lesson) => void;
  activeDarkMode: boolean;
  showAddStudentSheet: boolean;
  onCloseAddStudentSheet: () => void;
}

export default function StudentsTab({
  students,
  lessons,
  payments,
  onAddStudent,
  onDeleteStudent,
  onAddLesson,
  onAddPayment,
  onUpdateLesson,
  activeDarkMode,
  showAddStudentSheet,
  onCloseAddStudentSheet
}: StudentsTabProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "lessons" | "homework" | "payments" | "files">("info");

  // Form State for new student
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentSubject, setNewStudentSubject] = useState("");
  const [newStudentRate, setNewStudentRate] = useState("1500");
  const [newStudentColor, setNewStudentColor] = useState("#007AFF");
  const [newStudentNotes, setNewStudentNotes] = useState("");

  // Student details files (simulated)
  const [mockFiles, setMockFiles] = useState<{ [studentId: string]: { name: string; size: string; date: string }[] }>({
    "1": [
      { name: "Тест_Математика_ЕГЭ.pdf", size: "2.4 MB", date: "20.07.2026" },
      { name: "ДЗ_Тригонометрия_Иванов.pdf", size: "1.1 MB", date: "15.07.2026" }
    ],
    "2": [
      { name: "Словарь_Английский_В2.xlsx", size: "850 KB", date: "18.07.2026" }
    ]
  });

  const handleCreateStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName || !newStudentSubject) return;

    onAddStudent({
      name: newStudentName,
      phone: newStudentPhone || "+7 (999) 000-00-00",
      email: newStudentEmail || "student@example.com",
      subject: newStudentSubject,
      hourlyRate: Number(newStudentRate) || 1500,
      colorHex: newStudentColor,
      notes: newStudentNotes,
      isActive: true,
      avatarUrl: ""
    });

    // Reset Form
    setNewStudentName("");
    setNewStudentPhone("");
    setNewStudentEmail("");
    setNewStudentSubject("");
    setNewStudentRate("1500");
    setNewStudentColor("#007AFF");
    setNewStudentNotes("");
    onCloseAddStudentSheet();
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchText.toLowerCase()) ||
    s.subject.toLowerCase().includes(searchText.toLowerCase())
  );

  // Student specific calculations
  const getStudentMetrics = (studentId: string) => {
    const studentLessons = lessons.filter(l => l.studentId === studentId && !l.isCancelled);
    const completedLessons = studentLessons.filter(l => l.isCompleted);
    const unpaidCompleted = completedLessons.filter(l => !l.isPaid);
    
    const rate = students.find(s => s.id === studentId)?.hourlyRate || 0;
    
    const totalEarned = completedLessons.filter(l => l.isPaid).reduce((sum, l) => sum + (l.durationMinutes / 60) * rate, 0);
    const unpaidDebt = unpaidCompleted.reduce((sum, l) => sum + (l.durationMinutes / 60) * rate, 0);

    // Homework stats
    const totalHomeworks = completedLessons.filter(l => l.homework).length;
    // Mocking 75% progress of homework completion
    const homeworkProgress = totalHomeworks > 0 ? Math.round(75) : 0;

    return {
      completedCount: completedLessons.length,
      totalEarned,
      unpaidDebt,
      homeworkProgress
    };
  };

  // Colors array for custom iOS picker
  const iosColors = ["#007AFF", "#34C759", "#FF9500", "#FF2D55", "#AF52DE", "#5AC8FA", "#FFCC00", "#8E8E93"];

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Directory Title / Search Header */}
      <div className="px-4 pt-4 pb-2 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className={`text-2xl font-black tracking-tight ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>
            Ученики
          </h1>
          <button
            onClick={onCloseAddStudentSheet} // triggers showing add student if tapped
            className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500/20 active:scale-95 transition"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Search Bar (HIG style) */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Поиск по имени или предмету"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={`w-full py-2.5 pl-10 pr-4 text-xs rounded-xl focus:outline-none transition border ${
              activeDarkMode 
                ? "bg-neutral-900 border-neutral-800 text-white focus:border-blue-500" 
                : "bg-neutral-100 border-neutral-200/50 text-neutral-900 focus:border-blue-500"
            }`}
          />
        </div>
      </div>

      {/* Directory Cards Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3 pt-1">
        {filteredStudents.length > 0 ? (
          filteredStudents.map(student => {
            const metrics = getStudentMetrics(student.id);
            return (
              <div
                key={student.id}
                id={`student_card_${student.id}`}
                onClick={() => {
                  setSelectedStudent(student);
                  setDetailTab("info");
                }}
                className={`p-3.5 rounded-xl border transition duration-200 cursor-pointer shadow-xs active:scale-98 flex items-center justify-between ${
                  activeDarkMode 
                    ? "bg-[#2C2C2E] hover:bg-[#3A3A3C] border-[#3A3A3C] text-white" 
                    : "bg-white hover:bg-neutral-50 border-[#E5E5EA] text-neutral-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar Frame with Tag Color */}
                  <div 
                    className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shadow-sm relative text-white"
                    style={{ backgroundColor: student.colorHex }}
                  >
                    {student.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                    {student.isActive && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold leading-none">{student.name}</h3>
                    <p className="text-[10px] opacity-70 font-semibold">{student.subject}</p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-[9px] px-2 py-0.5 bg-neutral-500/10 rounded-full font-bold">
                        {student.hourlyRate} ₽/ч
                      </span>
                      <span className="text-[9px] opacity-60">
                        {metrics.completedCount} {lessonsWord(metrics.completedCount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Arrow + Quick Balance Status */}
                <div className="flex items-center gap-2">
                  {metrics.unpaidDebt > 0 && (
                    <div className="text-right shrink-0">
                      <span className="block text-[9px] font-bold text-amber-500 leading-none">Долг</span>
                      <span className="text-xs font-black text-amber-500">{metrics.unpaidDebt} ₽</span>
                    </div>
                  )}
                  <ArrowRight size={14} className="text-neutral-400" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 opacity-60">
            <UserPlus size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs">Ученики не найдены</p>
          </div>
        )}
      </div>

      {/* Sheet 1: Student Detailed Profile Modal (Sliding from Right / Bottom) */}
      {selectedStudent && (
        <div className={`absolute inset-0 z-40 flex flex-col shadow-2xl transition duration-300 ${
          activeDarkMode ? "bg-[#1C1C1E] text-white" : "bg-[#F2F2F7] text-neutral-900"
        }`}>
          {/* Detailed Header */}
          <div className={`px-4 pt-4 pb-3 flex items-center justify-between border-b shrink-0 ${
            activeDarkMode ? "bg-[#2C2C2E]/90 border-[#3A3A3C]" : "bg-white border-[#E5E5EA]"
          }`}>
            <div className="flex items-center gap-2.5">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold text-white"
                style={{ backgroundColor: selectedStudent.colorHex }}
              >
                {selectedStudent.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
              </div>
              <div className="space-y-0.5">
                <h2 className="text-sm font-black leading-none">{selectedStudent.name}</h2>
                <span className="text-[10px] opacity-60 font-semibold uppercase">{selectedStudent.subject}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (confirm("Вы уверены, что хотите удалить ученика и все его записи?")) {
                    onDeleteStudent(selectedStudent.id);
                    setSelectedStudent(null);
                  }
                }}
                className="p-1.5 rounded-full hover:bg-rose-500/10 text-rose-500 transition"
                title="Удалить ученика"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-7 h-7 rounded-full bg-neutral-500/15 flex items-center justify-center hover:bg-neutral-500/25 active:scale-95 transition text-neutral-500"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Profile Navigation Tabs (iOS-style pills) */}
          <div className="px-4 py-2 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none bg-neutral-500/5 border-b border-neutral-500/10">
            {[
              { id: "info", label: "Инфо" },
              { id: "lessons", label: "Уроки" },
              { id: "homework", label: "ДЗ" },
              { id: "payments", label: "Финансы" },
              { id: "files", label: "Файлы" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDetailTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold tracking-tight shrink-0 transition ${
                  detailTab === tab.id
                    ? activeDarkMode 
                      ? "bg-white text-black" 
                      : "bg-blue-500 text-white"
                    : "bg-neutral-500/10 text-neutral-500 dark:text-neutral-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sub-tab Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
            
            {/* SUB-TAB: INFO */}
            {detailTab === "info" && (
              <div className="space-y-4">
                {/* Statistics Banner */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-xl text-center border ${activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C]" : "bg-white border-[#E5E5EA]"}`}>
                    <span className="text-[10px] opacity-60 font-semibold block uppercase">Всего оплачено</span>
                    <span className="text-base font-black text-emerald-500">{getStudentMetrics(selectedStudent.id).totalEarned} ₽</span>
                  </div>
                  <div className={`p-3 rounded-xl text-center border ${activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C]" : "bg-white border-[#E5E5EA]"}`}>
                    <span className="text-[10px] opacity-60 font-semibold block uppercase">Ожидает оплаты</span>
                    <span className="text-base font-black text-amber-500">{getStudentMetrics(selectedStudent.id).unpaidDebt} ₽</span>
                  </div>
                </div>

                {/* Progress Circle or Gauge */}
                <div className={`p-3.5 rounded-xl border space-y-2 ${activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C]" : "bg-white border-[#E5E5EA]"}`}>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span>Успеваемость и прогресс</span>
                    <span className="text-blue-500">{getStudentMetrics(selectedStudent.id).homeworkProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                      style={{ width: `${getStudentMetrics(selectedStudent.id).homeworkProgress}%` }}
                    />
                  </div>
                  <p className="text-[9px] opacity-60 leading-normal">
                    Рассчитывается на основе выполненных домашних заданий и оценок за контрольные тесты.
                  </p>
                </div>

                {/* Contact Information */}
                <div className={`rounded-xl border divide-y overflow-hidden ${activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"}`}>
                  <div className="p-3 flex items-center justify-between text-xs">
                    <span className="opacity-60 flex items-center gap-1.5"><Phone size={13} /> Телефон</span>
                    <a href={`tel:${selectedStudent.phone}`} className="font-bold text-blue-500">{selectedStudent.phone}</a>
                  </div>
                  <div className="p-3 flex items-center justify-between text-xs">
                    <span className="opacity-60 flex items-center gap-1.5"><Mail size={13} /> Email</span>
                    <a href={`mailto:${selectedStudent.email}`} className="font-bold text-blue-500">{selectedStudent.email}</a>
                  </div>
                  <div className="p-3 flex items-center justify-between text-xs">
                    <span className="opacity-60 flex items-center gap-1.5"><Clock size={13} /> Ставка</span>
                    <span className="font-bold">{selectedStudent.hourlyRate} ₽ / час</span>
                  </div>
                </div>

                {/* Personal Notes */}
                <div className={`p-3 rounded-xl border space-y-1.5 ${activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C]" : "bg-white border-[#E5E5EA]"}`}>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Служебные примечания</h4>
                  <p className="text-xs leading-relaxed opacity-85">
                    {selectedStudent.notes || "Примечания отсутствуют. Добавьте полезные факты об ученике (уровень знаний, пробелы в тригонометрии, цели обучения)."}
                  </p>
                </div>
              </div>
            )}

            {/* SUB-TAB: LESSON HISTORY */}
            {detailTab === "lessons" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase opacity-60">История всех уроков</span>
                </div>

                {lessons.filter(l => l.studentId === selectedStudent.id).length > 0 ? (
                  <div className="space-y-2">
                    {lessons
                      .filter(l => l.studentId === selectedStudent.id)
                      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
                      .map(lesson => {
                        const date = new Date(lesson.dateTime);
                        return (
                          <div 
                            key={lesson.id}
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                              activeDarkMode ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"
                            }`}
                          >
                            <div className="space-y-1">
                              <span className="font-bold block">
                                {date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                              <span className="opacity-60 text-[10px] block">
                                {date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} • {lesson.durationMinutes} мин
                              </span>
                              <span className="italic text-[10px] text-neutral-400 block">Тема: {lesson.topic || "Не указана"}</span>
                            </div>

                            <div className="text-right space-y-1">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                                lesson.isCompleted ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
                              }`}>
                                {lesson.isCompleted ? "Проведен" : "Запланирован"}
                              </span>
                              <span className={`block text-[10px] font-bold ${lesson.isPaid ? "text-emerald-500" : "text-amber-500"}`}>
                                {lesson.isPaid ? "Оплачен" : "Не оплачен"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                ) : (
                  <p className="text-xs text-center py-5 opacity-60">Уроков для этого ученика пока нет.</p>
                )}
              </div>
            )}

            {/* SUB-TAB: HOMEWORK TRACKER */}
            {detailTab === "homework" && (
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase opacity-60">Задания и домашка</span>

                {lessons.filter(l => l.studentId === selectedStudent.id && l.homework).length > 0 ? (
                  <div className="space-y-2">
                    {lessons
                      .filter(l => l.studentId === selectedStudent.id && l.homework)
                      .map(lesson => {
                        const date = new Date(lesson.dateTime);
                        return (
                          <div 
                            key={lesson.id}
                            id={`homework_item_${lesson.id}`}
                            onClick={() => {
                              // Toggle simulation of homework completion
                              onUpdateLesson({
                                ...lesson,
                                isCompleted: true // automatically complete lesson if homework is being toggled
                              });
                            }}
                            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer select-none transition ${
                              activeDarkMode ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"
                            }`}
                          >
                            {lesson.isCompleted ? (
                              <CheckSquare size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                            ) : (
                              <Square size={16} className="text-neutral-400 shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-1">
                              <span className="font-bold text-[11px] block text-neutral-400">
                                К уроку от {date.toLocaleDateString()}
                              </span>
                              <p className="text-xs font-semibold">{lesson.homework}</p>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                ) : (
                  <p className="text-xs text-center py-5 opacity-60">Домашние задания не зафиксированы.</p>
                )}
              </div>
            )}

            {/* SUB-TAB: PAYMENTS HISTORY */}
            {detailTab === "payments" && (
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase opacity-60">История транзакций</span>

                {payments.filter(p => p.studentId === selectedStudent.id).length > 0 ? (
                  <div className="space-y-2">
                    {payments
                      .filter(p => p.studentId === selectedStudent.id)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map(payment => (
                        <div 
                          key={payment.id}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                            activeDarkMode ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                              <DollarSign size={13} />
                            </div>
                            <div className="space-y-0.5">
                              <span className="font-bold">Поступление платежа</span>
                              <span className="text-[10px] opacity-60 block">
                                {new Date(payment.date).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <span className="font-black text-emerald-500">+{payment.amount} ₽</span>
                        </div>
                      ))
                    }
                  </div>
                ) : (
                  <p className="text-xs text-center py-5 opacity-60">Платежи по данному ученику отсутствуют.</p>
                )}
              </div>
            )}

            {/* SUB-TAB: FILES */}
            {detailTab === "files" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase opacity-60">Документы ученика</span>
                  <button 
                    onClick={() => {
                      const fileName = prompt("Введите название нового файла:");
                      if (fileName) {
                        const curFiles = mockFiles[selectedStudent.id] || [];
                        setMockFiles({
                          ...mockFiles,
                          [selectedStudent.id]: [
                            ...curFiles,
                            { name: fileName, size: "1.2 MB", date: new Date().toLocaleDateString() }
                          ]
                        });
                      }
                    }}
                    className="text-[10px] text-blue-500 font-bold flex items-center gap-1"
                  >
                    <FileUp size={12} /> Загрузить
                  </button>
                </div>

                {(mockFiles[selectedStudent.id] || []).length > 0 ? (
                  <div className="space-y-2">
                    {(mockFiles[selectedStudent.id] || []).map((file, idx) => (
                      <div 
                        key={idx}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                          activeDarkMode ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="text-blue-500 shrink-0" size={16} />
                          <div className="space-y-0.5">
                            <span className="font-bold block truncate max-w-[150px]">{file.name}</span>
                            <span className="text-[10px] opacity-60 block">{file.size} • {file.date}</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            const updatedList = (mockFiles[selectedStudent.id] || []).filter((_, i) => i !== idx);
                            setMockFiles({
                              ...mockFiles,
                              [selectedStudent.id]: updatedList
                            });
                          }}
                          className="p-1 text-rose-500 hover:bg-rose-500/15 rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-center py-5 opacity-60">Файлы и ДЗ материалы отсутствуют.</p>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Sheet 2: Add Student Sheet Form (Modal overlay) */}
      {showAddStudentSheet && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-xs">
          <div 
            id="add_student_form_container"
            className={`max-h-[90%] flex flex-col rounded-t-3xl shadow-2xl overflow-hidden ${
              activeDarkMode ? "bg-neutral-900 text-white" : "bg-[#f2f2f7] text-neutral-900"
            }`}
          >
            {/* Sheet header */}
            <div className={`px-4 py-3 border-b flex items-center justify-between bg-white dark:bg-neutral-800 shrink-0`}>
              <h2 className="text-sm font-black">Новый ученик</h2>
              <button 
                onClick={onCloseAddStudentSheet}
                className="w-7 h-7 rounded-full bg-neutral-500/10 flex items-center justify-center text-neutral-500 hover:bg-neutral-500/20 active:scale-95 transition"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable Form */}
            <form onSubmit={handleCreateStudent} className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
              
              {/* Field Group 1 */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">ФИО Ученика *</label>
                  <input
                    type="text"
                    required
                    placeholder="Например, Иван Иванов"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                      activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Предмет обучения *</label>
                  <input
                    type="text"
                    required
                    placeholder="Математика ЕГЭ, Английский B2..."
                    value={newStudentSubject}
                    onChange={(e) => setNewStudentSubject(e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                      activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                    }`}
                  />
                </div>
              </div>

              {/* Field Group 2 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Ставка (₽ / час)</label>
                  <input
                    type="number"
                    value={newStudentRate}
                    onChange={(e) => setNewStudentRate(e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                      activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Цветовой тег</label>
                  <div className="flex flex-wrap gap-1.5 pt-1 justify-between">
                    {iosColors.slice(0, 4).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewStudentColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition ${
                          newStudentColor === c ? "scale-110 border-black dark:border-white" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Field Group 3 */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Телефон</label>
                  <input
                    type="text"
                    placeholder="+7 (999) 123-45-67"
                    value={newStudentPhone}
                    onChange={(e) => setNewStudentPhone(e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                      activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Email</label>
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={newStudentEmail}
                    onChange={(e) => setNewStudentEmail(e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 ${
                      activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                    }`}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">Примечания к обучению</label>
                  <textarea
                    rows={3}
                    placeholder="Цели обучения, увлечения ученика..."
                    value={newStudentNotes}
                    onChange={(e) => setNewStudentNotes(e.target.value)}
                    className={`w-full p-2.5 text-xs rounded-xl border focus:outline-none focus:border-blue-500 resize-none ${
                      activeDarkMode ? "bg-neutral-800 border-neutral-700 text-white" : "bg-white border-neutral-200 text-neutral-900"
                    }`}
                  />
                </div>
              </div>

              {/* Submit trigger button */}
              <button
                type="submit"
                id="btn_submit_add_student"
                className="w-full py-3 rounded-xl bg-blue-500 text-white font-bold text-xs hover:bg-blue-600 active:scale-98 transition shadow-md"
              >
                Создать ученика
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
