// Numoral Laos — ดึงผลหวยลาวพัฒนา (สลากพัฒนา สปป.ลาว) งวดใหม่มาเก็บใน data/draws.json
// แหล่ง A: ข่าวสด (khaosod.co.th/laolottery) — มีเลข 6 ตัว และเลขท้าย 4 ตัว
// แหล่ง B: ผลหวย.com (xn--t3cmiit.com/lao-lottery/history) — มีเลขท้าย 4 ตัว
// กติกา: เทียบเลขท้าย 4 ตัว ถ้าทั้งสองแหล่งมีและตรงกัน → บันทึก (ใช้เลข 6 ตัวถ้ามี) · ไม่ตรงกัน → ไม่บันทึก
//        ถ้ามีแหล่งเดียว → บันทึกเมื่ออีกแหล่งเปิดไม่ได้ หรือเป็นงวดของวันก่อนหน้า (รอบเช้าวันถัดไป)
// รูปแบบที่เก็บ: { d: "YYYYMMDD", n: "เลข 6 ตัว" หรือ "เลขท้าย 4 ตัว" ถ้าไม่รู้ 2 หลักแรก }
// ใช้:  node scripts/update-draws.mjs          (ดึงจริง)
//       node scripts/update-draws.mjs --test   (ทดสอบตัวแยกข้อมูลกับตัวอย่างในไฟล์ ไม่ต่อเน็ต)
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = new URL('../data/draws.json', import.meta.url);
const KHAOSOD = 'https://www.khaosod.co.th/laolottery';
const TRUAD = 'https://xn--t3cmiit.com/lao-lottery/history';
const UA = 'Mozilla/5.0 (compatible; NumoralLaos-bot/1.0; +https://github.com/)';
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const pad = n => String(n).padStart(2, '0');
const key = (y, m, d) => `${y}${pad(m + 1)}${pad(d)}`;
const plain = h => h.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ');

