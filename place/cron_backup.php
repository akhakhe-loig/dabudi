<?php
/* PLACE v13 · ежедневная резервная копия базы (хранится 30 шт).
   Запуск из CronTab хостинга:  php  ПУТЬ/public_html/cron_backup.php
   Или по ссылке:  https://ваш-сайт/cron_backup.php?key=ВАШ_CRON_KEY   */
define('PLACE_CRON', 'backup');
require __DIR__ . '/api.php';
