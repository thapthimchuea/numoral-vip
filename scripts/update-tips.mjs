// ดึง "เลขเด็ดสำนักดัง" ของงวดวันนี้/พรุ่งนี้ มาเก็บใน data/tips.json (เก็บเฉพาะเลข ชื่อสำนัก และลิงก์ต้นทาง ไม่เก็บเนื้อหาบทความ)
// แหล่ง: บ้านกีฬา (bankeela.info — รวมโพยสำนักดังรายวัน) และ Thaiger (หวยลาว: ชุดเลขจากสถิติ/ตำรานามสัตว์)
// เพื่อความยุติธรรม: เพิ่มเลขของงวดไหนได้เฉพาะ "ก่อนเวลาออกรางวัล" ของงวดนั้นเท่านั้น (หลังผลออกจะไม่แตะงวดนั้นอีก)
// ใช้: node scripts/update-tips.mjs [--lotto=hanoi|laos] [--probe] [--test]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1];
const LOTTO = arg('lotto') || process.env.TIPS_LOTTO || 'hanoi';
const PROBE = process.argv.includes('--probe');
const FILE = new URL('../data/tips.json', import.meta.url);
const CFG = {
  hanoi: { name: 'หวยฮานอยปกติ', drawH: 18, drawM: 30, days: [0, 1, 2, 3, 4, 5, 6], title: /แนวทางหวยฮานอย/, notTitle: /พิเศษ|vip|วีไอพี|เฉพาะกิจ|สตาร์|กาชาด|ฮานอยทีวี/i },
  laos: { name: 'หวยลาวพัฒนา', drawH: 20, drawM: 0, days: [1, 2, 3, 4, 5], title: /หวยลาว/, notTitle: /vip|วีไอพี|สตาร์|กาชาด|สามัคคี|ประตูชัย|ลาว\s*hd|ลาวทีวี|ลาวเที่ยง|ลาวใต้|ลาวสันติภาพ|ลาวเอ็กซ์ตร้า/i },
}[LOTTO];
const MARGIN_MIN = 5;
const UA = 'Mozilla/5.0 (compatible; NumoralTipsBot/1.0)';
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pad = n => String(n).padStart(2, '0');
const decode = s => s.replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;|&#8217;/g, "'").replace(/&#821[12];|&ndash;|&mdash;/g, '–').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const toY = y => { y = +y; if (y < 100) y += 2500; return y > 2400 ? y - 543 : y; };

