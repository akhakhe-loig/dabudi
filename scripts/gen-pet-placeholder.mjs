// Генерирует ВРЕМЕННЫЕ слои питомца в public/pet/.
//
// Это заглушки: векторный щенок, разложенный по слоям ровно в системе
// координат 287×290 и по опорным точкам из petRigConfig.ts. Нужны, чтобы риг
// был рабочим и его можно было увидеть до появления настоящих вырезок.
//
// Когда появятся реальные PNG (вырезанные из фотографии), просто положите их
// поверх этих файлов — координаты плеч и глаз совпадают, риг не поедет.
// Точную подгонку углов делайте ползунками в PetDemo.
//
// Запуск: npm run gen:pet
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PKG || 'playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'public', 'pet');
mkdirSync(outDir, { recursive: true });

const W = 287;
const H = 290;

// Опорные точки — должны совпадать с SOURCE в petRigConfig.ts.
const LEFT_SHOULDER = { x: 88, y: 121 };
const RIGHT_SHOULDER = { x: 191, y: 121 };
const LEFT_EYE = { x: 109, y: 103 };
const RIGHT_EYE = { x: 154, y: 104 };

// Палитра снята с фотографий игрушки: тёплый абрикосовый мех, кремовый
// комбинезон, тёмно-коричневые глаза и нос, белое кружево.
const C = {
  fur: '#EFC182',
  furDk: '#DCA463',
  furLt: '#F6D5A2',
  cream: '#F1EDBE',
  creamDk: '#E4DEA6',
  nose: '#5C3520',
  eye: '#452812',
  lace: '#FFFFFF',
};

const HEAD = { x: (LEFT_EYE.x + RIGHT_EYE.x) / 2 + 1.5, y: 94, r: 48 };

/**
 * Лапа: нижний конец в плече, сама уходит вверх и наружу — поза «ура»
 * с первой фотографии. Именно от неё отсчитываются углы поз в
 * petRigConfig.ts, поэтому трогать её положение без пересчёта углов нельзя.
 */
function arm(shoulder, dir) {
  const tip = { x: shoulder.x + dir * -30, y: 60 };
  const cx = (shoulder.x + tip.x) / 2;
  const cy = (shoulder.y + tip.y) / 2;
  const angle = (Math.atan2(tip.x - shoulder.x, shoulder.y - tip.y) * 180) / Math.PI;
  const h = Math.hypot(tip.x - shoulder.x, tip.y - shoulder.y) + 26;
  return `<rect x="${cx - 13}" y="${cy - h / 2}" width="26" height="${h}" rx="13"
    fill="${C.fur}" transform="rotate(${angle} ${cx} ${cy})"/>`;
}

const ARM_LEFT = arm(LEFT_SHOULDER, 1);
const ARM_RIGHT = arm(RIGHT_SHOULDER, -1);

const SHADOW = `
  <defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="6"/></filter></defs>
  <ellipse cx="143" cy="276" rx="56" ry="11" fill="#5C3520" opacity=".26" filter="url(#blur)"/>`;

/** Кружевной воротник: белая манишка с фестонами по нижнему краю. */
const collar = () => {
  const bumps = [];
  for (let i = 0; i <= 8; i += 1) {
    const t = i / 8;
    const x = 104 + t * 58;
    const y = 165 + Math.sin(t * Math.PI) * 7;
    bumps.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.6" fill="${C.lace}"/>`);
  }
  return `<ellipse cx="133" cy="158" rx="33" ry="12.5" fill="${C.lace}"/>${bumps.join('')}`;
};

