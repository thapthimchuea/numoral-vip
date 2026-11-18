// Numoral VIP — ดึงผลหวยลาว VIP งวดใหม่มาเก็บใน data/draws.json
// แหล่งหลัก: raakaadee.com  ·  แหล่งตรวจเทียบ: ตรวจหวย.com (xn--t3cmiit.com)
// กติกา: ถ้าได้ทั้งสองแหล่งและเลขตรงกัน → บันทึก · ถ้าไม่ตรงกัน → ไม่บันทึก (รอรอบหน้า)
//        ถ้ามีแหล่งเดียว → บันทึกเมื่ออีกแหล่งเปิดไม่ได้ หรือเป็นงวดของวันก่อนหน้า (เช้าวันถัดไป)
// ใช้:  node scripts/update-draws.mjs            (ดึงจริง)
//       node scripts/update-draws.mjs --test     (ทดสอบตัวแยกข้อมูลกับตัวอย่างในไฟล์ ไม่ต่อเน็ต)
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../data/draws.json', import.meta.url);
const RAAKAADEE = y => `https://www.raakaadee.com/${encodeURIComponent('หวย')}/${encodeURIComponent('หวยลาว-VIP')}/-${y}/`;
const TRUAD = 'https://xn--t3cmiit.com/lao-lottery/vip/history';
const UA = 'Mozilla/5.0 (compatible; NumoralVIP-bot/1.0; +https://github.com/)';

const M_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const M_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const WD = { 'อา.': 0, 'จ.': 1, 'อ.': 2, 'พ.': 3, 'พฤ.': 4, 'ศ.': 5, 'ส.': 6 };
const pad = n => String(n).padStart(2, '0');
const key = (y, m, d) => `${y}${pad(m + 1)}${pad(d)}`;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// แปลง HTML เป็นข้อความล้วน (ตัดแท็ก/สคริปต์ ถอดรหัส entity พื้นฐาน)
function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\d{1,2}[:.]\d{2}\s*น\./g, ' ')          // เวลา เช่น 21:30 น.
    .replace(/[1-5]\s*ตัว\s*(บน|ล่าง|โต๊ด)?/g, ' ')    // ป้ายกำกับ เช่น 3 ตัวบน / 2 ตัวล่าง
    .replace(/\s+/g, ' ');
}

// หลังวันที่ ตัวเลขที่ตามมาคือ: เลข 5 หลัก, 3 ตัวบน, (2 ตัวบน), 2 ตัวล่าง → ใช้ตรวจตัวเองได้ว่าอ่านถูก
function pickNumber(after, withTop2) {
  const d = (after.slice(0, 60).match(/\d/g) || []).join('');
  const n = d.slice(0, 5);
  if (n.length < 5) return null;
  const rest = d.slice(5);
  const want = withTop2 ? n.slice(-3) + n.slice(-2) + n.slice(1, 3) : n.slice(-3) + n.slice(1, 3);
  return rest.startsWith(want) ? n : null;
}

export function parseRaakaadee(html) {
  const t = toText(html), out = {};
  const re = new RegExp(`(${Object.keys(WD).map(esc).join('|')})\\s*(\\d{1,2})\\s*(${M_SHORT.map(esc).join('|')})\\s*(\\d{2})(?!\\d)`, 'g');
  let m;
  while ((m = re.exec(t))) {
    const y = 2500 + +m[4] - 543, mo = M_SHORT.indexOf(m[3]), d = +m[2];
    const dt = new Date(Date.UTC(y, mo, d));
    if (dt.getUTCDate() !== d || dt.getUTCDay() !== WD[m[1]]) continue; // วันในสัปดาห์ต้องตรงกับวันที่
    const n = pickNumber(t.slice(re.lastIndex), true);
    if (n) out[key(y, mo, d)] = n;
  }
  return out;
}

export function parseTruad(html) {
  const t = toText(html), out = {};
  const re = new RegExp(`(\\d{1,2})\\s*(${M_FULL.map(esc).join('|')})\\s*(25\\d\\d)(?!\\d)`, 'g');
  let m;
  while ((m = re.exec(t))) {
    const y = +m[3] - 543, mo = M_FULL.indexOf(m[2]), d = +m[1];
    const dt = new Date(Date.UTC(y, mo, d));
    if (dt.getUTCDate() !== d) continue;
    const n = pickNumber(t.slice(re.lastIndex), false);
    if (n) out[key(y, mo, d)] = n;
  }
  return out;
}

async function get(url) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'th,en;q=0.8' }, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(tm); }
}

function bangkokToday() {
  const now = new Date(Date.now() + 7 * 3600e3);
  return { key: key(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()), y: now.getUTCFullYear(), m: now.getUTCMonth(), d: now.getUTCDate() };
}
const keyAddDays = (k, n) => { const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(4, 6) - 1, +k.slice(6, 8) + n)); return key(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };

