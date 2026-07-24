# Выгрузка QTickets → Google Sheets (кнопка в Place)

Здесь живёт логика вашего Colab-ноутбука, пригодная для запуска с сайта.
Расчёт не менялся: `qtickets_sync.py` считает ровно так же, дословно
сохранены `sale_day` с правилом полуночи, `parse_tab`, `city_key`,
`find_cols`, `parse_day`, окно `BACKFILL_DAYS`, пропуск сегодняшнего дня
и будущего, правило «ровно один показ на город+дату» и запись **только в
пустые** ячейки Z/AB.

Отличается лишь обвязка — то, чего на сервере физически не бывает:

| В ноутбуке | Здесь | Почему |
|---|---|---|
| `google.colab.auth` (окно в браузере) | сервисный аккаунт | на сервере некому нажать «Разрешить» |
| `input('да')` | кнопка в Place | подтверждение переехало в интерфейс |
| `print(...)` | отчёт в модальном окне | видно, что заполнено и где расхождения |

---

## Шаг 1. Сервисный аккаунт Google (5 минут)

1. [console.cloud.google.com](https://console.cloud.google.com) → создайте
   проект (или возьмите существующий).
2. **APIs & Services → Library** → включите **Google Sheets API**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
4. У созданного аккаунта: **Keys → Add key → JSON** — скачается файл.
5. Откройте вашу таблицу и **поделитесь ею** с e-mail сервисного аккаунта
   (вида `…@…iam.gserviceaccount.com`) с правом **Редактор**.

## Шаг 2. Деплой сервиса (Google Cloud Run)

Из этой папки:

```bash
gcloud run deploy qtickets-sync --source . --region europe-west1 \
  --allow-unauthenticated --max-instances 1 --timeout 900 \
  --set-env-vars "RUN_KEY=придумайте-длинный-секрет" \
  --set-env-vars "QT_TOKEN=ваш-токен-qtickets" \
  --set-env-vars "SHEET_URL=https://docs.google.com/spreadsheets/d/…/edit" \
  --set-env-vars "GOOGLE_SA_JSON=$(cat ключ-сервисного-аккаунта.json | tr -d '\n')"
```

Пояснения:

* `--max-instances 1` — обязательно: статус задачи хранится в памяти
  сервиса, при нескольких копиях опрос мог бы попасть «не туда».
* `--timeout 900` — выгрузка читает все заказы и идёт минутами.
* `--allow-unauthenticated` не делает сервис открытым: без заголовка
  `X-Run-Key` он отвечает `403`. Ключ знает только ваш `api.php`.

Необязательные переменные (совпадают с настройками ноутбука):
`SINCE` (по умолчанию все заказы), `MIDNIGHT_RULE` (`1`/`0`),
`ROW_START` (3), `BACKFILL_DAYS` (30).

Проверка: `curl https://…run.app/health` → `{"ok":1,"configured":true}`.

## Шаг 3. Подключить к Place

В `config.php`:

```php
define('QT_URL', 'https://qtickets-sync-xxxx.run.app');   /* без /run на конце */
define('QT_KEY', 'тот-же-секрет-что-RUN_KEY');
```

Готово. Кнопка **Qtickets** в меню помощника запускает выгрузку, показывает
прогресс и открывает отчёт.

---

## Как это работает

```
Кнопка «Qtickets» в меню помощника
  └─ POST api.php  qtickets_run        проверяет вашу сессию
     └─ POST сервис /run               отдаёт job_id сразу
        └─ фоновый поток: QTickets → расчёт → Google Sheets
  └─ POST api.php  qtickets_status     опрос раз в 3 секунды
     └─ прогресс, затем готовый отчёт
```

Токен QTickets и ключ сервиса лежат в `config.php` на вашем хостинге и в
переменных окружения Cloud Run — в браузер они не попадают.

## Локальный запуск (для проверки)

```bash
pip install -r requirements.txt
export RUN_KEY=test QT_TOKEN=… SHEET_URL=… GOOGLE_SA_JSON="$(cat key.json)"
uvicorn main:app --reload
curl -X POST localhost:8000/run -H "X-Run-Key: test" -H "Content-Type: application/json" -d '{"apply":false}'
```

`{"apply": false}` — сверка без записи, безопасно для первого прогона.

## Что стоит знать

* **Смените токен QTickets.** Тот, что был вписан в ноутбук, стоит считать
  засвеченным: файл пересылался и лежал в открытом виде. Новый токен
  указывайте только в переменных окружения.
* **Ничего не перезаписывается.** Скрипт заполняет только пустые Z/AB.
  Если в таблице уже стоит число и оно расходится с расчётом — оно
  останется как есть, а расхождение попадёт в отчёт.
* **Про год.** В исходном скрипте год для дат берётся из текущего года
  (`today.year`). Логику не трогал, но на стыке декабря и января такие
  листы стоит проверять глазами.
* **Ночной автозапуск** при желании делается так же, как у Wordstat:
  задание в CronTab Beget, дёргающее `api.php`.
