import React from "react";
import { ChevronLeft, Check, Moon, Sun } from "lucide-react";
import {
  AppTheme, ACCENTS, RADII, WALLPAPERS, getRadiusValue, wallpaperUrl,
} from "../theme";

interface Props {
  theme: AppTheme;
  onChange: (t: AppTheme) => void;
  onClose: () => void;
}

/**
 * Полноэкранный экран настройки внешнего вида: тема, акцентный цвет,
 * скругление углов и обои. Изменения применяются сразу (живой предпросмотр).
 */
export default function AppearanceScreen({ theme, onChange, onClose }: Props) {
  const dark = theme.dark;
  const set = (patch: Partial<AppTheme>) => onChange({ ...theme, ...patch });

  const surface = dark ? "bg-[#1c1c1e] border-[#3A3A3C]" : "bg-white border-[#E5E5EA]";
  const label = "text-[11px] font-bold uppercase tracking-wider opacity-60 pl-1";

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col animate-fade-in ${
        dark ? "bg-neutral-950 text-white" : "bg-[#f2f2f7] text-neutral-900"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Шапка */}
      <div className={`relative px-2 py-3 flex items-center shrink-0 border-b ${dark ? "border-neutral-800" : "border-neutral-200"}`}>
        <button onClick={onClose} className="flex items-center gap-0.5 text-blue-500 font-semibold text-sm active:opacity-60 transition pl-1">
          <ChevronLeft size={22} /> Назад
        </button>
        <h1 className="text-base font-black absolute left-1/2 -translate-x-1/2">Оформление</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Предпросмотр */}
        <div className={`rounded-[var(--radius)] border p-4 flex items-center justify-between ${surface}`} style={{ borderRadius: getRadiusValue(theme.radius) }}>
          <div>
            <div className="text-sm font-black">Предпросмотр</div>
            <div className="text-[11px] opacity-60">Так будут выглядеть кнопки</div>
          </div>
          <button
            className="px-4 py-2 text-xs font-bold text-white bg-blue-500 shadow-md active:scale-95 transition"
            style={{ borderRadius: getRadiusValue(theme.radius) }}
          >
            Кнопка
          </button>
        </div>

        {/* Тема */}
        <div className="space-y-2">
          <div className={label}>Тема</div>
          <div className={`flex p-1 rounded-[var(--radius)] border ${surface}`}>
            {[
              { v: false, name: "Светлая", icon: Sun },
              { v: true, name: "Тёмная", icon: Moon },
            ].map((opt) => {
              const active = theme.dark === opt.v;
              const Icon = opt.icon;
              return (
                <button
                  key={String(opt.v)}
                  onClick={() => set({ dark: opt.v })}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    active ? "bg-blue-500 text-white shadow" : "opacity-60"
                  }`}
                >
                  <Icon size={15} /> {opt.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Акцентный цвет */}
        <div className="space-y-2">
          <div className={label}>Акцентный цвет</div>
          <div className={`grid grid-cols-4 gap-3 p-4 rounded-[var(--radius)] border ${surface}`}>
            {ACCENTS.map((a) => {
              const active = theme.accent === a.key;
              return (
                <button
                  key={a.key}
                  onClick={() => set({ accent: a.key })}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition"
                >
                  <span
                    className="w-11 h-11 rounded-full flex items-center justify-center shadow-md ring-offset-2 transition"
                    style={{
                      backgroundColor: a.accent,
                      boxShadow: active ? `0 0 0 3px ${a.accent}` : undefined,
                      outline: active ? `2px solid ${dark ? "#0a0a0a" : "#f2f2f7"}` : undefined,
                      outlineOffset: active ? "-5px" : undefined,
                    }}
                  >
                    {active && <Check size={18} className="text-white stroke-[3]" />}
                  </span>
                  <span className={`text-[9px] font-semibold ${active ? "opacity-100" : "opacity-55"}`}>{a.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Скругление углов */}
        <div className="space-y-2">
          <div className={label}>Скругление углов</div>
          <div className={`grid grid-cols-3 gap-3 p-4 rounded-[var(--radius)] border ${surface}`}>
            {RADII.map((r) => {
              const active = theme.radius === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => set({ radius: r.key })}
                  className="flex flex-col items-center gap-2 active:scale-95 transition"
                >
                  <span
                    className={`w-full h-12 border-2 transition ${active ? "bg-blue-500 border-transparent" : dark ? "border-neutral-600" : "border-neutral-300"}`}
                    style={{ borderRadius: r.value }}
                  />
                  <span className={`text-[10px] font-bold ${active ? "text-blue-500" : "opacity-55"}`}>{r.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Обои */}
        <div className="space-y-2">
          <div className={label}>Обои на фон</div>
          <div className={`grid grid-cols-4 gap-3 p-4 rounded-[var(--radius)] border ${surface}`}>
            {WALLPAPERS.map((w) => {
              const active = theme.wallpaper === w.key;
              const url = wallpaperUrl(w.key);
              return (
                <button
                  key={w.key}
                  onClick={() => set({ wallpaper: w.key })}
                  className="flex flex-col items-center gap-1.5 active:scale-95 transition"
                >
                  <span
                    className={`w-full aspect-square rounded-xl border-2 overflow-hidden flex items-center justify-center relative ${
                      active ? "border-blue-500" : dark ? "border-neutral-700" : "border-neutral-200"
                    } ${dark ? "bg-neutral-900" : "bg-neutral-100"}`}
                    style={url ? { backgroundImage: `url("${url}")`, backgroundSize: "60px 60px", backgroundRepeat: "repeat" } : undefined}
                  >
                    {!url && <span className="text-[9px] font-bold opacity-50">нет</span>}
                    {active && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <Check size={16} className="text-white stroke-[3]" />
                      </span>
                    )}
                  </span>
                  <span className={`text-[8px] font-semibold text-center leading-tight ${active ? "opacity-100" : "opacity-55"}`}>{w.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[10px] opacity-45 text-center px-6 leading-relaxed">
          Настройки внешнего вида сохраняются на вашем устройстве.
        </p>
      </div>
    </div>
  );
}
