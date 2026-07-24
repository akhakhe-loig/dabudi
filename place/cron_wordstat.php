<?php
/* PLACE v13 · ночной автосбор Wordstat.
   Запуск из CronTab хостинга:  php  ПУТЬ/public_html/cron_wordstat.php
   Или по ссылке:  https://ваш-сайт/cron_wordstat.php?key=ВАШ_CRON_KEY   */
define('PLACE_CRON', 'wordstat');
require __DIR__ . '/api.php';
