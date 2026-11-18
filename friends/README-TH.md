# Numoral VIP สำหรับเพื่อน (ต้องใช้รหัสเชิญ)

ลิงก์นี้แยกจากลิงก์หลัก (`thapthimchuea.github.io/numoral-vip`) และแยกจากลิงก์เพื่อนของ Numora
ผลหวยลาว VIP ดึงต่อจากลิงก์หลักแบบสด ผลงวดใหม่จึงเข้าทั้งสองลิงก์พร้อมกัน

## โครงสร้าง
- `src/worker.js` — ตัวตรวจรหัสเชิญ + หน้าใส่รหัส + หน้าจัดการ `/admin` + ส่งต่อข้อมูล `/data/*`
- `wrangler.toml` — ตั้งค่า Cloudflare (ชื่อ `numoral-vip-friends`, KV `CODES`)
- `deploy.mjs` — คัดลอกไฟล์แอปจากโฟลเดอร์แม่ไป `public/` แล้ว deploy
- รหัสเชิญขึ้นต้นด้วย `VIP-` (ของ Numora ขึ้นต้นด้วย `NUM-`) ใช้ข้ามกันไม่ได้

## ตั้งค่าครั้งแรก (ทำครั้งเดียว)
เปิด Command Prompt แล้วเข้าโฟลเดอร์นี้:

```
cd C:\numoral-vip\friends
npx wrangler login
npx wrangler kv namespace create CODES
```

1. คำสั่งสุดท้ายจะแสดง `id = "..."` ให้คัดลอกค่า id ไปใส่แทน `ใส่-ID-ของ-KV-ตรงนี้` ใน `wrangler.toml`
2. ตั้งค่าลับ 2 ตัว (ระบบจะให้พิมพ์ค่า):
   ```
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put SESSION_SECRET
   ```
   - `ADMIN_PASSWORD` — รหัสเข้าหน้า `/admin` (ตั้งเอง)
   - `SESSION_SECRET` — ตัวอักษรสุ่มยาวๆ ใช้เซ็นคุกกี้ (ถ้าเปลี่ยน ทุกเครื่องต้องใส่รหัสใหม่)
   - ถ้าคำสั่ง `secret put` แจ้งว่ายังไม่มี worker ให้รัน `node deploy.mjs` ก่อนหนึ่งครั้ง แล้วค่อยตั้ง secret
3. Deploy:
   ```
   node deploy.mjs
   ```
   จะได้ลิงก์ประมาณ `https://numoral-vip-friends.<ชื่อบัญชี>.workers.dev`

ต้องทำขั้นตอนหลัก (GitHub Pages ของ numoral-vip) ให้เสร็จก่อน เพราะลิงก์นี้ดึงผลรางวัลจากที่นั่น

## ใช้งานประจำ
- สร้างรหัสให้เพื่อน: เปิด `https://<ลิงก์>/admin` → สร้างรหัส → "คัดลอกลิงก์เชิญ" → ส่งให้เพื่อน
- รหัสหนึ่งใช้ได้ 2 เครื่อง/เบราว์เซอร์ (เบราว์เซอร์ + แอปบนหน้าจอโฮม) ปรับได้ตอนสร้าง
- ยกเลิกรหัส: กด "ยกเลิกรหัส" — มีผลภายใน 1 นาที
- อัปเดตแอปหลังแก้ไฟล์ในโฟลเดอร์ numoral-vip: `cd friends && node deploy.mjs`

## โควตาฟรีของ Cloudflare
Workers 100,000 ครั้ง/วัน · KV อ่าน 100,000/วัน · เขียน 1,000/วัน — เพียงพอสำหรับเพื่อนหลักร้อยคน
(ใช้บัญชี Cloudflare เดียวกับ Numora ได้ โควตารวมกันทั้งสองแอป)
