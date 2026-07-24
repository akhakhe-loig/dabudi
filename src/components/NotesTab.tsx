import React, { useState, useEffect, useRef } from "react";
import { 
  Search, Plus, Pin, Trash2, CheckCircle2, Circle, Mic, Square, 
  ChevronLeft, FileText, Check, ListTodo, Sparkles, X
} from "lucide-react";
import { Note, ChecklistItem } from "../types";

interface NotesTabProps {
  notes: Note[];
  onAddNote: (newNote: Omit<Note, "id">) => void;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  activeDarkMode: boolean;
}

export default function NotesTab({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  activeDarkMode
}: NotesTabProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Search filter
  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchText.toLowerCase()) ||
    n.content.toLowerCase().includes(searchText.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter(n => n.isPinned);
  const recentNotes = filteredNotes.filter(n => !n.isPinned);

  const handleCreateNote = () => {
    const newNote: Omit<Note, "id"> = {
      title: "Новая заметка",
      content: "",
      updatedAt: new Date().toISOString(),
      isPinned: false,
      checklist: []
    };
    onAddNote(newNote);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Search & Header */}
      {!selectedNote ? (
        <>
          <div className="px-4 pt-4 pb-2 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h1 className={`text-2xl font-black tracking-tight ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>
                Заметки
              </h1>
              <button
                onClick={handleCreateNote}
                className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center hover:bg-amber-500/20 active:scale-95 transition"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Apple Notes search bar */}
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Поиск по названию или тексту"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className={`w-full py-2.5 pl-10 pr-4 text-xs rounded-xl focus:outline-none transition border ${
                  activeDarkMode 
                    ? "bg-neutral-900 border-neutral-800 text-white focus:border-amber-500" 
                    : "bg-neutral-100 border-neutral-200/50 text-neutral-900 focus:border-amber-500"
                }`}
              />
            </div>
          </div>

          {/* Notes list groups */}
          <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 pt-1">
            
            {/* PINNED GROUP */}
            {pinnedNotes.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase opacity-60 text-amber-500 tracking-wider flex items-center gap-1">
                  <Pin size={10} className="fill-amber-500" /> Закрепленные
                </span>
                <div className={`rounded-2xl border divide-y overflow-hidden ${
                  activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"
                }`}>
                  {pinnedNotes.map(note => {
                    const dateStr = new Date(note.updatedAt).toLocaleDateString([], { day: "numeric", month: "short" });
                    const snippet = note.content ? note.content.substring(0, 50) + "..." : "Нет текста";
                    const tasksDone = note.checklist?.filter(t => t.isCompleted).length || 0;
                    const tasksTotal = note.checklist?.length || 0;
                    return (
                      <div 
                        key={note.id}
                        onClick={() => setSelectedNote(note)}
                        className="p-3.5 flex items-center justify-between group hover:bg-neutral-500/5 cursor-pointer transition"
                      >
                        <div className="flex-1 pr-4 min-w-0 space-y-1">
                          <h4 className={`text-xs font-bold truncate ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>{note.title}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] opacity-70">
                            <span className="font-semibold text-amber-500">{dateStr}</span>
                            <span>•</span>
                            <span className="truncate">{snippet}</span>
                          </div>
                          {tasksTotal > 0 && (
                            <div className="flex items-center gap-1 pt-0.5 text-[9px] text-neutral-400">
                              <ListTodo size={11} />
                              <span>План: {tasksDone}/{tasksTotal} выполнено</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateNote({ ...note, isPinned: false });
                            }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-500 transition"
                          >
                            <Pin size={13} className={note.isPinned ? "fill-amber-500 text-amber-500" : ""} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RECENT GROUP */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase opacity-60 tracking-wider">
                {pinnedNotes.length > 0 ? "Остальные заметки" : "Заметки репетитора"}
              </span>

              {recentNotes.length > 0 ? (
                <div className={`rounded-2xl border divide-y overflow-hidden ${
                  activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"
                }`}>
                  {recentNotes.map(note => {
                    const dateStr = new Date(note.updatedAt).toLocaleDateString([], { day: "numeric", month: "short" });
                    const snippet = note.content ? note.content.substring(0, 50) + "..." : "Нет текста";
                    const tasksDone = note.checklist?.filter(t => t.isCompleted).length || 0;
                    const tasksTotal = note.checklist?.length || 0;
                    return (
                      <div 
                        key={note.id}
                        onClick={() => setSelectedNote(note)}
                        className="p-3.5 flex items-center justify-between group hover:bg-neutral-500/5 cursor-pointer transition"
                      >
                        <div className="flex-1 pr-4 min-w-0 space-y-1">
                          <h4 className={`text-xs font-bold truncate ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>{note.title}</h4>
                          <div className="flex items-center gap-1.5 text-[10px] opacity-70">
                            <span className="font-semibold text-amber-500">{dateStr}</span>
                            <span>•</span>
                            <span className="truncate">{snippet}</span>
                          </div>
                          {tasksTotal > 0 && (
                            <div className="flex items-center gap-1 pt-0.5 text-[9px] text-neutral-400">
                              <ListTodo size={11} />
                              <span>План: {tasksDone}/{tasksTotal} выполнено</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateNote({ ...note, isPinned: true });
                            }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-500 transition"
                          >
                            <Pin size={13} className={note.isPinned ? "fill-amber-500 text-amber-500" : ""} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-10 opacity-60 text-xs">
                  Заметки не найдены. Создайте новую!
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <NoteEditorView 
          note={selectedNote} 
          onBack={() => {
            // Re-fetch list state on back to keep lists synced
            setSelectedNote(null);
          }}
          onSave={(updated) => {
            onUpdateNote(updated);
            // also update local selection so state doesn't look laggy
            setSelectedNote(updated);
          }}
          onDelete={() => {
            onDeleteNote(selectedNote.id);
            setSelectedNote(null);
          }}
          activeDarkMode={activeDarkMode}
        />
      )}
    </div>
  );
}

/* DETAILED EDITOR VIEW SUBCOMPONENT WITH VOICE TRANSCRIBER */
function NoteEditorView({
  note,
  onBack,
  onSave,
  onDelete,
  activeDarkMode
}: {
  note: Note;
  onBack: () => void;
  onSave: (updated: Note) => void;
  onDelete: () => void;
  activeDarkMode: boolean;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklist || []);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const recordInterval = useRef<any>(null);

  // Voice transcript simulation data bank
  const voiceTranscripts = [
    "Подготовить материалы по геометрии для Ивана. Разобрать теорему Пифагора на следующем уроке и задать домашку на площадь трапеции.",
    "Проверить контрольную работу Анны. Ошибки в логарифмах. Нужно составить список упражнений на свойства степеней.",
    "Созвониться с родителями Кирилла и обсудить прогресс по подготовке к ОГЭ. Оценки заметно улучшились за последний месяц.",
    "План урока английского: повторить Present Perfect, прослушать аудиозапись про путешествия и разыграть диалог в аэропорту."
  ];

  // Auto-save when details change
  useEffect(() => {
    const timer = setTimeout(() => {
      onSave({
        ...note,
        title,
        content,
        checklist,
        updatedAt: new Date().toISOString()
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, content, checklist]);

  // Voice Recording effects
  useEffect(() => {
    if (isRecording) {
      recordInterval.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
        // Generate random waveform value for visualization
        setWaveform(prev => [...prev, Math.floor(Math.random() * 80) + 10]);
      }, 500);
    } else {
      clearInterval(recordInterval.current);
    }
    return () => clearInterval(recordInterval.current);
  }, [isRecording]);

  const handleToggleMic = () => {
    if (!isRecording) {
      setIsRecording(true);
      setRecordingSeconds(0);
      setWaveform([]);
    } else {
      setIsRecording(false);
      // Auto-transcribe spoken speech!
      const randomTranscript = voiceTranscripts[Math.floor(Math.random() * voiceTranscripts.length)];
      setContent(prev => prev + (prev ? "\n\n" : "") + "🎤 [Расшифрованная голосовая запись]:\n" + randomTranscript);
    }
  };

  const handleAddCheckItem = () => {
    const text = prompt("Введите задачу для поурочного плана:");
    if (text) {
      setChecklist([...checklist, { id: Date.now().toString(), text, isCompleted: false }]);
    }
  };

  const toggleCheckItem = (id: string) => {
    setChecklist(
      checklist.map(item => item.id === id ? { ...item, isCompleted: !item.isCompleted } : item)
    );
  };

  const handleDeleteCheckItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Editor Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between shrink-0 ${
        activeDarkMode ? "bg-neutral-900 border-neutral-800" : "bg-white border-neutral-200"
      }`}>
        <button 
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-bold text-amber-500"
        >
          <ChevronLeft size={16} /> Назад
        </button>

        <div className="flex items-center gap-2">
          <button 
            onClick={onDelete}
            className="p-1.5 rounded-full hover:bg-rose-500/10 text-rose-500 transition"
            title="Удалить заметку"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Main content viewport */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        
        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`w-full text-base font-black border-b pb-2 focus:outline-none focus:border-amber-500 ${
            activeDarkMode ? "bg-transparent border-neutral-800 text-white" : "bg-transparent border-neutral-200 text-neutral-900"
          }`}
          placeholder="Название заметки"
        />

        {/* VOICE RECORDING PANEL */}
        <div className={`p-3 rounded-xl border flex flex-col items-center gap-2 ${
          isRecording 
            ? "bg-rose-500/10 border-rose-500/30 text-rose-500 animate-pulse" 
            : activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C]" : "bg-white border-[#E5E5EA]"
        }`}>
          <div className="flex items-center justify-between w-full">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
              <Mic size={11} /> Голосовой конспект
            </span>
            {isRecording && (
              <span className="text-xs font-bold font-mono">
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60) < 10 ? "0" : ""}{recordingSeconds % 60}
              </span>
            )}
          </div>

          {/* Animated Waveform Display */}
          {waveform.length > 0 && (
            <div className="h-8 flex items-end gap-0.5 justify-center w-full px-4 overflow-hidden">
              {waveform.slice(-30).map((v, idx) => (
                <div 
                  key={idx} 
                  className="w-1 bg-rose-500 rounded-full transition-all duration-300"
                  style={{ height: `${v}%` }}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleToggleMic}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold tracking-tight transition active:scale-95 shadow-xs ${
              isRecording 
                ? "bg-rose-500 text-white hover:bg-rose-600" 
                : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-500"
            }`}
          >
            {isRecording ? (
              <>
                <Square size={10} fill="currentColor" /> Завершить запись
              </>
            ) : (
              <>
                <Mic size={10} /> Записать голос (AI Транскрипция)
              </>
            )}
          </button>
        </div>

        {/* Text Content Editor */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold tracking-wider text-neutral-400 uppercase">Текст заметки / Markdown</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            className={`w-full p-3 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 border leading-relaxed ${
              activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] text-white" : "bg-white border-[#E5E5EA] text-neutral-900"
            }`}
            placeholder="Напишите поурочный план, список вопросов или зафиксируйте важные моменты занятия..."
          />
        </div>

        {/* CHECKLISTS (Po-urochniy plan) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold tracking-wider text-neutral-400 uppercase">Поурочный Чек-лист (План)</span>
            <button
              onClick={handleAddCheckItem}
              className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5"
            >
              <Plus size={11} /> Добавить пункт
            </button>
          </div>

          {checklist.length > 0 ? (
            <div className={`rounded-xl border divide-y overflow-hidden ${
              activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"
            }`}>
              {checklist.map(item => (
                <div 
                  key={item.id}
                  className="p-2.5 flex items-center justify-between text-xs"
                >
                  <div 
                    onClick={() => toggleCheckItem(item.id)}
                    className="flex items-center gap-2 cursor-pointer select-none"
                  >
                    {item.isCompleted ? (
                      <CheckCircle2 size={15} className="text-amber-500 shrink-0" />
                    ) : (
                      <Circle size={15} className="text-neutral-400 shrink-0" />
                    )}
                    <span className={`font-semibold ${item.isCompleted ? "line-through text-neutral-400" : ""}`}>
                      {item.text}
                    </span>
                  </div>

                  <button 
                    onClick={() => handleDeleteCheckItem(item.id)}
                    className="text-neutral-400 hover:text-rose-500"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] italic opacity-60 text-center py-2">
              План занятия отсутствует. Добавьте пошаговые этапы урока.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
