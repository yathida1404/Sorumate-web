# SoruMate – Updated original UI + backend rules (November 2026)

**ใช้หน้าเว็บเดิม `sorumate.html` ไม่ได้ออกแบบใหม่** ข้อมูลเมืองอยู่ที่ `data/waste_catalog.json` และเรียกผ่าน `/api/catalog`, `/api/item/{id}`, `/api/ask`.

## อัปโหลด GitHub
1. สำรอง Repository เดิมไว้ก่อน (GitHub มีประวัติ Commit อยู่แล้ว)
2. อัปโหลด `main.py`, `requirements.txt`, `render.yaml`, `README_TH.md` ลง root (แทนไฟล์เดิม)
3. อัปโหลด `static/index.html`, `static/sorumate.html`, `static/sorumate-rules.js` ลงในโฟลเดอร์ `static` ของ GitHub (แทนไฟล์ชื่อซ้ำ)
4. สร้างโฟลเดอร์ `data` ใน GitHub แล้วอัปโหลด `data/waste_catalog.json` ไว้ข้างใน
5. Commit แล้ว Render > Manual Deploy > Deploy latest commit. หากไม่เปลี่ยนให้ Clear build cache & deploy.
6. ตรวจ `/health` และ `/api/catalog` บน URL Render ก่อนทดสอบหน้าเว็บ.

## สำคัญ
- **25 รายการยังไม่ใช่รายการที่ยืนยันว่าตรงกับ Roboflow ล่าสุด**: เดิมมีรายการ 24, ตอนนี้รวมแก้วกระดาษกับแก้วพลาสติกเป็น `cup` และใส่ตัวอย่าง `glass_bottle`, `plastic_film` เพื่อเป็นแค็ตตาล็อก 25. ต้องเปิด `data.yaml` ของรุ่นที่คัดแล้วเพื่อปรับชื่อตรงก่อนอ้างว่าตรวจจับได้ครบ.
- **ไม่ใช่แชต AI สร้างคำตอบเอง**: กล่องข้อความค้นจากฐานข้อมูลการทิ้งเท่านั้น ถ้าไม่รู้จะบอกให้ตรวจคู่มือ/โทรศัพท์เมือง
- ข้อมูลเกี่ยวกับแก้วชนิดต่าง ๆ หลอดไฟ และแก้วแตกต้องสอบถามรายละเอียดก่อน
- `/predict` alias ไปที่ `/api/predict` เพื่อรองรับ UI เดิม แต่ **โมเดลยังไม่เชื่อม** จึงได้ HTTP 503 ตามจริง
- `inference-sdk` ไม่ได้ติดตั้งในเว็บฟรีตัวนี้: การเปิด AI จริงต้องเพิ่ม client/backend inference เมื่อได้โมเดลและ Python version พร้อม
- **ไม่มีรูปของผู้ใช้บันทึกในฐานข้อมูล**, ฟอร์มค้นหายังไม่เก็บข้อมูลส่วนตัว
- กฎคู่มือ Ebetsu 2024-10: https://www.city.ebetsu.hokkaido.jp/uploaded/attachment/71884.pdf
- ยังมีข้อมูลปฏิทินปี 2026-2027 แบบฝังใน HTML เดิม เนื่องจากไม่แตะดีไซน์และวันนัดหมายเดิม; เป้าหมายย้าย calendar ไป JSON ในรอบถัดไป
