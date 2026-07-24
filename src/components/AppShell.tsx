import React from "react";
import {
  Home, Users, Calendar, FileText, DollarSign, Settings, Sparkles, X,
} from "lucide-react";

interface AppShellProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeDarkMode: boolean;
  wallpaperUrl: string | null;
  isLiveActivityActive: boolean;
  liveActivityStudent: string;
  liveActivityTimeLeft: number;
  onStopLiveActivity: () => void;
  siriMessage: { text: string; response: string } | null;
  onClearSiri: () => void;
  children: React.ReactNode;
}

const TABS = [
  { id: "home", label: "Главная", icon: Home },
  { id: "students", label: "Ученики", icon: Users },
  { id: "calendar", label: "Календарь", icon: Calendar },
  { id: "notes", label: "Заметки", icon: FileText },
  { id: "finances", label: "Финансы", icon: DollarSign },
  { id: "settings", label: "Настройки", icon: Settings },
];

const formatTimeLeft = (sec: number) => {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

/**
 * Полноэкранный каркас мобильного приложения: контент активной вкладки +
 * нижняя панель вкладок. Учитывает «безопасные зоны» iPhone (челка/полоса
 * жестов) через env(safe-area-inset-*), поэтому корректно работает как
 * веб-приложение, добавленное на экран «Домой».
 */
export default function AppShell({
  activeTab,
  setActiveTab,
  activeDarkMode,
  wallpaperUrl,
  isLiveActivityActive,
  liveActivityStudent,
  liveActivityTimeLeft,
  onStopLiveActivity,
  siriMessage,
  onClearSiri,
  children,
}: AppShellProps) {
  return (
    <div
      className={`h-full w-full flex flex-col overflow-hidden font-sans antialiased select-none transition-colors duration-500 ${
        activeDarkMode ? "bg-neutral-950 text-white" : "bg-[#f2f2f7] text-neutral-900"
      }`}
    >
      {/* Слой обоев с цветами (поверх фона, за контентом) */}
      {wallpaperUrl && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage: `url("${wallpaperUrl}")`,
            backgroundRepeat: "repeat",
            backgroundSize: "150px 150px",
            opacity: activeDarkMode ? 0.45 : 0.6,
          }}
        />
      )}

      {/* Безопасная зона сверху (под челкой) */}
      <div style={{ paddingTop: "env(safe-area-inset-top)" }} className="shrink-0 relative z-10" />

      {/* Плашка активного урока (Live Activity) */}
      {isLiveActivityActive && (
        <div className="shrink-0 px-4 py-2 flex items-center gap-2.5 bg-black text-white relative z-20">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
          <div className="text-xs font-bold truncate flex-1">
            Идёт урок: {liveActivityStudent} ({formatTimeLeft(liveActivityTimeLeft)})
          </div>
          <button
            onClick={onStopLiveActivity}
            className="text-[10px] bg-neutral-800 hover:bg-neutral-700 active:scale-95 px-2.5 py-1 rounded-full font-black uppercase shrink-0 transition"
          >
            Завершить
          </button>
        </div>
      )}

      {/* Контент активной вкладки */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        {children}

        {/* Всплывающее уведомление (голосовой ассистент из Настроек) */}
        {siriMessage && (
          <div className="absolute inset-x-3 bottom-3 bg-neutral-900/95 backdrop-blur-lg border border-indigo-500/30 rounded-[var(--radius)] p-3 z-50 text-white shadow-2xl space-y-1.5 pointer-events-auto">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-indigo-400">
              <span className="flex items-center gap-1"><Sparkles size={11} /> Ассистент</span>
              <button onClick={onClearSiri} className="text-neutral-500 hover:text-white">
                <X size={13} />
              </button>
            </div>
            <p className="font-semibold italic text-neutral-300 text-xs">"{siriMessage.text}"</p>
            <p className="text-[11px] leading-relaxed text-indigo-200">{siriMessage.response}</p>
          </div>
        )}
      </main>

      {/* Нижняя панель вкладок */}
      <nav
        className={`shrink-0 flex items-stretch justify-around border-t relative z-20 backdrop-blur-xl ${
          activeDarkMode ? "bg-neutral-950/85 border-neutral-800/80" : "bg-white/85 border-neutral-200"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((tab) => {
          const IconComponent = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-label={tab.label}
              className="flex flex-col items-center justify-center flex-1 py-2 transition active:scale-95 text-center select-none cursor-pointer group"
            >
              <IconComponent
                size={22}
                className={`transition duration-150 ${
                  isSelected ? "text-blue-500 scale-110" : "text-neutral-400"
                }`}
              />
              <span
                className={`text-[10px] font-bold mt-1 tracking-tight transition select-none ${
                  isSelected ? "text-blue-500" : "text-neutral-400"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
