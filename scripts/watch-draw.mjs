// เฝ้ารอผลงวดวันนี้: ถ้าวันนี้เป็นวันออกรางวัล อยู่ในช่วงเวลาเฝ้า และยังไม่มีผลของวันนี้
// จะดึงผลซ้ำทุก 5 นาที (node scripts/update-draws.mjs) จนกว่าจะได้ผล หรือหมดเวลาเฝ้า
// ตั้งค่าผ่าน env: WATCH_FROM / WATCH_UNTIL = ชั่วโมงเวลาไทย (ทศนิยมได้ เช่น 21.5), WATCH_DAYS = "0-6" หรือ "1-5"
// เหตุผล: GitHub มักเลื่อน/ข้ามรอบตั้งเวลาช่วงค่ำ — รอบไหนได้รันก่อนผลออก ก็อยู่เฝ้าจนผลออกเอง
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILE = new URL('../data/draws.json', import.meta.url);
const FROM = +(process.env.WATCH_FROM ?? 12), UNTIL = +(process.env.WATCH_UNTIL ?? 22);
const [d0, d1] = String(process.env.WATCH_DAYS || '0-6').split('-').map(Number);
const STEP_MS = +(process.env.WATCH_STEP_MS || 5 * 60e3);
// งานเดียวรันได้ไม่เกิน ~6 ชม. จึงหยุดเองหลัง MAX นาที ให้รอบถัดไปที่รอคิวอยู่เฝ้าต่อ
const STOP_AT = Date.now() + (+(process.env.WATCH_MAX_MIN || 290)) * 60e3;
const bkk = () => new Date(Date.now() + 7 * 3600e3);
const pad = n => String(n).padStart(2, '0');
const todayKey = () => { const t = bkk(); return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}`; };
const hourNow = () => { const t = bkk(); return t.getUTCHours() + t.getUTCMinutes() / 60; };
const have = k => { try { return (JSON.parse(readFileSync(FILE, 'utf8')).draws || []).some(r => r.d === k); } catch { return false; } };

const key = todayKey(), dow = bkk().getUTCDay();
if (dow < d0 || dow > d1) { console.log(`วันนี้ (${key}) ไม่ใช่วันออกรางวัล — ไม่เฝ้า`); process.exit(0); }
if (have(key)) { console.log(`มีผลงวด ${key} แล้ว — ไม่ต้องเฝ้า`); process.exit(0); }
if (hourNow() < FROM || hourNow() >= UNTIL) { console.log(`นอกช่วงเฝ้า (${FROM}–${UNTIL} น.) — ไม่เฝ้า`); process.exit(0); }

console.log(`เริ่มเฝ้าผลงวด ${key} จนถึง ${UNTIL} น. (เช็กทุก 5 นาที)`);
while (hourNow() < UNTIL && Date.now() < STOP_AT) {
  await new Promise(r => setTimeout(r, STEP_MS));
  try { execFileSync('node', [new URL('./update-draws.mjs', import.meta.url).pathname], { stdio: 'inherit' }); }
  catch (e) { console.log('ดึงผลรอบนี้ไม่สำเร็จ จะลองใหม่', e.message); }
  if (have(key)) { console.log(`ได้ผลงวด ${key} แล้ว`); process.exit(0); }
}
console.log(`หยุดเฝ้า (หมดเวลา) ยังไม่ได้ผลงวด ${key} — ให้รอบถัดไปเฝ้าต่อ`);
