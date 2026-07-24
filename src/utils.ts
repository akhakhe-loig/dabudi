// Русское склонение существительных по числу: [1, 2, 5]
// plural(1, ["урок","урока","уроков"]) -> "урок"
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

export const lessonsWord = (n: number) => plural(n, ["урок", "урока", "уроков"]);
export const studentsWord = (n: number) => plural(n, ["ученик", "ученика", "учеников"]);
