# Интеграции Place — «Google Colab → Qtickets → Google Sheets»

Кнопка **🤖 Colab** в меню питомца уже есть в интерфейсе. Осталось подключить
к ней исполнителя. Ниже — рекомендуемая архитектура и готовый код.

---

## Почему не «просто запустить Python локально»

Place — веб-приложение на хостинге, вы открываете его с любого устройства.
Браузер не может запустить Python на вашем компьютере: кнопка не сработает
с телефона, не сработает, когда компьютер выключен, а обращение со страницы
по `https://` на `http://localhost` блокируется браузером.

Поэтому логика должна жить **на сервере**, а приложение — только запускать её.

---

## Рекомендуемая схема (вариант A)

Тот же паттерн, которым в Place уже сделан Wordstat: секрет лежит в
`config.php`, наружу ходит сервер, браузер общается только со своим `api.php`.

```
Кнопка 🤖 в меню пета
  └─ srvCall('run_qtickets')          штатный механизм приложения
     └─ api.php     проверяет сессию, берёт URL и ключ из config.php
        └─ POST на Python-сервис      (Google Cloud Run / Render / VPS)
           └─ Google Sheets
```

**Что это даёт:** ключ не виден в браузере, не нужен CORS, запустить может
только авторизованный пользователь, а на фронтенде — ни строчки новой логики.

Python на Beget не поднять (нет постоянных процессов), поэтому сервис живёт
отдельно. Хороший выбор — **Google Cloud Run**: спит без нагрузки (при таких
объёмах фактически бесплатно) и находится в одной экосистеме с Google Sheets.

### Шаг 1. Python-сервис (из вашего ноутбука)

Перенесите код из Colab в обычный модуль и оберните в HTTP-эндпоинт:

```python
# main.py
import os
from fastapi import FastAPI, Header, HTTPException

app = FastAPI()
RUN_KEY = os.environ["RUN_KEY"]           # общий секрет с api.php

def sync_qtickets_to_sheets() -> dict:
    """Сюда переносится логика из Colab-ноутбука как есть."""
    # ... запрос в Qtickets API ...
    # ... запись в Google Sheets через gspread/service account ...
    return {"rows": 128}

@app.post("/run_qtickets")
def run_qtickets(x_run_key: str = Header(default="")):
    if x_run_key != RUN_KEY:
        raise HTTPException(status_code=403, detail="forbidden")
    result = sync_qtickets_to_sheets()
    return {"ok": 1, "message": f"Готово ✓ Обновлено строк: {result['rows']}"}
```

`requirements.txt`: `fastapi`, `uvicorn[standard]`, `gspread`,
`google-auth`, `requests`.

Деплой в Cloud Run (сервисный аккаунт дайте доступ к таблице — просто
поделитесь таблицей с его e-mail):

```bash
gcloud run deploy qtickets-sync --source . --region europe-west1 \
  --set-env-vars RUN_KEY=ваш-секрет --no-allow-unauthenticated
```

Для простоты можно оставить `--allow-unauthenticated`: защитой будет
`RUN_KEY`, который знает только ваш `api.php`.

### Шаг 2. `config.php` — две строки

```php
/* ---------- 7. ИНТЕГРАЦИЯ QTICKETS → GOOGLE SHEETS ---------- */
define('QT_URL', 'https://qtickets-sync-xxxx.run.app/run_qtickets');
define('QT_KEY', 'ваш-секрет');   /* тот же, что RUN_KEY в сервисе */
```

### Шаг 3. `api.php` — новое действие

Добавьте перед `default:` в `switch ($action)`:

```php
  case 'run_qtickets': {
    require_auth($in);
    if (!defined('QT_URL') || QT_URL === '') perr('Интеграция не настроена: задайте QT_URL в config.php', 400);
    $ch = curl_init(QT_URL);
    curl_setopt_array($ch, array(
      CURLOPT_POST           => true,
      CURLOPT_POSTFIELDS     => '{}',
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT        => 120,
      CURLOPT_HTTPHEADER     => array('Content-Type: application/json', 'X-Run-Key: ' . QT_KEY),
    ));
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($body === false || $code === 0) perr('Сервис недоступен: ' . $err, 502);
    if ($code >= 400) perr('Сервис вернул ошибку (HTTP ' . $code . ')', 502);
    $j = json_decode($body, true);
    pj(array('ok' => 1, 'message' => isset($j['message']) ? $j['message'] : 'Готово ✓'));
  }
```

### Шаг 4. Включить кнопку

В `index.html` найдите `var COLAB_ACTION='';` и впишите действие:

```js
var COLAB_ACTION='run_qtickets';
```

Готово — кнопка 🤖 в меню питомца запускает выгрузку.

### Необязательно: ночной автозапуск

Как и у Wordstat, можно добавить `cron_qtickets.php` (копия
`cron_wordstat.php` с вызовом того же URL) и задание в CronTab Beget.

---

## Вариант B — Google Apps Script (без своего сервиса)

Раз получатель — Google Sheets, скрипт можно повесить прямо на таблицу:
**Расширения → Apps Script**, опубликовать как веб-приложение и получить URL.
Инфраструктуры нет вообще, всё бесплатно, доступ к таблице родной.
Минус: логику придётся переписать с Python на JavaScript.

Тогда в `index.html` заполняется другая строка:

```js
var COLAB_URL='https://script.google.com/macros/s/AKfy.../exec';
```

> Учтите: этот URL виден в исходниках страницы. Годится, если эндпоинт
> ничего не разрушает и не отдаёт лишних данных. Нужна секретность —
> берите вариант A.

---

## Про долгие задачи

Если выгрузка идёт дольше ~2 минут, синхронный запрос упрётся в таймаут.
Тогда схема меняется на асинхронную: `run_qtickets` сразу отвечает
«запущено», сервис пишет статус, а приложение опрашивает его отдельным
действием. Начинать стоит с простого синхронного варианта — под типичную
выгрузку в Sheets его достаточно.

---

## Как добавить свою кнопку в меню питомца

Всё меню — один массив `PET_MENU` в `index.html`. Новый пункт = новый объект:

```js
{run:function(tile){ /* ваш код */ }, label:'Отчёт', icon:'<path d="…"/>'}
```

Поля: `label` — подпись, `icon` — содержимое SVG 24×24, `view` — перейти
в раздел приложения, `run` — своя функция (получает плитку, чтобы показать
состояние загрузки через `tile.classList.add('busy')`), `badge:'alert'` — счётчик.
Сетка, анимации, подсветка активного раздела подхватятся автоматически.