// ข่าวสด: หน้ารวมมีลิงก์บทความ "หวยลาววันนี้ งวดประจำวันที่ 19 พฤศจิกายน 2569 ..."
export function parseKhaosodIndex(html) {
  const out = {};
  for (const m of html.matchAll(/href="([^"]*\/news_\d+)"[^>]*>([\s\S]{0,400}?)<\/a>/g)) {
    const t = plain(m[2]);
    const d = t.match(/งวดประจำวันที่\s*(\d{1,2})\s+(\S+)\s+(25\d\d)/);
    if (!d) continue;
    const mo = TH_MONTHS.indexOf(d[2]);
    if (mo < 0) continue;
    const k = key(+d[3] - 543, mo, +d[1]);
    if (!out[k]) out[k] = [];
    const u = m[1].startsWith('http') ? m[1] : 'https://www.khaosod.co.th' + m[1];
    if (!out[k].includes(u)) out[k].push(u);
  }
  return out;
}
// บทความ: "รางวัลเลข 6 ตัว: 928727" และ "รางวัลเลขท้าย 4 ตัว: 8727" (ก่อนผลออกจะเป็น XXXXXX → ไม่นับ)
export function parseKhaosodArticle(html) {
  const t = plain(html);
  const six = (t.match(/รางวัลเลข 6 ตัว\s*:?\s*(\d{6})(?!\d)/) || [])[1];
  const four = (t.match(/เลขท้าย 4 ตัว\s*:?\s*(\d{4})(?!\d)/) || [])[1];
  if (six && four && six.slice(2) !== four) return null; // ในบทความเองยังไม่ตรงกัน → ไม่เชื่อ
  if (six) return { n: six, four: six.slice(2) };
  if (four) return { n: four, four };
  return null;
}
// ผลหวย.com: ลิงก์ /results/lao-lottery/2026-11-19 ที่มีข้อความ "เลขท้าย 4 ตัว 8727"
export function parseTruad(html) {
  const out = {};
  for (const m of html.matchAll(/href="(?:https:\/\/xn--t3cmiit\.com)?\/results\/lao-lottery\/(\d{4})-(\d{2})-(\d{2})"[^>]*>([\s\S]*?)<\/a>/g)) {
    const n = plain(m[4]).match(/เลขท้าย 4 ตัว\s*((?:\d\s*){4})/);
    if (n) out[m[1] + m[2] + m[3]] = { n: n[1].replace(/\s/g, ''), four: n[1].replace(/\s/g, '') };
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
  return key(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

async function main() {
  const db = JSON.parse(readFileSync(FILE, 'utf8'));
  db.draws = Array.isArray(db.draws) ? db.draws : [];
  const known = new Map(db.draws.map(r => [r.d, r]));
  const latest = [db.since || '00000000', ...known.keys()].sort().pop();
  const today = bangkokToday();
  const errors = [];

  let A = null, B = null;
  try {
    const idx = parseKhaosodIndex(await get(KHAOSOD));
    if (!Object.keys(idx).length) throw new Error('อ่านหน้ารวมไม่ได้ (รูปแบบหน้าเว็บอาจเปลี่ยน)');
    A = {};
    for (const k of Object.keys(idx).filter(k => k > latest && k <= today).sort()) {
      for (const u of idx[k]) {
        try { const r = parseKhaosodArticle(await get(u)); if (r) { A[k] = r; break; } } catch (e) { errors.push(`khaosod ${k}: ${e.message}`); }
      }
    }
  } catch (e) { errors.push('khaosod: ' + e.message); A = null; }
  try {
    B = parseTruad(await get(TRUAD));
    if (!Object.keys(B).length) throw new Error('อ่านตารางไม่ได้ (รูปแบบหน้าเว็บอาจเปลี่ยน)');
  } catch (e) { errors.push('ผลหวย.com: ' + e.message); B = null; }

  const cands = new Set([...Object.keys(A || {}), ...Object.keys(B || {})].filter(k => k > latest && k <= today));
  const added = [], skipped = [];
  for (const k of [...cands].sort()) {
    const a = A && A[k], b = B && B[k];
    if (a && b) {
      if (a.four === b.four) added.push({ d: k, n: a.n.length === 6 ? a.n : b.n });
      else skipped.push(`${k}: ไม่ตรงกัน (${a.n} กับ ${b.n})`);
      continue;
    }
    const one = a || b, otherDown = a ? !B : !A, old = k < today;
    if (otherDown || old) added.push({ d: k, n: one.n });
    else skipped.push(`${k}: รออีกแหล่งยืนยัน (${one.n})`);
  }

  const at = new Date().toISOString();
  db.lastCheck = { at, ok: !!(A || B), sources: { khaosod: !!A, truad: !!B }, ...(errors.length ? { errors } : {}), ...(skipped.length ? { skipped } : {}) };
  if (added.length) {
    added.forEach(r => known.set(r.d, r));
    db.draws = [...known.values()].sort((x, y) => x.d.localeCompare(y.d));
    db.updatedAt = at;
  }
  writeFileSync(FILE, JSON.stringify(db, null, 1) + '\n');
  console.log(`ล่าสุดเดิม ${latest} · เพิ่ม ${added.length} งวด`, added.map(r => `${r.d}=${r.n}`).join(' '));
  skipped.forEach(s => console.log('ข้าม', s));
  errors.forEach(s => console.log('ผิดพลาด', s));
  if (!A && !B) process.exitCode = 1;
}

function selfTest() {
  const idx = `<a href="https://www.khaosod.co.th/laolottery/news_10477681"><h3>หวยลาววันนี้ งวดประจำวันที่ 19 พฤศจิกายน 2569 ผลหวยพัฒนา</h3></a>
  <a href="/update-news/news_1"><span>หวยลาววันนี้</span> งวดประจำวันที่ 2 กุมภาพันธ์ 2569</a><a href="/x/news_2">ข่าวอื่น</a>`;
  const art = `<p>รางวัลเลข 6 ตัว: 928727</p><p>รางวัลเลข 5 ตัว: 28727</p><p>รางวัลเลขท้าย 4 ตัว: 8727</p>`;
  const artBefore = `<p>รางวัลเลข 6 ตัว: XXXXXX</p><p>รางวัลเลขท้าย 4 ตัว: XXXX</p>`;
  const tr = `<a href="/results/lao-lottery/2026-11-19"><div>งวดวันที่ 19 พฤศจิกายน 2569</div><p>เลขท้าย 4 ตัว</p><p>8727</p></a>
  <a href="https://xn--t3cmiit.com/results/lao-lottery/2024-01-08">งวดวันที่ 8 มกราคม 2567</a>`;
  const i = parseKhaosodIndex(idx), a = parseKhaosodArticle(art), b = parseKhaosodArticle(artBefore), t = parseTruad(tr);
  const ok = i['20261119'] && i['20261119'][0].endsWith('news_10477681') && i['20260202'] && Object.keys(i).length === 2
    && a && a.n === '928727' && a.four === '8727' && b === null && t['20261119'] && t['20261119'].four === '8727' && Object.keys(t).length === 1;
  console.log(ok ? 'ผ่าน' : 'ไม่ผ่าน', i, a, b, t);
  if (!ok) process.exitCode = 1;
}

if (process.argv.includes('--test')) selfTest(); else main().catch(e => { console.error(e); process.exitCode = 1; });