// วันที่งวดจากหัวข้อ: "26 พฤศจิกายน 2569" / "26 พ.ย. 69" / "26/11/69"
export function keyFromTitle(t) {
  let m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${toY(m[3])}${pad(m[2])}${pad(m[1])}`;
  for (const [list, re] of [[TH_MONTHS, TH_MONTHS.join('|')], [TH_MON_S, TH_MON_S.map(s => s.replace(/\./g, '\\.')).join('|')]]) {
    m = t.match(new RegExp(`(\\d{1,2})\\s*(${re})\\s*(\\d{2,4})`));
    if (m) return `${toY(m[3])}${pad(list.indexOf(m[2]) + 1)}${pad(m[1])}`;
  }
  return null;
}
const numLine = s => /^(\d{2,3}(\s*[–\-,/]\s*|\s+|$)){2,}$/.test(s) ? s.match(/\d{2,3}/g) : null;

// บ้านกีฬา: แต่ละสำนักอยู่ใต้หัวข้อ h2 (เช่น "แม่นิราศินี งวด 26/11/69 ...") ตามด้วยบรรทัดเลข
export function parseBankeela(html) {
  const entries = new Map();
  let sec = null, stop = false;
  for (const m of html.matchAll(/<(h[1-4]|p|li|td)[^>]*>([\s\S]*?)<\/\1>/g)) {
    if (stop) break;
    const tag = m[1], s = text(m[2]);
    if (tag === 'h1') continue;
    if (tag === 'h4') { if (sec) stop = true; continue; }          // เข้าส่วนแถบข้าง/ข่าวอื่น
    if (tag === 'h2') {
      if (!/^AI/i.test(s) && /บทสรุป|สรุปโพย|สรุปเลข|วิเคราะห์เลขชน|สถิติ|ผลหวย|ย้อนหลัง|คำเตือน/.test(s)) { sec = { skip: true }; continue; }
      let name = s.split(/\s+งวด|\s+\d{1,2}\/\d{1,2}|\s+เด่น|\s+วิเคราะห์|\s+เปิด|\s+พร้อม/)[0].trim();
      if (/^AI/i.test(name)) name = 'AI บ้านกีฬา';
      if (!name || name.length > 40 || /แนวทาง|เลขเด็ด|หวย|บ้านกีฬา|เลขสองตัว|เลขสามตัว/.test(name)) name = /^AI/i.test(name) ? name : 'บ้านกีฬา';
      sec = { name, skip: false };
      continue;
    }
    if (tag === 'h3') { if (sec && /สลับ|กลับ|เด่นที่สุด|รองน่าเก็บ|รวม/.test(s)) sec = { ...sec, sub: 'skip' }; else if (sec) sec = { ...sec, sub: null }; continue; }
    if (!sec || sec.skip || sec.sub === 'skip') continue;
    const nums = numLine(s);
    if (!nums) continue;
    const e = entries.get(sec.name) || { name: sec.name, nums: [], nums3: [] };
    nums.forEach(x => { const arr = x.length === 2 ? e.nums : e.nums3; if (!arr.includes(+x)) arr.push(+x); });
    entries.set(sec.name, e);
  }
  return [...entries.values()].filter(e => e.nums.length || e.nums3.length);
}
// Thaiger (หวยลาว): "ชุดเลข 2 ตัวน่าสนใจ: 62 – 26 ..." / "ชุดเลขท้าย 2 ตัว: 92 – 34 ..." (นามสัตว์)
export function parseThaiger(html) {
  const t = text(html);
  const grab = re => { const m = t.match(re); return m ? (m[1].match(/\d{2,3}/g) || []) : []; };
  const stat2 = grab(/ชุดเลข 2 ตัวน่าสนใจ\s*:?\s*([\d\s–\-,]+)/), stat3 = grab(/ชุดเลข 3 ตัวแรง\s*:?\s*([\d\s–\-,]+)/);
  const ani2 = grab(/ชุดเลขท้าย 2 ตัว\s*:?\s*([\d\s–\-,]+)/), ani3 = grab(/ชุดเลขท้าย 3 ตัว\s*:?\s*([\d\s–\-,]+)/);
  const out = [];
  const mk = (name, a2, a3) => { const nums = [...new Set(a2.filter(x => x.length === 2).map(Number))], nums3 = [...new Set(a3.filter(x => x.length === 3).map(Number))]; if (nums.length || nums3.length) out.push({ name, nums, nums3 }); };
  mk('Thaiger สถิติ', stat2, stat3);
  mk('Thaiger นามสัตว์', ani2, ani3);
  return out;
}

async function get(url) {
  const u = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'th,en;q=0.8', 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
const bkkNow = () => new Date(Date.now() + 7 * 3600e3);
// งวดที่ยังรับเลขเด็ดได้: วันนี้ (ถ้ายังไม่ถึงเวลาออก) และพรุ่งนี้
function openKeys() {
  const out = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(bkkNow().getTime() + i * 86400e3);
    if (!CFG.days.includes(d.getUTCDay())) continue;
    const k = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
    const cutoff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), CFG.drawH - 7, CFG.drawM) - MARGIN_MIN * 60e3;
    if (Date.now() < cutoff) out.push(k);
  }
  return out;
}

async function main() {
  const db = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
  db.note = `เลขเด็ดสำนักดังของ${CFG.name} เก็บเฉพาะเลข ชื่อสำนัก และลิงก์ต้นทาง · บันทึกได้เฉพาะก่อนเวลาออกรางวัลของงวดนั้น · เพื่อทดสอบความแม่นยำ ไม่ใช่คำแนะนำ`;
  db.source = 'https://www.bankeela.info/category/lotto/' + (LOTTO === 'laos' ? ' · https://thethaiger.com/th/' : '');
  db.draws = db.draws || {};
  const open = openKeys();
  console.log('งวดที่ยังรับเลขเด็ดได้:', open.join(', ') || '-');
  if (!open.length) return;
  const found = {}; // key -> {urls:Set, entries:Map}
  const add = (k, url, title, entries) => {
    if (!open.includes(k) || !entries.length) return;
    const f = found[k] || (found[k] = { urls: [], titles: [], entries: new Map() });
    if (!f.urls.includes(url)) { f.urls.push(url); f.titles.push(title); }
    entries.forEach(e => { const o = f.entries.get(e.name) || { name: e.name, nums: [], nums3: [] }; e.nums.forEach(n => o.nums.includes(n) || o.nums.push(n)); e.nums3.forEach(n => o.nums3.includes(n) || o.nums3.push(n)); f.entries.set(e.name, o); });
  };
  // 1) บ้านกีฬา
  try {
    const cat = await get('https://www.bankeela.info/category/lotto/');
    const links = new Map();
    for (const m of cat.matchAll(/<a[^>]+href="(https:\/\/www\.bankeela\.info\/lotto\/\d+\/?)"[^>]*>([\s\S]*?)<\/a>/g)) { const t = text(m[2]); if (t && CFG.title.test(t) && !CFG.notTitle.test(t)) links.set(m[1], t); }
    for (const [url, title] of links) {
      const k = keyFromTitle(title);
      if (!k || !open.includes(k)) continue;
      try { add(k, url, title, parseBankeela(await get(url))); } catch (e) { console.log('บ้านกีฬา', url, e.message); }
    }
  } catch (e) { console.log('บ้านกีฬา: ', e.message); }
  // 2) Thaiger (เฉพาะหวยลาว)
  if (LOTTO === 'laos') {
    try {
      const s = await get('https://thethaiger.com/th/?s=' + encodeURIComponent('หวยลาว เลขนามสัตว์'));
      for (const m of [...s.matchAll(/<h[23][^>]*>\s*<a href="(https:\/\/thethaiger\.com\/th\/news\/\d+\/?)"[^>]*>([^<]*)<\/a>/g)].slice(0, 6)) {
        const title = decode(m[2]).trim(), k = keyFromTitle(title);
        if (!k || !open.includes(k) || CFG.notTitle.test(title)) continue;
        try { add(k, m[1], title, parseThaiger(await get(m[1]))); } catch (e) { console.log('Thaiger', m[1], e.message); }
      }
    } catch (e) { console.log('Thaiger: ', e.message); }
  }
  let changed = false;
  for (const [k, f] of Object.entries(found)) {
    const cur = db.draws[k] || { top: [], entries: [] };
    const merged = new Map((cur.entries || []).map(e => [e.name, { ...e, nums: [...(e.nums || [])], nums3: [...(e.nums3 || [])] }]));
    f.entries.forEach(e => { const o = merged.get(e.name) || { name: e.name, nums: [], nums3: [] }; e.nums.forEach(n => o.nums.includes(n) || o.nums.push(n)); e.nums3.forEach(n => o.nums3.includes(n) || o.nums3.push(n)); merged.set(e.name, o); });
    const next = { url: (cur.url || f.urls[0]), urls: [...new Set([...(cur.urls || []), ...f.urls])], title: cur.title || f.titles[0], top: [], entries: [...merged.values()].map(e => ({ name: e.name, nums: e.nums, ...(e.nums3.length ? { nums3: e.nums3 } : {}) })), fetchedAt: cur.fetchedAt || new Date().toISOString() };
    if (JSON.stringify({ ...next, fetchedAt: 0 }) !== JSON.stringify({ ...cur, fetchedAt: 0 })) { next.updatedAt = new Date().toISOString(); db.draws[k] = next; changed = true; }
    console.log(`งวด ${k}:`, next.entries.map(e => `${e.name} [${e.nums.join(' ')}${e.nums3 ? ' | ' + e.nums3.join(' ') : ''}]`).join(' · '));
  }
  if (PROBE) return;
  if (changed) { db.updatedAt = new Date().toISOString(); writeFileSync(FILE, JSON.stringify(db, null, 1) + '\n'); console.log('บันทึก tips.json แล้ว'); }
  else console.log('ไม่มีเลขเด็ดใหม่');
}

function selfTest() {
  const bk = `<h1>แนวทางหวยฮานอย 26 พฤศจิกายน 2569 เจาะเลขชน</h1><h2>แม่นิราศินี งวด 26/11/69 เด่น 4 รอง 2</h2><h3>เลขสองตัว</h3><p>45 44 49 46 43</p><p>25 – 21 – 20</p><h3>ตัวเด่นน่าตาม</h3><p>เลข 4 เด่น 12 ครั้ง</p>
  <h2>อาจารย์ศรราม งวด 26/11/69</h2><h3>เลขสามตัว</h3><p>937 534 421</p><h2>AI บ้านกีฬา วิเคราะห์เลขชน 26/11/69</h2><h3>เลขจาก AI บ้านกีฬา</h3><p>24 21 20</p>
  <h2>สรุปโพยรวม 3 สำนัก</h2><h3>เลขสองตัวเด่นที่สุด</h3><p>99 98 97</p><h4>ข่าวอื่น</h4><p>11 22 33</p>`;
  const e = parseBankeela(bk);
  const th = parseThaiger('<p>ชุดเลข 2 ตัวน่าสนใจ: 62 – 26 – 60</p><p>ชุดเลข 3 ตัวแรง: 062 – 826</p><p>ชุดเลขท้าย 2 ตัว: 92 – 34</p><p>ชุดเลขท้าย 3 ตัว: 492 – 934</p>');
  const ok = e.length === 3 && e[0].name === 'แม่นิราศินี' && e[0].nums.join() === '45,44,49,46,43,25,21,20' && e[1].nums3.join() === '937,534,421' && e[2].name === 'AI บ้านกีฬา' && e[2].nums.join() === '24,21,20'
    && keyFromTitle('แนวทางหวยฮานอย 26 พฤศจิกายน 2569 เจาะ') === '20261126' && keyFromTitle('หวยลาววันนี้ งวด 24/11/69 เช็ก') === '20261124' && keyFromTitle('หวยลาว 25 พ.ย. 69') === '20261125'
    && th.length === 2 && th[0].nums.join() === '62,26,60' && th[0].nums3.join() === '62,826' /* 062 เก็บเป็นตัวเลข 62 */ && th[1].nums.join() === '92,34';
  console.log(ok ? 'ผ่าน' : 'ไม่ผ่าน', JSON.stringify(e), JSON.stringify(th));
  if (!ok) process.exitCode = 1;
}

if (process.argv.includes('--test')) selfTest(); else main().catch(e => { console.error(e); process.exitCode = 1; });
