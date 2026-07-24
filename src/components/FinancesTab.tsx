import React, { useState } from "react";
import { 
  DollarSign, TrendingUp, AlertTriangle, Check, Search, Calendar, CreditCard, Clock, CheckCircle 
} from "lucide-react";
import { Student, Lesson, Payment } from "../types";

interface FinancesTabProps {
  students: Student[];
  lessons: Lesson[];
  payments: Payment[];
  onMarkLessonPaid: (id: string) => void;
  activeDarkMode: boolean;
}

export default function FinancesTab({
  students,
  lessons,
  payments,
  onMarkLessonPaid,
  activeDarkMode
}: FinancesTabProps) {
  const [financePeriod, setFinancePeriod] = useState<"week" | "month" | "year">("month");
  const [filterType, setFilterType] = useState<"all" | "paid" | "unpaid">("all");
  const [chartHoveredIdx, setChartHoveredIdx] = useState<number | null>(null);

  const getStudentForId = (studentId: string) => {
    return students.find(s => s.id === studentId);
  };

  // 1. Calculations
  const completedLessons = lessons.filter(l => l.isCompleted && !l.isCancelled);
  const paidLessons = completedLessons.filter(l => l.isPaid);
  const unpaidLessons = completedLessons.filter(l => !l.isPaid);

  const totalRevenue = payments.filter(p => p.isReceived).reduce((sum, p) => sum + p.amount, 0);
  
  const totalDebt = unpaidLessons.reduce((sum, l) => {
    const s = getStudentForId(l.studentId);
    return sum + (s ? s.hourlyRate * (l.durationMinutes / 60) : 0);
  }, 0);

  const averageTicket = completedLessons.length > 0 
    ? Math.round(completedLessons.reduce((sum, l) => {
        const s = getStudentForId(l.studentId);
        return sum + (s ? s.hourlyRate * (l.durationMinutes / 60) : 0);
      }, 0) / completedLessons.length)
    : 0;

  // Mock data points for SVG charts
  const weekData = [
    { label: "Пн", value: 3000 },
    { label: "Вт", value: 4500 },
    { label: "Ср", value: 1500 },
    { label: "Чт", value: 6000 },
    { label: "Пт", value: 3000 },
    { label: "Сб", value: 7500 },
    { label: "Вс", value: 0 }
  ];

  const monthData = [
    { label: "Неделя 1", value: 18000 },
    { label: "Неделя 2", value: 24500 },
    { label: "Неделя 3", value: 21000 },
    { label: "Неделя 4", value: 29000 }
  ];

  const yearData = [
    { label: "Янв-Мар", value: 54000 },
    { label: "Апр-Июн", value: 68000 },
    { label: "Июл-Сен", value: 42000 },
    { label: "Окт-Дек", value: 89000 }
  ];

  const chartData = financePeriod === "week" 
    ? weekData 
    : financePeriod === "month" 
      ? monthData 
      : yearData;

  const maxVal = Math.max(...chartData.map(d => d.value)) || 1;

  // Combined ledger (payments log + pending debts log)
  const billingLedger: { id: string; studentName: string; subject: string; date: string; amount: number; isPaid: boolean; type: "lesson" | "payment" }[] = [];

  // Add payments received
  payments.forEach(p => {
    const s = getStudentForId(p.studentId);
    if (s) {
      billingLedger.push({
        id: p.id,
        studentName: s.name,
        subject: s.subject,
        date: p.date,
        amount: p.amount,
        isPaid: true,
        type: "payment"
      });
    }
  });

  // Add unpaid debts
  unpaidLessons.forEach(l => {
    const s = getStudentForId(l.studentId);
    if (s) {
      billingLedger.push({
        id: l.id,
        studentName: s.name,
        subject: s.subject,
        date: l.dateTime,
        amount: s.hourlyRate * (l.durationMinutes / 60),
        isPaid: false,
        type: "lesson"
      });
    }
  });

  const sortedLedger = billingLedger
    .filter(item => {
      if (filterType === "paid") return item.isPaid;
      if (filterType === "unpaid") return !item.isPaid;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Title Header with segmented period toggler */}
      <div className="px-4 pt-4 pb-2 space-y-3 bg-neutral-500/5 border-b border-neutral-500/10 shrink-0">
        <h1 className={`text-2xl font-black tracking-tight ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>
          Финансы
        </h1>

        {/* Picker Mode segmented picker (iOS native feel) */}
        <div className="flex bg-neutral-200/50 dark:bg-neutral-800/80 p-0.5 rounded-lg text-xs">
          {(["week", "month", "year"] as const).map(period => (
            <button
              key={period}
              onClick={() => {
                setFinancePeriod(period);
                setChartHoveredIdx(null);
              }}
              className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition ${
                financePeriod === period
                  ? "bg-white dark:bg-neutral-700 shadow-xs font-black text-neutral-900 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
              }`}
            >
              {period === "week" ? "Неделя" : period === "month" ? "Месяц" : "Год"}
            </button>
          ))}
        </div>
      </div>

      {/* Main scroll content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        
        {/* PREMIUM iOS SWIFT CHARTS GRAPH (Custom SVG Layout) */}
        <div className={`p-4 rounded-2xl border ${
          activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C]" : "bg-white border-[#E5E5EA]"
        }`}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold uppercase opacity-60 text-neutral-400">График Доходов</span>
            <span className="text-xs font-black text-emerald-500">
              {chartHoveredIdx !== null ? `${chartData[chartHoveredIdx].value} ₽` : "Коснитесь столбца"}
            </span>
          </div>

          {/* SVG Visual Bars with touch states */}
          <div className="h-28 flex items-end justify-between gap-1 pt-4 relative">
            {chartData.map((data, idx) => {
              const pct = (data.value / maxVal) * 80; // keep max bar at 80% height for padding
              const isHovered = chartHoveredIdx === idx;
              return (
                <div 
                  key={idx} 
                  onMouseEnter={() => setChartHoveredIdx(idx)}
                  onMouseLeave={() => setChartHoveredIdx(null)}
                  onClick={() => setChartHoveredIdx(idx)}
                  className="flex-1 flex flex-col items-center group cursor-pointer"
                >
                  {/* Dynamic value tooltip on hover */}
                  <div className={`h-24 w-full flex items-end justify-center rounded-lg transition-all duration-300 ${
                    isHovered 
                      ? "bg-[#30d158]/20" 
                      : "bg-[#007AFF]/10 hover:bg-[#007AFF]/25"
                  }`}>
                    <div 
                      className={`w-[60%] rounded-t-md transition-all duration-500 ${
                        isHovered ? "bg-emerald-500" : "bg-blue-500"
                      }`}
                      style={{ height: `${pct || 4}%` }} // fallback 4% height so empty looks tidy
                    />
                  </div>
                  <span className="text-[9px] font-semibold opacity-60 mt-1.5 leading-none">
                    {data.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* KPI Scorecard Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className={`p-3 rounded-xl border text-center ${
            activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] text-white" : "bg-white border-[#E5E5EA]"
          }`}>
            <span className="text-[8px] opacity-65 uppercase tracking-wide block font-semibold mb-1">Получено</span>
            <span className="text-xs font-black tracking-tight text-emerald-500">{totalRevenue.toLocaleString()} ₽</span>
          </div>

          <div className={`p-3 rounded-xl border text-center ${
            activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] text-white" : "bg-white border-[#E5E5EA]"
          }`}>
            <span className="text-[8px] opacity-65 uppercase tracking-wide block font-semibold mb-1">Долги</span>
            <span className="text-xs font-black tracking-tight text-amber-500">{totalDebt.toLocaleString()} ₽</span>
          </div>

          <div className={`p-3 rounded-xl border text-center ${
            activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] text-[#1C1C1E] dark:text-white" : "bg-white border-[#E5E5EA]"
          }`}>
            <span className="text-[8px] opacity-65 uppercase tracking-wide block font-semibold mb-1">Средний чек</span>
            <span className="text-xs font-black tracking-tight text-blue-500">{averageTicket.toLocaleString()} ₽</span>
          </div>
        </div>

        {/* Ledger Transaction History List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase opacity-60">Финансовый журнал</span>
            
            {/* Filter buttons */}
            <div className="flex gap-1">
              {(["all", "paid", "unpaid"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilterType(f)}
                  className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold transition ${
                    filterType === f 
                      ? "bg-blue-500/15 text-blue-500" 
                      : "text-neutral-400 hover:text-neutral-600"
                  }`}
                >
                  {f === "all" ? "Все" : f === "paid" ? "Оплаты" : "Долги"}
                </button>
              ))}
            </div>
          </div>

          {sortedLedger.length > 0 ? (
            <div className={`rounded-xl border divide-y overflow-hidden ${
              activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"
            }`}>
              {sortedLedger.map(item => (
                <div 
                  key={item.id} 
                  className="p-3 flex items-center justify-between text-xs transition hover:bg-neutral-500/5"
                >
                  <div className="flex items-center gap-3">
                    {item.isPaid ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                        <Check size={14} className="stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <AlertTriangle size={13} />
                      </div>
                    )}

                    <div className="space-y-0.5">
                      <span className={`font-bold block ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>
                        {item.studentName}
                      </span>
                      <span className="text-[10px] opacity-60 block">
                        {item.subject} • {new Date(item.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Right hand side action / value details */}
                  <div className="flex items-center gap-2">
                    <span className={`font-black text-xs ${item.isPaid ? "text-emerald-500" : "text-amber-500"}`}>
                      {item.isPaid ? "+" : ""}{item.amount} ₽
                    </span>

                    {!item.isPaid && (
                      <button
                        onClick={() => onMarkLessonPaid(item.id)}
                        className="p-1 px-2 rounded-md bg-emerald-500/10 text-emerald-500 font-bold hover:bg-emerald-500/20 active:scale-95 text-[10px] transition"
                        title="Подтвердить оплату"
                      >
                        Зачесть
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-center py-5 opacity-65">Записи в журнале оплат за выбранный период отсутствуют.</p>
          )}
        </div>

      </div>
    </div>
  );
}
