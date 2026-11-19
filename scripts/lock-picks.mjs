// ล็อกชุดลุ้น 10 / 20 ตัวของงวดถัดไปลง data/picks.json ก่อนเวลาออกรางวัล
// - ใช้สูตรผสมผสานตัวเดียวกับในแอป (ดึงโค้ดคำนวณจาก app.js โดยตรง จึงได้เลขเหมือนในแอปเสมอ)
// - ใช้เฉพาะผลที่ออกแล้ว ณ ตอนล็อก · ล็อกแล้วไม่เขียนทับ · เลยเวลาออกแล้วจะไม่ล็อกย้อนหลัง
// ใช้:  node scripts/lock-picks.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const APP = new URL('app.js', ROOT), DRAWS = new URL('data/draws.json', ROOT), PICKS = new URL('data/picks.json', ROOT);
const LOCK_MARGIN_MIN = 5; // ต้องล็อกก่อนเวลาออกอย่างน้อย 5 นาที

function loadCore() {
  const src = readFileSync(APP, 'utf8');
  const cut = src.indexOf('const Credit =');
  if (cut < 0) throw new Error('ไม่พบจุดตัดใน app.js');
  const React = { useState() {}, useMemo() {}, useEffect() {}, useRef() {}, createElement() {}, createContext: v => ({ v }), useContext() {} };
  const code = src.slice(0, cut) + '\nreturn { BASE_DRAWS, predict, makeDraw, keyOf, keyToDate, DRAW_HOUR, DRAW_MIN };';
  return new Function('React', 'localStorage', 'window', 'navigator', 'document', code)(React, { getItem: () => null, setItem() {} }, {}, {}, {});
}

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const addDays = (k, n) => ymd(new Date(Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8) + n)));

const C = loadCore();
const db = JSON.parse(readFileSync(DRAWS, 'utf8'));
const have = new Set(C.BASE_DRAWS.map(d => C.keyOf(d.date)));
const online = (db.draws || []).filter(r => /^\d{8}$/.test(r.d) && /^\d{5}$/.test(r.n) && !have.has(r.d))
  .map(r => r.b !== undefined ? C.makeDraw(C.keyToDate(r.d), r.n, r.b, 'online') : C.makeDraw(C.keyToDate(r.d), r.n, 'online'));
const draws = [...online, ...C.BASE_DRAWS].sort((a, b) => b.date - a.date);
const latest = C.keyOf(draws[0].date);

const nowMs = Date.now();
const todayBkk = ymd(new Date(nowMs + 7 * 3600e3));
const target = [addDays(latest, 1), todayBkk].sort().pop();
// เวลาออก (เวลาไทย) ของวันเป้าหมาย แปลงเป็นเวลา UTC
const drawMs = Date.UTC(+target.slice(0, 4), +target.slice(4, 6) - 1, +target.slice(6, 8), C.DRAW_HOUR - 7, C.DRAW_MIN);

const pk = existsSync(PICKS) ? JSON.parse(readFileSync(PICKS, 'utf8')) : {};
pk.note = 'ชุดลุ้นที่ล็อกไว้ก่อนผลออก (d = งวดวันที่ ค.ศ., set = 20 ตัวเรียงตามคะแนน 10 ตัวแรกคือชุด 10, at = เวลาที่ล็อก, base = งวดล่าสุดที่ใช้คำนวณ) · ล็อกแล้วไม่แก้ไข';
pk.since = pk.since || target;
pk.picks = Array.isArray(pk.picks) ? pk.picks : [];

if (pk.picks.some(p => p.d === target)) {
  console.log(`งวด ${target} ล็อกไว้แล้ว — ไม่เปลี่ยน`);
} else if (nowMs > drawMs - LOCK_MARGIN_MIN * 60e3) {
  console.log(`งวด ${target} เลยเวลาล็อกแล้ว (ต้องก่อน ${pad(C.DRAW_HOUR)}:${pad(C.DRAW_MIN)} น.) — ไม่ล็อกย้อนหลัง`);
} else {
  const set = C.predict('ensemble', draws, C.keyToDate(target), 20).pairs.map(p => pad(p.n));
  if (set.length !== 20 || new Set(set).size !== 20) throw new Error('ชุดเลขไม่ครบ 20 ตัว');
  pk.picks.push({ d: target, set, at: new Date(nowMs).toISOString(), base: latest });
  pk.picks.sort((a, b) => a.d.localeCompare(b.d));
  writeFileSync(PICKS, JSON.stringify(pk, null, 1) + '\n');
  console.log(`ล็อกงวด ${target}: ชุด 10 = ${set.slice(0, 10).join(' ')} · ชุด 20 เพิ่ม = ${set.slice(10).join(' ')} (ใช้ผลถึง ${latest})`);
}
