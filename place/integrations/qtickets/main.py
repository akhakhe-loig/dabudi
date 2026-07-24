# ============================================================================
#  HTTP-обёртка вокруг qtickets_sync: запускает выгрузку по кнопке из Place.
#
#  Выгрузка читает ВСЕ заказы и идёт минутами, поэтому запуск асинхронный:
#     POST /run     → сразу отдаёт job_id
#     GET  /status  → прогресс, а по завершении — готовый отчёт
#  Кнопка в Place опрашивает /status и показывает результат.
#
#  Все секреты — только в переменных окружения, в коде их нет.
# ============================================================================

import json
import os
import threading
import time
import uuid

import gspread
from fastapi import FastAPI, Header, HTTPException
from google.oauth2.service_account import Credentials
from pydantic import BaseModel

from qtickets_sync import run_sync

RUN_KEY = os.environ.get("RUN_KEY", "")
QT_TOKEN = os.environ.get("QT_TOKEN", "")
SHEET_URL = os.environ.get("SHEET_URL", "")
SA_JSON = os.environ.get("GOOGLE_SA_JSON", "")   # содержимое ключа сервисного аккаунта
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Настройки расчёта — совпадают с исходным скриптом.
SINCE = os.environ.get("SINCE") or None
MIDNIGHT_RULE = os.environ.get("MIDNIGHT_RULE", "1") != "0"
ROW_START = int(os.environ.get("ROW_START", "3"))
BACKFILL_DAYS = int(os.environ.get("BACKFILL_DAYS", "30"))

app = FastAPI(title="QTickets → Google Sheets")

JOBS = {}
JOBS_LOCK = threading.Lock()
JOB_TTL = 3600


class RunIn(BaseModel):
    apply: bool = True          # False — только сверка, без записи


def _check_key(key):
    if not RUN_KEY:
        raise HTTPException(status_code=500, detail="RUN_KEY не задан на сервисе")
    if key != RUN_KEY:
        raise HTTPException(status_code=403, detail="forbidden")


def _sheets_client():
    if not SA_JSON:
        raise RuntimeError("GOOGLE_SA_JSON не задан: нужен ключ сервисного аккаунта")
    creds = Credentials.from_service_account_info(json.loads(SA_JSON), scopes=SCOPES)
    return gspread.authorize(creds)


def _cleanup():
    now = time.time()
    for jid in [k for k, v in JOBS.items() if now - v.get("ts", now) > JOB_TTL]:
        JOBS.pop(jid, None)


def _worker(job_id, apply_writes):
    def progress(stage, pct):
        with JOBS_LOCK:
            job = JOBS.get(job_id)
            if job:
                job["stage"] = stage
                job["pct"] = int(pct)

    try:
        gc = _sheets_client()
        report = run_sync(QT_TOKEN, SHEET_URL, gc,
                          apply=apply_writes, since=SINCE,
                          midnight_rule=MIDNIGHT_RULE, row_start=ROW_START,
                          backfill_days=BACKFILL_DAYS, progress=progress)
        with JOBS_LOCK:
            JOBS[job_id].update(state="done", pct=100, stage="Готово", report=report)
    except Exception as e:                                  # noqa: BLE001
        with JOBS_LOCK:
            JOBS[job_id].update(state="error", stage="Ошибка", error=str(e))


@app.get("/health")
def health():
    return {"ok": 1, "configured": bool(RUN_KEY and QT_TOKEN and SHEET_URL and SA_JSON)}


@app.post("/run")
def run(body: RunIn = RunIn(), x_run_key: str = Header(default="")):
    _check_key(x_run_key)
    for name, val in (("QT_TOKEN", QT_TOKEN), ("SHEET_URL", SHEET_URL), ("GOOGLE_SA_JSON", SA_JSON)):
        if not val:
            raise HTTPException(status_code=500, detail="Не задана переменная окружения " + name)

    with JOBS_LOCK:
        _cleanup()
        # Параллельно две выгрузки не запускаем — вторая кнопка подхватит первую.
        for jid, j in JOBS.items():
            if j.get("state") == "running":
                return {"ok": 1, "job_id": jid, "already_running": True}
        job_id = uuid.uuid4().hex[:12]
        JOBS[job_id] = {"state": "running", "pct": 0, "stage": "Запускаю…", "ts": time.time()}

    threading.Thread(target=_worker, args=(job_id, body.apply), daemon=True).start()
    return {"ok": 1, "job_id": job_id}


@app.get("/status")
def status(job_id: str, x_run_key: str = Header(default="")):
    _check_key(x_run_key)
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Задача не найдена (возможно, устарела)")
        return dict(job)
