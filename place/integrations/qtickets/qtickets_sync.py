# ============================================================================
#  QTickets → Google-таблица: ТОЧНЫЙ расчёт «Продано билетов» и суммы по дням.
#
#  Это то же самое, что делал Colab-ноутбук, но пригодное для запуска на
#  сервере по кнопке из Place.
#
#  РАСЧЁТ НЕ ИЗМЕНЁН. Дословно сохранены: fetch_all / extract / dt / ddmm /
#  sale_day (вместе с MIDNIGHT_RULE) / parse_tab / city_key / cell /
#  find_cols / parse_day, отбор «только завершённые дни» (сегодня и будущее
#  пропускаем), окно BACKFILL_DAYS, правило «один показ на город+дату» и
#  запись ТОЛЬКО в пустые ячейки Z/AB.
#
#  Отличается лишь обвязка — то, что физически невозможно на сервере:
#    1) авторизация Google: вместо google.colab.auth (окно в браузере)
#       используется сервисный аккаунт;
#    2) print(...) → структурированный отчёт (что заполнено, где расхождения);
#    3) input('да') → параметр apply: подтверждение делается кнопкой в Place,
#       а не вводом в терминале.
#
#  Известная особенность исходного скрипта, оставленная как есть (не трогаю
#  логику): год для дат берётся из today.year, поэтому листы, где показы
#  пересекают Новый год, нужно проверять глазами.
# ============================================================================

import datetime
import re
import time
from collections import defaultdict

import requests

try:
    from zoneinfo import ZoneInfo
    MSK = ZoneInfo("Europe/Moscow")
except Exception:
    MSK = datetime.timezone(datetime.timedelta(hours=3))

BASE = "https://qtickets.ru/api/rest/v1"


