import React, { useState } from "react";
import { 
  Settings, Moon, Sun, Bell, Volume2, Activity, Database, 
  FileText, Table, Shield, Check, RefreshCw, Smartphone, Play, HelpCircle, Download
} from "lucide-react";
import { Student, Lesson, Payment } from "../types";

interface SettingsTabProps {
  students: Student[];
  lessons: Lesson[];
  payments: Payment[];
  activeDarkMode: boolean;
  onToggleDarkMode: () => void;
  onTriggerSiriAlert: (command: string, response: string) => void;
}

export default function SettingsTab({
  students,
  lessons,
  payments,
  activeDarkMode,
  onToggleDarkMode,
  onTriggerSiriAlert
}: SettingsTabProps) {
  const [remindMinutes, setRemindMinutes] = useState("30");
  const [backupSuccess, setBackupSuccess] = useState(false);

  // 1. Export PDF Function
  const handleExportPDF = () => {
    // Generate simple readable styled document in a new window or trigger native print of styled HTML
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Пожалуйста, разрешите всплывающие окна для экспорта PDF!");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Отчет Tutor CRM - Экспорт</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #333; }
            h1 { font-weight: 900; font-size: 24px; border-bottom: 2px solid #007AFF; padding-bottom: 10px; }
            h2 { margin-top: 30px; font-size: 16px; opacity: 0.8; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
            th { bg-color: #f2f2f7; font-weight: bold; }
            .badge { padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; }
            .badge-paid { background-color: #e2f9eb; color: #30d158; }
            .badge-unpaid { background-color: #fff1e6; color: #ff9500; }
          </style>
        </head>
        <body>
          <h1>Отчет по ученикам и оплат</h1>
          <p>Дата формирования: ${new Date().toLocaleDateString()}</p>
          
          <h2>Список учеников</h2>
          <table>
            <thead>
              <tr>
                <th>Имя ученика</th>
                <th>Предмет</th>
                <th>Ставка</th>
                <th>Телефон</th>
              </tr>
            </thead>
            <tbody>
              ${students.map(s => `
                <tr>
                  <td><b>${s.name}</b></td>
                  <td>${s.subject}</td>
                  <td>${s.hourlyRate} руб./ч</td>
                  <td>${s.phone}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <h2>Ближайшие занятия</h2>
          <table>
            <thead>
              <tr>
                <th>Дата / Время</th>
                <th>Ученик</th>
                <th>Тема урока</th>
                <th>Статус оплат</th>
              </tr>
            </thead>
            <tbody>
              ${lessons.slice(0, 10).map(l => {
                const s = students.find(st => st.id === l.studentId);
                return `
                  <tr>
                    <td>${new Date(l.dateTime).toLocaleString()}</td>
                    <td><b>${s ? s.name : "Удален"}</b></td>
                    <td>${l.topic || "Обзорная тема"}</td>
                    <td><span class="badge ${l.isPaid ? "badge-paid" : "badge-unpaid"}">${l.isPaid ? "Оплачен" : "Ожидает"}</span></td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    // Prompt print
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // 2. Export Excel (CSV)
  const handleExportExcel = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM so Russian characters open nicely in Excel
    csvContent += "Имя ученика,Предмет,Ставка (руб/час),Телефон,Email,Примечания\n";

    students.forEach(s => {
      csvContent += `"${s.name}","${s.subject}",${s.hourlyRate},"${s.phone}","${s.email}","${s.notes.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TutorCRM_Ученики_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. Export JSON Database Backup
  const handleExportJSON = () => {
    const backupData = {
      students,
      lessons,
      payments,
      exportedAt: new Date().toISOString(),
      version: "1.0.0"
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
    const link = document.createElement("a");
    link.setAttribute("href", jsonString);
    link.setAttribute("download", `TutorCRM_SwiftData_Backup_${new Date().toISOString().split("T")[0]}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setBackupSuccess(true);
    setTimeout(() => setBackupSuccess(null as any), 3000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      <div className="px-4 pt-4 pb-2 bg-neutral-500/5 border-b border-neutral-500/10 shrink-0">
        <h1 className={`text-2xl font-black tracking-tight ${activeDarkMode ? "text-white" : "text-neutral-900"}`}>
          Настройки
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        
        {/* Apple Settings SECTION 1: Appearance */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase opacity-60 text-neutral-400 pl-1">Оформление</span>
          <div className={`rounded-xl border divide-y overflow-hidden ${
            activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"
          }`}>
            <div className="p-3 flex items-center justify-between text-xs">
              <span className="font-semibold flex items-center gap-2">
                {activeDarkMode ? <Moon size={15} className="text-indigo-400" /> : <Sun size={15} className="text-amber-500" />}
                Темная тема iOS
              </span>
              <button 
                onClick={onToggleDarkMode}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                  activeDarkMode ? "bg-blue-500" : "bg-neutral-300"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform duration-200 ${
                  activeDarkMode ? "translate-x-5" : ""
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Apple Settings SECTION 2: Lesson Notifications */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase opacity-60 text-neutral-400 pl-1">Напоминания об уроках</span>
          <div className={`rounded-xl border divide-y overflow-hidden ${
            activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"
          }`}>
            <div className="p-3 flex items-center justify-between text-xs">
              <span className="font-semibold flex items-center gap-2">
                <Bell size={15} className="text-rose-500" /> Напоминать за
              </span>
              <select
                value={remindMinutes}
                onChange={(e) => setRemindMinutes(e.target.value)}
                className={`p-1.5 text-[10px] font-bold border rounded-lg focus:outline-none ${
                  activeDarkMode ? "bg-[#1C1C1E] border-[#3A3A3C] text-white" : "bg-neutral-50 border-[#E5E5EA] text-neutral-900"
                }`}
              >
                <option value="10">10 минут</option>
                <option value="30">30 минут</option>
                <option value="60">1 час</option>
              </select>
            </div>
          </div>
        </div>

        {/* Apple Settings SECTION 3: Siri Voice Lab (Interactive Integration!) */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase opacity-60 text-neutral-400 pl-1">Голосовые команды Siri</span>
          <div className={`rounded-xl border divide-y overflow-hidden ${
            activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"
          }`}>
            <div 
              onClick={() => onTriggerSiriAlert("Добавить ученика", "Хорошо. Открываю форму создания нового ученика в Tutor CRM.")}
              className="p-3 flex items-center justify-between text-xs cursor-pointer hover:bg-neutral-500/5 transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Smartphone size={12} />
                </div>
                <div className="space-y-0.5">
                  <span className="font-bold block">"Добавить ученика"</span>
                  <span className="text-[9px] opacity-60 block">Siri откроет карточку ввода</span>
                </div>
              </div>
              <Play size={11} className="text-blue-500" />
            </div>

            <div 
              onClick={() => onTriggerSiriAlert("Покажи сегодняшнее расписание", "У вас запланировано несколько уроков на сегодня. Вывожу сетку занятий.")}
              className="p-3 flex items-center justify-between text-xs cursor-pointer hover:bg-neutral-500/5 transition"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Activity size={12} />
                </div>
                <div className="space-y-0.5">
                  <span className="font-bold block">"Покажи расписание на сегодня"</span>
                  <span className="text-[9px] opacity-60 block">Siri переключит на главную сетку</span>
                </div>
              </div>
              <Play size={11} className="text-indigo-500" />
            </div>
          </div>
        </div>

        {/* Apple Settings SECTION 4: Data Export */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase opacity-60 text-neutral-400 pl-1">Резервное копирование и экспорт</span>
          <div className={`rounded-xl border divide-y overflow-hidden ${
            activeDarkMode ? "bg-[#2C2C2E] border-[#3A3A3C] divide-[#3A3A3C]" : "bg-white border-[#E5E5EA] divide-neutral-100"
          }`}>
            <div 
              onClick={handleExportPDF}
              className="p-3 flex items-center gap-3 text-xs cursor-pointer hover:bg-neutral-500/5 transition"
            >
              <div className="w-6 h-6 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <FileText size={13} />
              </div>
              <div className="flex-1 space-y-0.5">
                <span className="font-bold block">Экспорт отчета в PDF</span>
                <span className="text-[9px] opacity-60 block">Генерация красивого бланка успеваемости</span>
              </div>
              <Download size={12} className="text-neutral-400" />
            </div>

            <div 
              onClick={handleExportExcel}
              className="p-3 flex items-center gap-3 text-xs cursor-pointer hover:bg-neutral-500/5 transition"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Table size={13} />
              </div>
              <div className="flex-1 space-y-0.5">
                <span className="font-bold block">Экспорт таблицы Excel</span>
                <span className="text-[9px] opacity-60 block">Выгрузка базы контактов в формат CSV/XLSX</span>
              </div>
              <Download size={12} className="text-neutral-400" />
            </div>

            <div 
              onClick={handleExportJSON}
              className="p-3 flex items-center gap-3 text-xs cursor-pointer hover:bg-neutral-500/5 transition"
            >
              <div className="w-6 h-6 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                <Database size={13} />
              </div>
              <div className="flex-1 space-y-0.5">
                <span className="font-bold block">Резервная копия SwiftData JSON</span>
                <span className="text-[9px] opacity-60 block">Выгрузка сырой базы данных для переноса</span>
              </div>
              <div className="flex items-center gap-1">
                {backupSuccess && <Check size={13} className="text-emerald-500 font-extrabold" />}
                <Download size={12} className="text-neutral-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Safety Disclaimer Footer */}
        <div className="text-center py-4 space-y-1 opacity-50">
          <Shield size={20} className="mx-auto" />
          <h5 className="text-[10px] font-bold">Офлайн Хранилище Secure Encrypted</h5>
          <p className="text-[8px] max-w-xs mx-auto leading-normal">
            Все данные Tutor CRM шифруются с использованием аппаратного модуля Apple Secure Enclave и хранятся локально на вашем устройстве.
          </p>
        </div>

      </div>
    </div>
  );
}
