<?php
/* =============================================================
   PLACE v13 · СЕРВЕРНАЯ ЧАСТЬ (api.php)
   -------------------------------------------------------------
   Один файл: аутентификация, хранение данных, общие разделы,
   сборщик Яндекс Wordstat, cron-задачи и резервные копии.
   База: SQLite (файл), лежит вне публичной папки.
   Требования: PHP 7.4+ с расширениями pdo_sqlite и curl.

   Проверка после установки (откройте в браузере), где КЛЮЧ — это CRON_KEY
   из config.php:
       https://ваш-сайт/api.php?action=selftest&key=КЛЮЧ
   Без ключа самодиагностика не отвечает: она показывает пути на сервере,
   версии и число аккаунтов — это не то, что стоит отдавать в открытый доступ.
   ============================================================= */

define('PLACE_API', 1);
define('PLACE_VERSION', '13.0');

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

$__cfg = __DIR__ . '/config.php';
if (!is_file($__cfg)) { pj(array('error' => 'Нет файла config.php рядом с api.php. Скопируйте config.sample.php в config.php и заполните его (config.php специально не хранится в репозитории — в нём секреты).'), 500); }
require $__cfg;

if (defined('PLACE_TZ') && PLACE_TZ) { @date_default_timezone_set(PLACE_TZ); }

/* ================= ОБЩИЕ ХЕЛПЕРЫ ================= */

function pj($arr, $code = 200) { /* json-ответ и выход */
  if (PHP_SAPI === 'cli') { echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), "\n"; exit($code >= 400 ? 1 : 0); }
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}
function perr($msg, $code = 400, $extra = array()) { pj(array_merge(array('error' => $msg), $extra), $code); }
function now_ms() { return (int) round(microtime(true) * 1000); }
function rnd_id($len = 8) { return bin2hex(random_bytes($len)); }

/* ================= ПАПКА ДАННЫХ И БАЗА ================= */

function data_dir() {
  static $dir = null;
  if ($dir !== null) return $dir;
  $cands = array();
  if (defined('PLACE_DB_DIR') && PLACE_DB_DIR) $cands[] = rtrim(PLACE_DB_DIR, '/');
  $cands[] = dirname(__DIR__) . '/place-data';   /* над public_html — недоступно из веба */
  $cands[] = __DIR__ . '/place-data';            /* запасной вариант, закрываем .htaccess */
  foreach ($cands as $c) {
    if (!is_dir($c)) { @mkdir($c, 0750, true); }
    if (is_dir($c) && is_writable($c)) {
      if (strpos($c, __DIR__) === 0) { /* внутри веб-папки — запрещаем доступ снаружи */
        if (!is_file($c . '/.htaccess')) @file_put_contents($c . '/.htaccess', "Require all denied\nDeny from all\n");
        if (!is_file($c . '/index.html')) @file_put_contents($c . '/index.html', '');
      }
      $dir = $c; return $dir;
    }
  }
  perr('Не удалось создать папку данных. Создайте вручную папку place-data рядом с public_html и дайте права на запись, либо задайте PLACE_DB_DIR в config.php.', 500);
}

