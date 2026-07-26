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

const C = {
  caramel: '#E0A868',
  caramelDk: '#C08347',
  cream: '#F0DCA2',
  muzzle: '#FCF8EE',
  cocoa: '#3A2A1C',
  bead: '#241811',
};

const HEAD = { x: (LEFT_EYE.x + RIGHT_EYE.x) / 2, y: 112, r: 52 };

/**
 * Рука-лозенг: нижний конец в плече, сама уходит вверх и наружу примерно
 * на 45° — та же поза «ура», что на исходной фотографии. Именно от неё
 * отсчитываются углы поз в petRigConfig.ts.
 */
function arm(shoulder, dir) {
  const tip = { x: shoulder.x + dir * -46, y: 74 };
  const cx = (shoulder.x + tip.x) / 2;
  const cy = (shoulder.y + tip.y) / 2;
  const angle = (Math.atan2(tip.x - shoulder.x, shoulder.y - tip.y) * 180) / Math.PI;
  return `<rect x="${cx - 17}" y="${cy - 37}" width="34" height="74" rx="17"
    fill="${C.cream}" transform="rotate(${angle} ${cx} ${cy})"/>`;
}

const ARM_LEFT = arm(LEFT_SHOULDER, 1);
const ARM_RIGHT = arm(RIGHT_SHOULDER, -1);

const SHADOW = `
  <defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="7"/></filter></defs>
  <ellipse cx="143" cy="268" rx="62" ry="13" fill="#3A2A1C" opacity=".28" filter="url(#blur)"/>`;

const BODY = `
  <ellipse cx="143" cy="205" rx="58" ry="62" fill="${C.cream}"/>
  <ellipse cx="${HEAD.x - 47}" cy="118" rx="19" ry="33" fill="${C.caramelDk}"
    transform="rotate(-13 ${HEAD.x - 47} 118)"/>
  <ellipse cx="${HEAD.x + 47}" cy="118" rx="19" ry="33" fill="${C.caramelDk}"
    transform="rotate(13 ${HEAD.x + 47} 118)"/>
  <circle cx="${HEAD.x}" cy="${HEAD.y}" r="${HEAD.r}" fill="${C.caramel}"/>
  <ellipse cx="${HEAD.x - 17}" cy="${HEAD.y - 27}" rx="21" ry="13" fill="#fff" opacity=".22"
    transform="rotate(-18 ${HEAD.x - 17} ${HEAD.y - 27})"/>
  <ellipse cx="${HEAD.x}" cy="136" rx="32" ry="24" fill="${C.muzzle}"/>
  <path d="M${HEAD.x} 118c7.6 0 12.4 3.7 12.4 8.4 0 5.4-6.4 9.8-12.4 9.8s-12.4-4.4-12.4-9.8c0-4.7 4.8-8.4 12.4-8.4z"
    fill="${C.cocoa}"/>
  <path d="M${HEAD.x - 13} 141c3.7 4.7 7.8 7.1 13 7.1s9.3-2.4 13-7.1"
    stroke="${C.cocoa}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".75"/>
  <circle cx="${LEFT_EYE.x}" cy="${LEFT_EYE.y}" r="10.5" fill="${C.bead}"/>
  <circle cx="${RIGHT_EYE.x}" cy="${RIGHT_EYE.y}" r="10.5" fill="${C.bead}"/>
  <circle cx="${LEFT_EYE.x - 3.4}" cy="${LEFT_EYE.y - 3.8}" r="3.9" fill="#fff" opacity=".92"/>
  <circle cx="${RIGHT_EYE.x - 3.4}" cy="${RIGHT_EYE.y - 3.8}" r="3.9" fill="#fff" opacity=".92"/>
  <path d="M112 172h62c0 19-10.5 29-31 29s-31-10-31-29z" fill="#fff"/>
  <circle cx="143" cy="188" r="9" fill="#5B7CFA"/>`;

// Слой закрытых глаз: перекрывает бусины цветом головы и рисует дуги.
const EYES_CLOSED = `
  <circle cx="${LEFT_EYE.x}" cy="${LEFT_EYE.y}" r="13" fill="${C.caramel}"/>
  <circle cx="${RIGHT_EYE.x}" cy="${RIGHT_EYE.y}" r="13" fill="${C.caramel}"/>
  <path d="M${LEFT_EYE.x - 9} ${LEFT_EYE.y - 1}c3.4 5 14.6 5 18 0"
    stroke="${C.bead}" stroke-width="4.4" stroke-linecap="round" fill="none"/>
  <path d="M${RIGHT_EYE.x - 9} ${RIGHT_EYE.y - 1}c3.4 5 14.6 5 18 0"
    stroke="${C.bead}" stroke-width="4.4" stroke-linecap="round" fill="none"/>`;

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