def run_sync(token, sheet_url, gc,
             apply=True, since=None, midnight_rule=True,
             row_start=3, backfill_days=30, progress=None):
    """Считает продажи и заполняет пустые ячейки Z/AB.

    token        — токен QTickets
    sheet_url    — ссылка на Google-таблицу
    gc           — авторизованный клиент gspread
    apply        — True: записать в таблицу; False: только сверка (dry-run)
    progress(stage, pct) — необязательный колбэк для индикатора прогресса

    Возвращает словарь-отчёт: что заполнено и где расхождения.
    """
    def say(stage, pct):
        if progress:
            try:
                progress(stage, pct)
            except Exception:
                pass

    log = []
    problems = []          # места, требующие внимания
    sheets_report = []     # что сделано по каждому листу

    S = requests.Session()
    S.headers.update({"Authorization": "Bearer " + token, "Accept": "application/json"})

    # ---------- сеть и разбор ответов (как в ноутбуке) ----------
    # ВАЖНО: api_get либо возвращает разобранный ответ, либо бросает исключение.
    # Возврат None здесь недопустим: пустой ответ выглядит для fetch_all как
    # «страницы кончились», и выгрузка молча обрывается на середине — в таблицу
    # уезжают заниженные числа под видом успеха.
    def api_get(path, params=None, tries=6):
        last = None
        for a in range(tries):
            try:
                r = S.get(BASE + path, params=params, timeout=90)
                if r.status_code == 429 or r.status_code >= 500:
                    last = RuntimeError("QTickets ответил HTTP %d на %s" % (r.status_code, path))
                    if a == tries - 1: break
                    time.sleep(2 * (a + 1)); continue
                r.raise_for_status(); return r.json()
            except Exception as e:
                last = e
                if a == tries - 1: break
                time.sleep(2 * (a + 1))
        raise RuntimeError(
            "QTickets не ответил за %d попыток на %s: %s. "
            "Выгрузка остановлена, чтобы не записать неполные данные." % (tries, path, last)
        )

    def extract(d):
        if isinstance(d, list): return d
        # Словарь без списка в "data" — это нормальный конец пагинации
        # ({"data": []} на странице за последней), останавливаемся тихо.
        if isinstance(d, dict): return d["data"] if isinstance(d.get("data"), list) else []
        # А вот всё остальное (None, строка, число) — это сбой, а не пустая
        # страница: молча оборвать выгрузку здесь значит записать неполные числа.
        raise RuntimeError(
            "QTickets вернул ответ неожиданного вида (%s). "
            "Выгрузка остановлена, чтобы не записать неполные данные." % type(d).__name__
        )

    def fetch_all(path, params, label, base_pct, span_pct):
        out, page = [], 1; params = dict(params or {})
        while True:
            params["page"] = page
            arr = extract(api_get(path, params))
            if not arr: break
            out.extend(arr)
            say("%s: страница %d, всего %d" % (label, page, len(out)),
                min(base_pct + span_pct - 1, base_pct + page))
            page += 1
        return out

    def dt(s): return datetime.datetime.fromisoformat(s).astimezone(MSK)
    def ddmm(d): return d.strftime("%d.%m")

    def sale_day(o):
        p = dt(o["payed_at"])
        if midnight_rule:
            cat = o.get("created_at") or (o.get("baskets") and o["baskets"][0].get("created_at"))
            if cat:
                c = dt(cat)
                if c.date() != p.date() and (p.date() - c.date()).days == 1 and c.hour >= 20 and p.hour < 6:
                    return ddmm(c)
        return ddmm(p)

    # ---------- ШАГ 1. Таблица ----------
    say("Подключаюсь к Google-таблице…", 2)
    sh = gc.open_by_url(sheet_url)
    log.append("Таблица подключена: %s" % sh.title)

    # ---------- ШАГ 2. Читаем QTickets ----------
    today = datetime.datetime.now(MSK).date()
    yesterday = today - datetime.timedelta(days=1)
    log.append("Сегодня %s. Заполняю строго по вчера (%s) включительно — "
               "сегодняшний день ещё не завершён, его и будущее пропускаю." % (today, yesterday))

    say("Читаю мероприятия…", 5)
    events = fetch_all("/events", {}, "события", 5, 10)
    shows = {}
    for e in events:
        for s in (e.get("shows") or []):
            if s.get("start_date"):
                shows[str(s["id"])] = {"date": dt(s["start_date"]).date(), "name": e.get("name", "")}
    cutoff = today - datetime.timedelta(days=backfill_days)
    active_shows = {sid: v for sid, v in shows.items() if v["date"] >= cutoff}
    log.append("Показов всего: %d; в работе (дата >= %s): %d" % (len(shows), cutoff, len(active_shows)))

    say("Читаю заказы (это пара минут)…", 16)
    params = ({"where[0][column]": "payed_at", "where[0][operator]": ">=", "where[0][value]": since}
              if since else {})
    orders = fetch_all("/orders", params, "заказы", 16, 44)
    log.append("Заказов прочитано: %d" % len(orders))

    tally = defaultdict(lambda: defaultdict(lambda: [0, 0.0]))   # show_id -> "dd.mm" -> [sold, rev]
    for o in orders:
        if o.get("payed") is not True or not o.get("payed_at"): continue
        day = sale_day(o)
        for b in (o.get("baskets") or []):
            sid = str(b.get("show_id"))
            if sid not in active_shows: continue
            tally[sid][day][0] += (b.get("quantity") or 1)
            tally[sid][day][1] += float(b.get("price") or 0)

    # ---------- ШАГ 3. Сверка по всем активным листам ----------
    def parse_tab(title):
        t = str(title).strip()
        m = re.search(r'(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?', t)
        if not m: return None
        d, mo = int(m.group(1)), int(m.group(2))
        if not (1 <= d <= 31 and 1 <= mo <= 12): return None
        if m.group(3):
            y = int(m.group(3)); y += 2000 if y < 100 else 0
        else:
            y = today.year
            try:
                if datetime.date(y, mo, d) < today - datetime.timedelta(days=180): y += 1
            except ValueError:
                return None
        try:
            date_obj = datetime.date(y, mo, d)
        except ValueError:
            return None
        city = re.sub(r'\(\d+\)\s*$', '', t[:m.start()]).strip()
        city = re.sub(r'[\s\(\)\[\]\-/–—.,]+$', '', city).strip()
        if not city: return None
        return {"city": city, "date": date_obj, "ddmm": "%02d.%02d" % (d, mo)}

    def city_key(s):
        s = re.sub(r'[^а-яёa-z]', '', str(s).lower())
        return s[:max(4, len(s) - 2)]   # «астрахань» / «в астрахани» → общий корень

    def cell(vals, r, c): return vals[r][c] if (r < len(vals) and c < len(vals[r])) else ""

    def find_cols(vals):
        date_c, z_c, ab_c = 11, 25, 27   # запасные: L, Z, AB (0-based)
        if len(vals) >= 2:
            for i, h in enumerate(vals[1]):
                hl = str(h).strip().lower()
                if hl == "дата": date_c = i
                elif hl == "total conv": z_c = i
                elif hl == "weekly revenue": ab_c = i
        return date_c, z_c, ab_c

    def parse_day(s):
        m = re.match(r'^(\d{1,2})[.\-/](\d{1,2})', str(s).strip())
        return (m.group(1).zfill(2) + "." + m.group(2).zfill(2)) if m else None

    plan = []
    worksheets = sh.worksheets()
    for idx, ws in enumerate(worksheets):
        say("Сверяю листы (%d из %d)…" % (idx + 1, len(worksheets)),
            60 + int(25.0 * idx / max(1, len(worksheets))))
        p = parse_tab(ws.title)
        if not p or p["date"] < cutoff: continue
        cand = [sid for sid, v in active_shows.items()
                if v["date"] == p["date"] and city_key(p["city"]) in city_key(v["name"])]
        if len(cand) != 1:
            same_date = [v["name"] for sid, v in active_shows.items() if v["date"] == p["date"]]
            problems.append({
                "type": "skip", "tab": ws.title,
                "text": "Лист пропущен: город «%s», дата %s. %s" % (
                    p["city"], p["date"],
                    ("Показы QTickets на эту дату: " + ", ".join(same_date)) if same_date
                    else "Показов QTickets на эту дату нет.")
            })
            continue
        sid = cand[0]; days = tally.get(sid, {})
        vals = ws.get_all_values()
        dcol, zcol, abcol = find_cols(vals)
        towrite, rows = [], []
        for r in range(row_start - 1, len(vals)):
            dd = parse_day(cell(vals, r, dcol))
            if not dd: continue
            d_obj = datetime.date(today.year, int(dd[3:5]), int(dd[0:2]))
            if d_obj >= today: continue   # только завершённые дни
            rec = days.get(dd, [0, 0.0]); sold, rev = rec[0], round(rec[1], 2)
            curZ, curAB = cell(vals, r, zcol), cell(vals, r, abcol)
            differs = not (curZ == "" or str(curZ) == str(sold))
            rows.append({"day": dd, "sold": sold, "table_z": curZ,
                         "rev": rev, "table_ab": curAB, "differs": differs})
            if differs:
                problems.append({
                    "type": "mismatch", "tab": ws.title, "day": dd,
                    "text": "%s, день %s: в таблице %s, по расчёту %s — оставил как есть."
                            % (ws.title, dd, curZ, sold)
                })
            if curZ == "": towrite.append((r + 1, zcol + 1, sold))
            if curAB == "": towrite.append((r + 1, abcol + 1, rev))
        plan.append((ws, towrite))
        sheets_report.append({"tab": ws.title, "show_id": sid,
                              "to_write": len(towrite), "rows": rows})
        time.sleep(1)

    total = sum(len(t) for _, t in plan)

    # ---------- ШАГ 4. Запись только в ПУСТЫЕ ячейки ----------
    written = 0
    if apply:
        import gspread
        for i, (ws, towrite) in enumerate(plan):
            if not towrite: continue
            say("Записываю в таблицу (%d из %d)…" % (i + 1, len(plan)),
                85 + int(13.0 * i / max(1, len(plan))))
            ws.update_cells([gspread.Cell(r, c, v) for (r, c, v) in towrite],
                            value_input_option="USER_ENTERED")
            written += len(towrite)
            for s in sheets_report:
                if s["tab"] == ws.title: s["written"] = len(towrite)
            log.append("%s: записано %d ячеек" % (ws.title, len(towrite)))
            time.sleep(1)
        log.append("Готово: пустые Z/AB заполнены точными числами.")
    else:
        log.append("Сверка без записи: заполнить можно %d ячеек." % total)

    say("Готово", 100)
    return {
        "ok": 1,
        "applied": bool(apply),
        "sheet_title": sh.title,
        "today": str(today),
        "orders": len(orders),
        "shows_active": len(active_shows),
        "planned": total,
        "written": written,
        "sheets": sheets_report,
        "problems": problems,
        "log": log,
    }