const BODY = `
  <!-- лапки -->
  <ellipse cx="121" cy="264" rx="19" ry="14" fill="${C.fur}"/>
  <ellipse cx="165" cy="264" rx="19" ry="14" fill="${C.fur}"/>
  <!-- туловище в кремовом комбинезоне -->
  <ellipse cx="143" cy="206" rx="54" ry="61" fill="${C.cream}"/>
  <ellipse cx="120" cy="190" rx="24" ry="28" fill="#fff" opacity=".18"/>
  <!-- висячие уши: рисуются до головы, чтобы их верх ушёл под неё -->
  <ellipse cx="98" cy="110" rx="20" ry="42" fill="${C.furDk}"
    transform="rotate(-9 98 110)"/>
  <ellipse cx="${HEAD.x * 2 - 98}" cy="110" rx="20" ry="42" fill="${C.furDk}"
    transform="rotate(9 ${HEAD.x * 2 - 98} 110)"/>
  <!-- голова -->
  <circle cx="${HEAD.x}" cy="${HEAD.y}" r="${HEAD.r}" fill="${C.fur}"/>
  <ellipse cx="${HEAD.x - 16}" cy="${HEAD.y - 26}" rx="20" ry="12" fill="${C.furLt}" opacity=".75"
    transform="rotate(-18 ${HEAD.x - 16} ${HEAD.y - 26})"/>
  <!-- морда: у игрушки она чуть светлее меха, без резкого белого пятна -->
  <ellipse cx="${HEAD.x - 1.5}" cy="124" rx="27" ry="20" fill="${C.furLt}" opacity=".85"/>
  <!-- глаза: тёмно-коричневые, с бликом слева сверху -->
  <circle cx="${LEFT_EYE.x}" cy="${LEFT_EYE.y}" r="11.5" fill="${C.eye}"/>
  <circle cx="${RIGHT_EYE.x}" cy="${RIGHT_EYE.y}" r="11.5" fill="${C.eye}"/>
  <circle cx="${LEFT_EYE.x - 3.6}" cy="${LEFT_EYE.y - 4.2}" r="3.6" fill="#fff" opacity=".95"/>
  <circle cx="${RIGHT_EYE.x - 3.6}" cy="${RIGHT_EYE.y - 4.2}" r="3.6" fill="#fff" opacity=".95"/>
  <!-- нос и рот -->
  <path d="M${HEAD.x - 1.5} 116c6.4 0 10.4 3 10.4 6.9 0 4.5-5.4 8.1-10.4 8.1s-10.4-3.6-10.4-8.1c0-3.9 4-6.9 10.4-6.9z"
    fill="${C.nose}"/>
  <path d="M${HEAD.x - 13} 134c3.5 4 7.3 6 11.5 6s8-2 11.5-6"
    stroke="${C.nose}" stroke-width="3.4" stroke-linecap="round" fill="none" opacity=".8"/>
  ${collar()}`;

// Слой закрытых глаз: перекрывает глаза цветом меха и рисует дуги.
const EYES_CLOSED = `
  <circle cx="${LEFT_EYE.x}" cy="${LEFT_EYE.y}" r="13.5" fill="${C.fur}"/>
  <circle cx="${RIGHT_EYE.x}" cy="${RIGHT_EYE.y}" r="13.5" fill="${C.fur}"/>
  <path d="M${LEFT_EYE.x - 9.5} ${LEFT_EYE.y - 1.5}c3.6 5.4 15.4 5.4 19 0"
    stroke="${C.eye}" stroke-width="4" stroke-linecap="round" fill="none"/>
  <path d="M${RIGHT_EYE.x - 9.5} ${RIGHT_EYE.y - 1.5}c3.6 5.4 15.4 5.4 19 0"
    stroke="${C.eye}" stroke-width="4" stroke-linecap="round" fill="none"/>`;

const layers = [
  { file: 'shadow.png', content: SHADOW },
  { file: 'arm-left.png', content: ARM_LEFT },
  { file: 'arm-right.png', content: ARM_RIGHT },
  { file: 'body.png', content: BODY },
  { file: 'eyes-closed.png', content: EYES_CLOSED },
  { file: 'source.png', content: SHADOW + ARM_LEFT + BODY + ARM_RIGHT },
];

// PW_CHROMIUM позволяет указать путь к уже установленному Chromium,
// когда playwright стоит без своих браузеров (CI, песочницы).
const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
try {
  for (const { file, content } of layers) {
    const page = await browser.newPage({
      viewport: { width: W, height: H },
      deviceScaleFactor: 2,
    });
    await page.setContent(
      `<!doctype html><html><head><style>
        html,body{margin:0;padding:0;background:transparent}
        svg{display:block}
      </style></head><body>
      <svg id="s" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
           viewBox="0 0 ${W} ${H}">${content}</svg>
      </body></html>`,
      { waitUntil: 'load' },
    );
    const el = await page.$('#s');
    await el.screenshot({ path: path.join(outDir, file), omitBackground: true });
    await page.close();
    console.log('wrote', path.join('public', 'pet', file));
  }
} finally {
  await browser.close();
}