async function main() {
  const db = JSON.parse(readFileSync(FILE, 'utf8'));
  db.draws = Array.isArray(db.draws) ? db.draws : [];
  const known = new Map(db.draws.map(r => [r.d, r.n]));
  const latest = [db.since || '00000000', ...known.keys()].sort().pop();
  const today = bangkokToday();

  // raakaadee: หน้าแรกของปีปัจจุบัน (20 งวดล่าสุด) + ปีก่อนหน้าเมื่อเพิ่งขึ้นปีใหม่
  const errors = [];
  let A = null, B = null;
  try {
    A = {};
    const years = [today.y + 543]; if (today.m === 0 && today.d <= 20) years.push(today.y + 542);
    for (const y of years) Object.assign(A, parseRaakaadee(await get(RAAKAADEE(y))));
    if (!Object.keys(A).length) throw new Error('อ่านตารางไม่ได้ (รูปแบบหน้าเว็บอาจเปลี่ยน)');
  } catch (e) { errors.push('raakaadee: ' + e.message); A = null; }
  try {
    B = parseTruad(await get(TRUAD));
    if (!Object.keys(B).length) throw new Error('อ่านตารางไม่ได้ (รูปแบบหน้าเว็บอาจเปลี่ยน)');
  } catch (e) { errors.push('ตรวจหวย.com: ' + e.message); B = null; }

  const cands = new Set([...Object.keys(A || {}), ...Object.keys(B || {})].filter(k => k > latest && k <= today.key));
  const added = [], skipped = [];
  for (const k of [...cands].sort()) {
    const a = A && A[k], b = B && B[k];
    if (a && b) { a === b ? added.push({ d: k, n: a }) : skipped.push(`${k}: ไม่ตรงกัน (${a} / ${b})`); continue; }
    const one = a || b, otherDown = a ? !B : !A, old = k < today.key; // งวดก่อนวันนี้ (เวลาไทย) บันทึกจากแหล่งเดียวได้ ไม่ต้องรอ 2 วัน
    if (otherDown || old) added.push({ d: k, n: one });
    else skipped.push(`${k}: รออีกแหล่งยืนยัน (${one})`);
  }

  const at = new Date().toISOString();
  db.lastCheck = { at, ok: !!(A || B), sources: { raakaadee: !!A, truad: !!B }, ...(errors.length ? { errors } : {}), ...(skipped.length ? { skipped } : {}) };
  if (added.length) {
    added.forEach(r => known.set(r.d, r.n));
    db.draws = [...known.entries()].map(([d, n]) => ({ d, n })).sort((x, y) => x.d.localeCompare(y.d));
    db.updatedAt = at;
  }
  writeFileSync(FILE, JSON.stringify(db, null, 1) + '\n');
  console.log(`ล่าสุดเดิม ${latest} · เพิ่ม ${added.length} งวด`, added.map(r => `${r.d}=${r.n}`).join(' '));
  skipped.forEach(s => console.log('ข้าม', s));
  errors.forEach(s => console.log('ผิดพลาด', s));
  if (!A && !B) process.exitCode = 1;
}

function selfTest() {
  const rk = `<table><tr><td>ส. 14 พ.ย. 69</td><td><b>33241</b></td><td>241</td><td>41</td><td>32</td></tr>
  <tr><td>ศ. 13 พ.ย. 69</td><td>4 3 4 6 5</td><td>465</td><td>65</td><td>34</td></tr>
  <tr><td>พฤ. 13 พ.ย. 69</td><td>11111</td><td>111</td><td>11</td><td>11</td></tr></table>`;
  const card = `<div>หวยลาว VIP ตรวจผล หวยลาว VIP อ. 10 พ.ย. 69 เวลา 21:30 น. หวยออก 12921 3 ตัวบน 921 2 ตัวบน 21 2 ตัวล่าง 29</div>`;
  const td = `<div>งวด 9 พฤศจิกายน 2569 รางวัลพิเศษ 68973 3 ตัวบน 973 2 ตัวล่าง 89</div><tr><td>งวดวันที่ 12 พฤศจิกายน 2569</td><td>47180</td><td>180</td><td>71</td></tr>
  <tr><td>งวดวันที่ 11 พฤศจิกายน 2569</td><td>52856</td><td>856</td><td>99</td></tr>`;
  const a = parseRaakaadee(rk + card), b = parseTruad(td);
  const ok = a['20261114'] === '33241' && a['20261113'] === '43465' && a['20261110'] === '12921' && Object.keys(a).length === 3 && b['20261112'] === '47180' && b['20261109'] === '68973' && !b['20261111'];
  console.log(ok ? 'ผ่าน' : 'ไม่ผ่าน', a, b);
  if (!ok) process.exitCode = 1;
}

if (process.argv.includes('--test')) selfTest(); else main().catch(e => { console.error(e); process.exitCode = 1; });