function db() {
  static $pdo = null;
  if ($pdo !== null) return $pdo;
  $path = data_dir() . '/place.db';
  try {
    $pdo = new PDO('sqlite:' . $path);
  } catch (Exception $e) {
    /* Текст ошибки PDO содержит абсолютный путь к базе — наружу его не отдаём,
       он уходит в лог хостинга. Подробности видит selftest (он под ключом). */
    error_log('place: не удалось открыть базу SQLite (' . $path . '): ' . $e->getMessage());
    perr('Не удалось открыть базу данных. Проверьте, что включено расширение pdo_sqlite, и запустите самодиагностику: api.php?action=selftest&key=CRON_KEY', 500);
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->exec('PRAGMA journal_mode=WAL');
  $pdo->exec('PRAGMA busy_timeout=6000');
  $pdo->exec('PRAGMA foreign_keys=ON');
  schema($pdo);
  return $pdo;
}

function schema($pdo) {
  $pdo->exec("CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, login TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '',
      pass_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created INTEGER NOT NULL)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS sessions(
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL, last_seen INTEGER NOT NULL)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS userdata(
      user_id TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS shared(
      key TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT)");
  $pdo->exec("CREATE TABLE IF NOT EXISTS attempts(login TEXT, ip TEXT, ts INTEGER)");
  first_run($pdo);
}

function meta_get($k, $def = null) { $s = db()->prepare('SELECT value FROM meta WHERE key=?'); $s->execute(array($k)); $v = $s->fetchColumn(); return ($v === false) ? $def : $v; }
function meta_set($k, $v) { $s = db()->prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'); $s->execute(array($k, (string)$v)); }

function first_run($pdo) {
  $n = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
  if ($n > 0) return;
  $pass = defined('INITIAL_ADMIN_PASS') ? INITIAL_ADMIN_PASS : '';
  if ($pass === '' || $pass === 'ПОМЕНЯЙТЕ_МЕНЯ' || mb_strlen($pass) < 6) {
    perr('Первый запуск: откройте config.php и задайте свой INITIAL_ADMIN_PASS (минимум 6 символов). Это защита, чтобы сайт не поднялся с паролем по умолчанию.', 500);
  }
  $st = $pdo->prepare('INSERT INTO users(id,login,name,pass_hash,role,created) VALUES(?,?,?,?,?,?)');
  $st->execute(array(
    rnd_id(),
    strtolower(trim(defined('INITIAL_ADMIN_LOGIN') ? INITIAL_ADMIN_LOGIN : 'admin')),
    (defined('INITIAL_ADMIN_NAME') ? INITIAL_ADMIN_NAME : 'Администратор'),
    password_hash($pass, PASSWORD_DEFAULT),
    'admin',
    now_ms()
  ));
  meta_set('created', date('c'));
}

/* ================= АУТЕНТИФИКАЦИЯ ================= */

function client_ip() { return isset($_SERVER['REMOTE_ADDR']) ? substr((string)$_SERVER['REMOTE_ADDR'], 0, 45) : 'cli'; }

/* ---- Ключ для cron и самодиагностики ----
   Стандартный ключ из config.php считаем НЕзаданным: он лежит в открытом
   репозитории, и если его не сменили — запуск по ссылке должен быть закрыт,
   а не защищён общеизвестной строкой. Та же логика, что у INITIAL_ADMIN_PASS:
   лучше честно не работать, чем работать «в открытую». */
define('CRON_KEY_DEFAULT', 'смените-этот-ключ-на-случайный');

function cron_key_ready() {
  if (!defined('CRON_KEY')) return false;
  $k = (string)CRON_KEY;
  return ($k !== '' && $k !== CRON_KEY_DEFAULT && mb_strlen($k) >= 20);
}
function cron_key_ok($key) {
  if (!cron_key_ready()) return false;
  return is_string($key) && $key !== '' && hash_equals((string)CRON_KEY, $key);
}
/* Отказ с понятной причиной: админу надо знать, что дело в незаполненном
   config.php, а не в опечатке в ссылке. */
function cron_key_deny() {
  if (!cron_key_ready()) {
    perr('CRON_KEY в config.php не задан или остался стандартным. Впишите свою случайную строку от 20 символов — пока её нет, запуск по ссылке и самодиагностика закрыты.', 403);
  }
  perr('Неверный ключ.', 403);
}

function req_key($in) {
  if (isset($_GET['key'])) return (string)$_GET['key'];
  return isset($in['key']) ? (string)$in['key'] : '';
}

function rate_check($login) {
  $d = db(); $now = now_ms();
  $d->prepare('DELETE FROM attempts WHERE ts < ?')->execute(array($now - 15 * 60 * 1000));
  $s = $d->prepare('SELECT COUNT(*) FROM attempts WHERE login=? OR ip=?');
  $s->execute(array($login, client_ip()));
  if ((int)$s->fetchColumn() >= 8) perr('Слишком много неудачных попыток входа. Подождите 10–15 минут.', 429);
}
function rate_fail($login) { db()->prepare('INSERT INTO attempts(login,ip,ts) VALUES(?,?,?)')->execute(array($login, client_ip(), now_ms())); }
function rate_ok($login) { db()->prepare('DELETE FROM attempts WHERE login=?')->execute(array($login)); }

function user_pub($u) {
  return array('id' => $u['id'], 'login' => $u['login'], 'name' => $u['name'], 'role' => $u['role'], 'created' => (int)$u['created']);
}

function auth_user($token) {
  if (!is_string($token) || strlen($token) < 20) return null;
  $d = db();
  $s = $d->prepare('SELECT s.token, s.last_seen, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?');
  $s->execute(array($token));
  $row = $s->fetch(PDO::FETCH_ASSOC);
  if (!$row) return null;
  $now = now_ms();
  if ($now - (int)$row['last_seen'] > 30 * 24 * 3600 * 1000) { /* сессия протухла */
    $d->prepare('DELETE FROM sessions WHERE token=?')->execute(array($token));
    return null;
  }
  if ($now - (int)$row['last_seen'] > 10 * 60 * 1000) {
    $d->prepare('UPDATE sessions SET last_seen=? WHERE token=?')->execute(array($now, $token));
  }
  return $row;
}

function require_auth($in) {
  $u = auth_user(isset($in['token']) ? $in['token'] : '');
  if (!$u) perr('Сессия недействительна — войдите заново.', 401, array('auth' => false));
  return $u;
}
function require_admin($in) {
  $u = require_auth($in);
  if ($u['role'] !== 'admin') perr('Доступно только администратору.', 403);
  return $u;
}

function make_session($userId) {
  $t = rnd_id(24); $now = now_ms();
  db()->prepare('INSERT INTO sessions(token,user_id,created,last_seen) VALUES(?,?,?,?)')->execute(array($t, $userId, $now, $now));
  db()->prepare('DELETE FROM sessions WHERE last_seen < ?')->execute(array($now - 45 * 24 * 3600 * 1000));
  return $t;
}

/* ================= ДАННЫЕ ================= */

function userdata_get($uid) {
  $s = db()->prepare('SELECT json FROM userdata WHERE user_id=?'); $s->execute(array($uid));
  $j = $s->fetchColumn();
  if ($j === false) return null;
  $v = json_decode($j, true);
  return is_array($v) ? $v : null;
}
function userdata_set($uid, $arr) {
  $j = json_encode($arr, JSON_UNESCAPED_UNICODE);
  if ($j === false) perr('Не удалось сериализовать данные (json).', 400);
  if (strlen($j) > 64 * 1024 * 1024) perr('Данные слишком большие (>64 МБ). Уменьшите количество тяжёлых картинок-креативов.', 413);
  $s = db()->prepare('INSERT INTO userdata(user_id,json,updated) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json, updated=excluded.updated');
  $s->execute(array($uid, $j, now_ms()));
}
function shared_get($key) {
  $s = db()->prepare('SELECT json FROM shared WHERE key=?'); $s->execute(array($key));
  $j = $s->fetchColumn();
  if ($j === false) return null;
  $v = json_decode($j, true);
  return is_array($v) ? $v : null;
}
function shared_set($key, $arr) {
  $j = json_encode($arr, JSON_UNESCAPED_UNICODE);
  if ($j === false) perr('Не удалось сериализовать данные (json).', 400);
  if (strlen($j) > 64 * 1024 * 1024) perr('Данные слишком большие (>64 МБ).', 413);
  $s = db()->prepare('INSERT INTO shared(key,json,updated) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET json=excluded.json, updated=excluded.updated');
  $s->execute(array($key, $j, now_ms()));
}

function ws_status_arr() {
  $mode = defined('WORDSTAT_MODE') ? WORDSTAT_MODE : '';
  $tok  = defined('WORDSTAT_TOKEN') ? WORDSTAT_TOKEN : '';
  $q = json_decode((string)meta_get('ws_quota', ''), true);
  return array(
    'tokenSet' => ($mode !== '' && $tok !== ''),
    'mode' => $mode,
    'lastCron' => (int)meta_get('ws_last_run', 0),
    'lastCronNote' => (string)meta_get('ws_last_note', ''),
    'quota' => is_array($q) ? $q : null
  );
}

function bundle($user, $token) {
  return array(
    'ok' => 1,
    'token' => $token,
    'user' => user_pub($user),
    'data' => userdata_get($user['id']),
    'digest' => shared_get('digest'),
    'trends' => shared_get('trends'),
    'ws' => ws_status_arr(),
    'server' => array('version' => PLACE_VERSION, 'time' => now_ms())
  );
}

/* ================= WORDSTAT: СБОРЩИК ================= */

function ws_monday_ago($weeks) {
  $t = new DateTime('now', new DateTimeZone('UTC'));
  $dow = ((int)$t->format('N')) - 1;            /* 0 = понедельник */
  $t->modify('-' . ($dow + $weeks * 7) . ' days');
  return $t->format('Y-m-d');
}

function ws_call($method, $body) {
  $mode = WORDSTAT_MODE;
  $base = ($mode === 'cloud')
    ? 'https://searchapi.api.cloud.yandex.net/v2/wordstat/'
    : 'https://api.wordstat.yandex.net/v1/';
  $auth = ($mode === 'cloud' ? 'Api-Key ' : 'Bearer ') . WORDSTAT_TOKEN;
  if ($mode === 'cloud' && defined('WORDSTAT_FOLDER_ID') && WORDSTAT_FOLDER_ID) $body['folderId'] = WORDSTAT_FOLDER_ID;
  $ch = curl_init($base . $method);
  curl_setopt_array($ch, array(
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER => array('Content-Type: application/json; charset=utf-8', 'Authorization: ' . $auth, 'Accept: application/json'),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_CONNECTTIMEOUT => 12
  ));
  $raw = curl_exec($ch);
  $errno = curl_errno($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);
  if ($errno) return array(false, 'сеть: ' . curl_strerror($errno), 0);
  $j = json_decode((string)$raw, true);
  if ($code < 200 || $code >= 300) {
    $msg = 'HTTP ' . $code;
    if (is_array($j)) { $msg .= ' · ' . mb_substr(json_encode($j, JSON_UNESCAPED_UNICODE), 0, 220); }
    elseif (is_string($raw) && $raw !== '') { $msg .= ' · ' . mb_substr($raw, 0, 220); }
    return array(false, $msg, $code);
  }
  return array(true, is_array($j) ? $j : array(), $code);
}

function ws_regions($settings) {
  $s = isset($settings['regions']) ? trim((string)$settings['regions']) : '';
  if ($s === '') return null;
  $parts = preg_split('/[,;\s]+/u', $s, -1, PREG_SPLIT_NO_EMPTY);
  if (!$parts) return null;
  if (WORDSTAT_MODE === 'cloud') return array_map('strval', $parts);
  $out = array();
  foreach ($parts as $p) { if (is_numeric($p) && (int)$p > 0) $out[] = (int)$p; }
  return $out ? $out : null;
}

function ws_dynamics($phrase, $regions) {
  $from = ws_monday_ago(110); $to = ws_monday_ago(0);
  if (WORDSTAT_MODE === 'cloud') {
    $req = array('phrase' => $phrase, 'period' => 'PERIOD_WEEKLY', 'fromDate' => $from . 'T00:00:00Z', 'toDate' => $to . 'T00:00:00Z');
  } else {
    $req = array('phrase' => $phrase, 'period' => 'weekly', 'fromDate' => $from, 'toDate' => date('Y-m-d'));
  }
  if ($regions) $req['regions'] = $regions;
  list($ok, $r, $code) = ws_call('dynamics', $req);
  if (!$ok) return array(false, $r);
  $arr = array();
  $src = isset($r['dynamics']) && is_array($r['dynamics']) ? $r['dynamics'] : (isset($r['results']) && is_array($r['results']) ? $r['results'] : array());
  foreach ($src as $x) {
    $d = isset($x['date']) ? substr((string)$x['date'], 0, 10) : '';
    if ($d === '') continue;
    $arr[] = array('date' => $d, 'count' => (int)(isset($x['count']) ? $x['count'] : 0), 'share' => (float)(isset($x['share']) ? $x['share'] : 0));
  }
  return array(true, $arr);
}

function ws_top($phrase, $regions) {
  $req = array('phrase' => $phrase);
  if (WORDSTAT_MODE === 'cloud') $req['numPhrases'] = 30;
  if ($regions) $req['regions'] = $regions;
  list($ok, $r, $code) = ws_call('topRequests', $req);
  if (!$ok) return array(false, $r);
  $pc = function ($x) { return array('phrase' => (string)(isset($x['phrase']) ? $x['phrase'] : ''), 'count' => (int)(isset($x['count']) ? $x['count'] : 0)); };
  $top = isset($r['topRequests']) && is_array($r['topRequests']) ? $r['topRequests'] : (isset($r['results']) && is_array($r['results']) ? $r['results'] : array());
  $as  = isset($r['associations']) && is_array($r['associations']) ? $r['associations'] : array();
  return array(true, array(
    'total' => isset($r['totalCount']) ? (int)$r['totalCount'] : null,
    'top' => array_map($pc, array_slice($top, 0, 30)),
    'assoc' => array_map($pc, array_slice($as, 0, 30))
  ));
}

function ws_quota_fetch() {
  if (WORDSTAT_MODE !== 'wordstat') return null;
  list($ok, $r, $code) = ws_call('userInfo', new stdClass());
  if ($ok && isset($r['userInfo']) && is_array($r['userInfo'])) return $r['userInfo'];
  return null;
}

function ws_norm_phrase($s) { return mb_strtolower(trim(preg_replace('/\s+/u', ' ', (string)$s))); }

/* Полный сбор: обновляет shared('trends'). $onlyId — обновить одну фразу. */
function ws_collect($onlyId = null) {
  if (WORDSTAT_MODE === '' || WORDSTAT_TOKEN === '') return array('error' => 'Токен Wordstat не задан в config.php на сервере.');
  $lock = (int)meta_get('ws_lock', 0);
  if (now_ms() - $lock < 120 * 1000) return array('error' => 'Обновление уже идёт — подождите минуту.');
  meta_set('ws_lock', now_ms());

  $tr = shared_get('trends');
  if (!is_array($tr)) $tr = array();
  if (!isset($tr['phrases']) || !is_array($tr['phrases'])) $tr['phrases'] = array();
  if (!isset($tr['snap']) || !is_array($tr['snap'])) $tr['snap'] = array();
  if (!isset($tr['candidates']) || !is_array($tr['candidates'])) $tr['candidates'] = array();
  $settings = (isset($tr['settings']) && is_array($tr['settings'])) ? $tr['settings'] : array();
  $regions = ws_regions($settings);

  $tracked = array(); foreach ($tr['phrases'] as $p) { if (isset($p['phrase'])) $tracked[ws_norm_phrase($p['phrase'])] = 1; }
  $seen = array(); foreach ($tr['candidates'] as $c) { if (isset($c['phrase'])) $seen[ws_norm_phrase($c['phrase'])] = 1; }
  $newCand = array();

  $done = 0; $errs = array();
  $list = array_slice($tr['phrases'], 0, 200);
  foreach ($list as $ph) {
    if (!isset($ph['id']) || !isset($ph['phrase'])) continue;
    if ($onlyId !== null && $ph['id'] !== $onlyId) continue;
    list($ok, $weekly) = ws_dynamics($ph['phrase'], $regions);
    if (!$ok) { $errs[] = $ph['phrase'] . ' — ' . $weekly; usleep(150000); continue; }
    if (!isset($tr['snap'][$ph['id']]) || !is_array($tr['snap'][$ph['id']])) $tr['snap'][$ph['id']] = array();
    if (count($weekly)) $tr['snap'][$ph['id']]['weekly'] = $weekly;
    $tr['snap'][$ph['id']]['updated'] = now_ms();
    list($ok2, $t) = ws_top($ph['phrase'], $regions);
    if ($ok2) {
      $tr['snap'][$ph['id']]['total'] = $t['total'];
      $tr['snap'][$ph['id']]['top'] = $t['top'];
      $tr['snap'][$ph['id']]['assoc'] = $t['assoc'];
      $pool = array_merge($t['assoc'], array_slice($t['top'], 1));
      foreach ($pool as $x) {
        $n = ws_norm_phrase($x['phrase']);
        if ($n === '' || isset($tracked[$n]) || isset($seen[$n]) || isset($newCand[$n])) continue;
        if ($x['count'] < 100) continue;
        $newCand[$n] = array('phrase' => $x['phrase'], 'count' => $x['count'], 'src' => $ph['phrase'], 'ts' => now_ms());
      }
    }
    $done++;
    usleep(180000); /* мягкий троттлинг ~5 запросов/сек */
  }

  foreach ($newCand as $c) $tr['candidates'][] = $c;
  usort($tr['candidates'], function ($a, $b) { return (isset($b['count']) ? $b['count'] : 0) - (isset($a['count']) ? $a['count'] : 0); });
  $tr['candidates'] = array_slice($tr['candidates'], 0, 30);
  if ($onlyId === null || $done > 0) $tr['lastSync'] = now_ms();
  if ($done > 0) $tr['demo'] = false;
  $q = ws_quota_fetch();
  if ($q) { $tr['quota'] = $q; meta_set('ws_quota', json_encode($q, JSON_UNESCAPED_UNICODE)); }
  shared_set('trends', $tr);
  meta_set('ws_last_run', now_ms());
  $note = 'обновлено фраз: ' . $done . (count($errs) ? ('; ошибок: ' . count($errs) . ' (' . mb_substr($errs[0], 0, 140) . ')') : '');
  meta_set('ws_last_note', $note);
  meta_set('ws_lock', 0);
  clog('wordstat: ' . $note);
  return array('ok' => 1, 'done' => $done, 'errors' => $errs, 'trends' => $tr, 'ws' => ws_status_arr());
}

/* ================= РЕЗЕРВНЫЕ КОПИИ И ЛОГ ================= */

function clog($msg) {
  $f = data_dir() . '/cron.log';
  $line = date('Y-m-d H:i:s') . '  ' . $msg . "\n";
  $old = is_file($f) ? (string)@file_get_contents($f) : '';
  $lines = explode("\n", $old);
  if (count($lines) > 400) $old = implode("\n", array_slice($lines, -300));
  @file_put_contents($f, $old . $line);
}

function do_backup() {
  $dir = data_dir() . '/backups';
  if (!is_dir($dir)) @mkdir($dir, 0750, true);
  if (!is_dir($dir) || !is_writable($dir)) return array('error' => 'Нет доступа к папке backups');
  $name = $dir . '/place-' . date('Y-m-d_Hi') . '.db';
  $ok = false; $how = '';
  try { db()->exec("VACUUM INTO '" . str_replace("'", "''", $name) . "'"); $ok = is_file($name); $how = 'vacuum'; }
  catch (Exception $e) { $ok = false; }
  if (!$ok) { /* запасной путь: checkpoint + копия файла */
    try { db()->exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (Exception $e) {}
    $ok = @copy(data_dir() . '/place.db', $name); $how = 'copy';
  }
  $files = glob($dir . '/place-*.db');
  if (is_array($files)) {
    sort($files);
    $keep = defined('BACKUP_KEEP') ? max(3, (int)BACKUP_KEEP) : 30;
    while (count($files) > $keep) { @unlink(array_shift($files)); }
  }
  $msg = $ok ? ('backup ok (' . $how . '): ' . basename($name) . ', ' . round(@filesize($name) / 1024) . ' КБ') : 'backup FAILED';
  clog($msg);
  return $ok ? array('ok' => 1, 'file' => basename($name)) : array('error' => 'Не удалось создать копию базы');
}

/* ================= САМОДИАГНОСТИКА ================= */

function selftest() {
  $checks = array();
  $add = function ($name, $ok, $info = '') use (&$checks) { $checks[] = array('проверка' => $name, 'ok' => (bool)$ok, 'инфо' => $info); };
  $add('Версия PHP ≥ 7.4', version_compare(PHP_VERSION, '7.4.0', '>='), PHP_VERSION);
  $add('Расширение pdo_sqlite', extension_loaded('pdo_sqlite'));
  $add('Расширение curl', extension_loaded('curl'));
  $add('Расширение mbstring', extension_loaded('mbstring'));
  $dirOk = true; $dirInfo = '';
  try { $dirInfo = data_dir(); } catch (Exception $e) { $dirOk = false; }
  $add('Папка данных доступна на запись', $dirOk && is_writable($dirInfo), $dirInfo);
  $inWeb = (strpos($dirInfo, __DIR__) === 0);
  $add('База вне публичной папки (лучший вариант)', !$inWeb, $inWeb ? 'внутри public_html — закрыта .htaccess, допустимо' : 'отлично');
  $dbOk = true; $usersN = 0;
  try { $usersN = (int)db()->query('SELECT COUNT(*) FROM users')->fetchColumn(); } catch (Exception $e) { $dbOk = false; }
  $add('База открывается, таблицы созданы', $dbOk, 'пользователей: ' . $usersN);
  try { meta_set('selftest', (string)now_ms()); $add('Запись в базу работает', meta_get('selftest') !== null); }
  catch (Exception $e) { $add('Запись в базу работает', false, $e->getMessage()); }
  $add('Хэширование паролей (bcrypt)', is_string(password_hash('test', PASSWORD_DEFAULT)));
  $add('HTTPS включён', (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https'), 'если нет — включите SSL в панели хостинга');
  $add('CRON_KEY задан свой', cron_key_ready(), cron_key_ready() ? 'отлично' : 'впишите в config.php случайную строку от 20 символов — иначе запуск заданий по ссылке закрыт');
  $ws = ws_status_arr();
  $add('Wordstat настроен (можно позже)', $ws['tokenSet'], $ws['tokenSet'] ? ('режим: ' . $ws['mode']) : 'заполните WORDSTAT_MODE и WORDSTAT_TOKEN в config.php');
  $allCritical = true;
  foreach ($checks as $c) { if (!$c['ok'] && strpos($c['проверка'], 'Wordstat') === false && strpos($c['проверка'], 'вне публичной') === false && strpos($c['проверка'], 'HTTPS') === false) $allCritical = false; }
  pj(array('итог' => $allCritical ? 'ВСЁ ГОТОВО К РАБОТЕ ✓' : 'ЕСТЬ ПРОБЛЕМЫ — см. список', 'версия' => PLACE_VERSION, 'проверки' => $checks));
}

/* ================= ДИСПЕТЧЕРИЗАЦИЯ ================= */

/* CLI: php api.php cron-wordstat | cron-backup | selftest */
if (PHP_SAPI === 'cli') {
  $job = isset($argv[1]) ? $argv[1] : '';
  if ($job === 'cron-wordstat') pj(ws_collect());
  if ($job === 'cron-backup')  pj(do_backup());
  if ($job === 'selftest')     selftest();
  pj(array('error' => 'Использование: php api.php cron-wordstat | cron-backup | selftest'), 400);
}

/* Обёртки cron_*.php: define('PLACE_CRON','wordstat'|'backup') до require.
   Из веба (не из CLI) обёртки работают только с верным ?key=CRON_KEY. */
if (defined('PLACE_CRON')) {
  if (PHP_SAPI !== 'cli') {
    if (!cron_key_ok(isset($_GET['key']) ? (string)$_GET['key'] : '')) cron_key_deny();
  }
  if (PLACE_CRON === 'wordstat') pj(ws_collect());
  if (PLACE_CRON === 'backup')  pj(do_backup());
}

/* ---------- Интеграция QTickets → Google Sheets ----------
   Запрос к своему сервису выгрузки. Ключ и адрес лежат в config.php и
   наружу не отдаются: браузер обращается только к api.php. */
function qt_call($path, $post = null, $timeout = 30) {
  if (!defined('QT_URL') || QT_URL === '') {
    perr('Интеграция не настроена: задайте QT_URL в config.php (см. INTEGRATIONS.md).', 400);
  }
  $url = rtrim(QT_URL, '/') . $path;
  $ch = curl_init($url);
  $opts = array(
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => $timeout,
    CURLOPT_HTTPHEADER     => array(
      'Content-Type: application/json',
      'X-Run-Key: ' . (defined('QT_KEY') ? QT_KEY : ''),
    ),
  );
  if ($post !== null) {
    $opts[CURLOPT_POST] = true;
    $opts[CURLOPT_POSTFIELDS] = json_encode($post === array() ? new stdClass() : $post);
  }
  curl_setopt_array($ch, $opts);
  $body = curl_exec($ch);
  $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);
  if ($body === false || $code === 0) perr('Сервис выгрузки недоступен: ' . $err, 502);
  $j = json_decode($body, true);
  if ($code >= 400) {
    $msg = (is_array($j) && isset($j['detail'])) ? $j['detail'] : ('HTTP ' . $code);
    perr('Сервис выгрузки: ' . $msg, 502);
  }
  if (!is_array($j)) perr('Сервис выгрузки вернул некорректный ответ.', 502);
  return $j;
}

/* HTTP */
$action = isset($_GET['action']) ? (string)$_GET['action'] : '';
$in = array();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $raw = file_get_contents('php://input');
  if (strlen($raw) > 64 * 1024 * 1024) perr('Тело запроса слишком большое.', 413);
  $in = json_decode($raw, true);
  if (!is_array($in)) $in = array();
  if (isset($in['action'])) $action = (string)$in['action'];
}

switch ($action) {

  case 'ping': pj(array('ok' => 1, 'app' => 'place', 'version' => PLACE_VERSION));

  case 'selftest': {
    /* Ключ проверяем ПЕРВЫМ: он не трогает базу, поэтому самодиагностика
       остаётся рабочей даже когда база не открывается — ровно тот случай,
       ради которого её и открывают. Вход админом — запасной путь. */
    if (!cron_key_ok(req_key($in))) {
      $u = auth_user(isset($in['token']) ? $in['token'] : '');
      if (!$u || $u['role'] !== 'admin') {
        if (!cron_key_ready()) cron_key_deny();
        perr('Самодиагностика доступна администратору: добавьте к ссылке ?key=КЛЮЧ (это CRON_KEY из config.php) или войдите в кабинет админом.', 403);
      }
    }
    selftest();
  }

  case 'cron': {
    if (!cron_key_ok(req_key($in))) cron_key_deny();
    $job = isset($_GET['job']) ? (string)$_GET['job'] : (isset($in['job']) ? (string)$in['job'] : '');
    if ($job === 'wordstat') pj(ws_collect());
    if ($job === 'backup')  pj(do_backup());
    perr('job должен быть wordstat или backup.', 400);
  }

  case 'login': {
    $login = mb_strtolower(trim((string)(isset($in['login']) ? $in['login'] : '')));
    $pass = (string)(isset($in['pass']) ? $in['pass'] : '');
    if ($login === '' || $pass === '') perr('Введите логин и пароль.');
    rate_check($login);
    $s = db()->prepare('SELECT * FROM users WHERE login=?'); $s->execute(array($login));
    $u = $s->fetch(PDO::FETCH_ASSOC);
    if (!$u || !password_verify($pass, $u['pass_hash'])) { rate_fail($login); perr('Неверный логин или пароль.', 401); }
    rate_ok($login);
    $t = make_session($u['id']);
    pj(bundle($u, $t));
  }

  case 'session': {
    $u = require_auth($in);
    pj(bundle($u, $in['token']));
  }

  case 'logout': {
    if (isset($in['token'])) db()->prepare('DELETE FROM sessions WHERE token=?')->execute(array((string)$in['token']));
    pj(array('ok' => 1));
  }

  case 'save_data': {
    $u = require_auth($in);
    if (!isset($in['data']) || !is_array($in['data'])) perr('Нет данных для сохранения.');
    userdata_set($u['id'], $in['data']);
    pj(array('ok' => 1, 'updated' => now_ms()));
  }

  case 'save_digest': {
    $u = require_admin($in);
    if (!isset($in['digest']) || !is_array($in['digest'])) perr('Нет данных дайджеста.');
    shared_set('digest', $in['digest']);
    pj(array('ok' => 1));
  }

  case 'save_trends': {
    /* Намеренно require_auth, а не require_admin (в отличие от save_digest):
       Отслежиратор — общая доска, её правят все сотрудники. Сюда прилетает
       не только список фраз, но и состояние интерфейса (выбранный период,
       фильтр) — под админом раздел просто перестанет работать у остальных. */
    $u = require_auth($in);
    if (!isset($in['trends']) || !is_array($in['trends'])) perr('Нет данных трендов.');
    shared_set('trends', $in['trends']);
    pj(array('ok' => 1));
  }

  case 'change_pass': {
    $u = require_auth($in);
    $old = (string)(isset($in['old']) ? $in['old'] : '');
    $new = (string)(isset($in['new']) ? $in['new'] : '');
    if (!password_verify($old, $u['pass_hash'])) perr('Текущий пароль неверный.', 403);
    if (mb_strlen($new) < 4) perr('Новый пароль слишком короткий (минимум 4 символа).');
    db()->prepare('UPDATE users SET pass_hash=? WHERE id=?')->execute(array(password_hash($new, PASSWORD_DEFAULT), $u['id']));
    db()->prepare('DELETE FROM sessions WHERE user_id=? AND token<>?')->execute(array($u['id'], (string)$in['token']));
    pj(array('ok' => 1));
  }

  case 'users_list': {
    require_admin($in);
    $rows = db()->query('SELECT u.id,u.login,u.name,u.role,u.created,
        (SELECT MAX(last_seen) FROM sessions s WHERE s.user_id=u.id) AS last_seen,
        (SELECT LENGTH(json) FROM userdata d WHERE d.user_id=u.id) AS bytes
        FROM users u ORDER BY u.created')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) { $r['created'] = (int)$r['created']; $r['last_seen'] = (int)$r['last_seen']; $r['bytes'] = (int)$r['bytes']; }
    unset($r);
    pj(array('ok' => 1, 'users' => $rows));
  }

  case 'user_create': {
    require_admin($in);
    $login = mb_strtolower(trim((string)(isset($in['login']) ? $in['login'] : '')));
    $name = trim((string)(isset($in['name']) ? $in['name'] : ''));
    $pass = (string)(isset($in['pass']) ? $in['pass'] : '');
    $role = ((isset($in['role']) ? $in['role'] : 'user') === 'admin') ? 'admin' : 'user';
    if (!preg_match('/^[a-z0-9._-]{3,32}$/u', $login)) perr('Логин: 3–32 символа, латиница/цифры/точка/дефис/подчёркивание.');
    if (mb_strlen($pass) < 4) perr('Пароль минимум 4 символа.');
    if ($name === '') $name = $login;
    $s = db()->prepare('SELECT 1 FROM users WHERE login=?'); $s->execute(array($login));
    if ($s->fetchColumn()) perr('Такой логин уже существует.');
    db()->prepare('INSERT INTO users(id,login,name,pass_hash,role,created) VALUES(?,?,?,?,?,?)')
      ->execute(array(rnd_id(), $login, $name, password_hash($pass, PASSWORD_DEFAULT), $role, now_ms()));
    pj(array('ok' => 1));
  }

  case 'user_reset_pass': {
    require_admin($in);
    $id = (string)(isset($in['id']) ? $in['id'] : '');
    $new = (string)(isset($in['new']) ? $in['new'] : '');
    if (mb_strlen($new) < 4) perr('Пароль минимум 4 символа.');
    $r = db()->prepare('UPDATE users SET pass_hash=? WHERE id=?');
    $r->execute(array(password_hash($new, PASSWORD_DEFAULT), $id));
    db()->prepare('DELETE FROM sessions WHERE user_id=?')->execute(array($id));
    pj(array('ok' => 1));
  }

  case 'user_set_role': {
    $adm = require_admin($in);
    $id = (string)(isset($in['id']) ? $in['id'] : '');
    $role = ((isset($in['role']) ? $in['role'] : '') === 'admin') ? 'admin' : 'user';
    $s = db()->prepare('SELECT role FROM users WHERE id=?'); $s->execute(array($id));
    $cur = $s->fetchColumn();
    if ($cur === false) perr('Пользователь не найден.', 404);
    if ($cur === 'admin' && $role === 'user') {
      $admins = (int)db()->query("SELECT COUNT(*) FROM users WHERE role='admin'")->fetchColumn();
      if ($admins <= 1) perr('Нельзя снять последнего администратора.');
    }
    db()->prepare('UPDATE users SET role=? WHERE id=?')->execute(array($role, $id));
    pj(array('ok' => 1));
  }

  case 'user_delete': {
    $adm = require_admin($in);
    $id = (string)(isset($in['id']) ? $in['id'] : '');
    if ($id === $adm['id']) perr('Нельзя удалить самого себя.');
    $s = db()->prepare('SELECT role FROM users WHERE id=?'); $s->execute(array($id));
    if ($s->fetchColumn() === 'admin') {
      $admins = (int)db()->query("SELECT COUNT(*) FROM users WHERE role='admin'")->fetchColumn();
      if ($admins <= 1) perr('Нельзя удалить последнего администратора.');
    }
    db()->prepare('DELETE FROM sessions WHERE user_id=?')->execute(array($id));
    db()->prepare('DELETE FROM userdata WHERE user_id=?')->execute(array($id));
    db()->prepare('DELETE FROM users WHERE id=?')->execute(array($id));
    pj(array('ok' => 1));
  }

  case 'ws_sync': {
    require_auth($in);
    $only = isset($in['phrase_id']) ? (string)$in['phrase_id'] : null;
    $res = ws_collect($only);
    if (isset($res['error'])) perr($res['error'], 400);
    pj($res);
  }

  case 'export_all': {
    require_admin($in);
    /* Явный список колонок: pass_hash в выгрузку не попадает. Файл экспорта
       уезжает в почту и облака, хэши паролей там ни к чему. */
    $users = db()->query('SELECT id,login,name,role,created FROM users')->fetchAll(PDO::FETCH_ASSOC);
    $data = db()->query('SELECT * FROM userdata')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($data as &$d) { $d['json'] = json_decode($d['json'], true); }
    unset($d);
    $sh = db()->query('SELECT * FROM shared')->fetchAll(PDO::FETCH_ASSOC);
    foreach ($sh as &$d2) { $d2['json'] = json_decode($d2['json'], true); }
    unset($d2);
    pj(array('ok' => 1, 'exported' => date('c'), 'users' => $users, 'userdata' => $data, 'shared' => $sh));
  }

  case 'qtickets_run': {
    require_auth($in);
    $apply = !isset($in['apply']) || $in['apply'] ? true : false;
    pj(qt_call('/run', array('apply' => $apply), 30));
  }

  case 'qtickets_status': {
    require_auth($in);
    $jid = isset($in['job_id']) ? (string)$in['job_id'] : '';
    if ($jid === '') perr('Не передан job_id', 400);
    pj(qt_call('/status?job_id=' . urlencode($jid), null, 30));
  }

  default:
    perr('Неизвестное действие' . ($action !== '' ? (': ' . $action) : '. Это API Place; интерфейс — index.html.'), 404);
}
