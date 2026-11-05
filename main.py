"""SoruMate: lightweight Render-ready website and optional Roboflow hosted inference.
Images are handled in memory only. Do not put secrets in static files.
"""
import io
import json
import unicodedata
import logging
import os
import re
import time
from collections import defaultdict, deque
from functools import lru_cache
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile, Body
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

BASE = Path(__file__).resolve().parent
MODEL_ID = os.environ.get('ROBOFLOW_MODEL_ID', '').strip()
API_KEY = os.environ.get('ROBOFLOW_API_KEY', '').strip()
SERVER_URL = os.environ.get('ROBOFLOW_SERVER_URL', 'https://serverless.roboflow.com').rstrip('/')
DEMO_ACCESS_CODE = os.environ.get('DEMO_ACCESS_CODE', '').strip()
MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 20_000_000
THRESHOLD = 0.30
log = logging.getLogger('sorumate')
app = FastAPI(title='SoruMate – Ebetsu Waste Sorting', version='0.1.0')
app.mount('/static', StaticFiles(directory=BASE / 'static'), name='static')

# Lightweight, per-instance trial limit to reduce accidental credit consumption.
_rate_lock = Lock()
_hits = defaultdict(deque)

LABELS = {
    'pet plastic bottle': ('pet_plastic_bottle', 'ขวดพลาสติก PET', 'PETボトル', 'PET plastic bottle'),
    'pet bottle': ('pet_plastic_bottle', 'ขวดพลาสติก PET', 'PETボトル', 'PET plastic bottle'),
    'pet bottle cap': ('pet_bottle_cap', 'ฝาขวด PET', 'ペットボトルのキャップ', 'PET bottle cap'),
    'aluminum can': ('aluminum_can', 'กระป๋องอะลูมิเนียม', 'アルミ缶', 'Aluminum can'),
    'aluminium can': ('aluminum_can', 'กระป๋องอะลูมิเนียม', 'アルミ缶', 'Aluminum can'),
}

@app.get('/')
def index():
    return FileResponse(BASE / 'static' / 'index.html', headers={'Cache-Control': 'no-cache'})

@app.get('/health')
def health():
    return {
        'status': 'ok',
        'ai_ready': bool(MODEL_ID and API_KEY),
        'model_id': MODEL_ID if MODEL_ID and API_KEY else None,
        'requires_access_code': bool(DEMO_ACCESS_CODE),
        'mode': 'real' if MODEL_ID and API_KEY else 'not_configured',
    }

@lru_cache(maxsize=1)
def client():
    # Import only if inference was configured, keeping the demo lightweight.
    from inference_sdk import InferenceHTTPClient
    return InferenceHTTPClient(api_url=SERVER_URL, api_key=API_KEY)


def rate_limit(ip: str):
    now = time.monotonic()
    with _rate_lock:
        entries = _hits[ip]
        while entries and now - entries[0] > 600:
            entries.popleft()
        if len(entries) >= 20:
            raise HTTPException(status_code=429, detail='ส่งคำขอถี่เกินไป กรุณาลองอีกครั้งภายหลัง')
        entries.append(now)
        if len(_hits) > 2000:
            for key in list(_hits):
                if not _hits[key] or now - _hits[key][-1] > 600:
                    del _hits[key]


def get_detections(image):
    raw = client().infer(image, model_id=MODEL_ID)
    img_meta = raw.get('image') or {}
    width = float(img_meta.get('width') or image.width)
    height = float(img_meta.get('height') or image.height)
    if width <= 0 or height <= 0:
        raise ValueError('Invalid inference dimensions')
    detections = []
    for item in raw.get('predictions', []):
        confidence = float(item.get('confidence', 0))
        if confidence < THRESHOLD:
            continue
        cls = str(item.get('class') or 'Unknown').strip()
        key = re.sub(r'[_-]+', ' ', cls).casefold()
        catalog_item = by_name().get(normal(cls))
        label, th, ja, en = ((catalog_item['id'], catalog_item['th'], catalog_item['ja'], catalog_item['en']) if catalog_item else LABELS.get(key, (re.sub(r'[^a-z0-9]+', '_', cls.lower()).strip('_') or 'unknown', cls, cls, cls)))
        xc = float(item.get('x', 0))
        yc = float(item.get('y', 0))
        bw = float(item.get('width', 0))
        bh = float(item.get('height', 0))
        x1 = max(0., min(1., (xc - bw/2) / width))
        y1 = max(0., min(1., (yc - bh/2) / height))
        x2 = max(0., min(1., (xc + bw/2) / width))
        y2 = max(0., min(1., (yc + bh/2) / height))
        detections.append({
            'label': label, 'label_th': th, 'label_ja': ja, 'label_en': en,
            'model_label': cls, 'confidence': round(confidence, 4),
            'bbox': [round(x1, 5), round(y1, 5), round(max(0., x2-x1), 5), round(max(0., y2-y1), 5)]
        })
    return {'mode': 'real', 'detections': sorted(detections, key=lambda x: x['confidence'], reverse=True), 'confidence_threshold': THRESHOLD}

@app.post('/api/predict')
async def predict(request: Request, file: UploadFile = File(...), x_demo_code: str | None = Header(default=None)):
    if not (MODEL_ID and API_KEY):
        raise HTTPException(status_code=503, detail='ยังไม่เชื่อมต่อโมเดล AI กรุณาตั้งค่า Roboflow บน Render หลังเทรนเสร็จ')
    if DEMO_ACCESS_CODE and x_demo_code != DEMO_ACCESS_CODE:
        raise HTTPException(status_code=403, detail='รหัสทดสอบไม่ถูกต้อง')
    ip = request.client.host if request.client else 'unknown'
    rate_limit(ip)
    data = await file.read(MAX_BYTES + 1)
    await file.close()
    if not data:
        raise HTTPException(status_code=400, detail='ไม่มีข้อมูลภาพ')
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail='ภาพต้องมีขนาดไม่เกิน 10 MB')
    try:
        with Image.open(io.BytesIO(data)) as original:
            if original.width * original.height > MAX_PIXELS:
                raise HTTPException(status_code=413, detail='ภาพต้องมีขนาดไม่เกิน 20 ล้านพิกเซล')
            original.load()
            image = ImageOps.exif_transpose(original).convert('RGB')
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(status_code=400, detail='กรุณาใช้รูป JPG, PNG หรือ WebP ที่เปิดได้')
    try:
        return await run_in_threadpool(get_detections, image)
    except Exception:
        log.exception('Roboflow inference request failed')
        raise HTTPException(status_code=503, detail='เชื่อมต่อ AI ไม่สำเร็จ โปรดตรวจ MODEL_ID, API Key และสถานะโมเดลบน Roboflow')


# ---- Data-first sorting rules, separate from HTML/JS ----
@lru_cache(maxsize=1)
def catalog():
    with open(BASE / 'data' / 'waste_catalog.json', encoding='utf-8') as fh:
        return json.load(fh)

INDEX = None

def normal(text):
    return unicodedata.normalize('NFKC', str(text or '')).casefold().strip().replace('_', ' ').replace('-', ' ')

def by_name():
    entries = {}
    for item in catalog()['items']:
        for x in [item['id'], item['en'], item['th'], item['ja'], *item.get('aliases', [])]:
            entries[normal(x)] = item
    return entries

# Match Roboflow YOLO class strings to human-reviewed catalog IDs.
# Cups from both paper/plastic classes map to one "cup" decision flow.
def resolve_model_class(name):
    item = by_name().get(normal(name))
    return item['id'] if item else (re.sub(r'[^a-z0-9]+', '_', normal(name)).strip('_') or 'unknown')

@app.get('/api/catalog')
def get_catalog():
    return catalog()

@app.get('/api/item/{item_id}')
def get_item(item_id: str):
    found = next((x for x in catalog()['items'] if x['id'] == item_id), None)
    if not found:
        raise HTTPException(404, 'Item not found')
    return found

EXTRA_KNOWLEDGE = {
    'tissue': ('กระดาษทิชชู', '紙製ティッシュ', 'ขยะกระดาษที่ใช้แล้ว โดยทั่วไปเผาได้ ตรวจประเภทการปนเปื้อนก่อน'),
    'sanitary pad': ('ผ้าอนามัย', '生理用品', 'ไม่ใช่ขยะผ้าอ้อมฟรีของเมือง ตรวจวิธีจัดเป็นขยะเผาได้ตามคู่มือ'),
    'silica gel': ('ซองกันชื้น', '乾燥剤', 'ต้องดูชนิดสารดูดความชื้นและซอง บางชนิดต่างกัน ไม่ควรเหมารวม'),
}

def choose_category(item, answers):
    a = answers or {}
    kind = item['category']
    if item['id'] == 'cup':
        kind = {'paper':'burnable','plastic_soft':'burnable','plastic_hard':'nonburnable'}.get(a.get('material'),'review')
    elif item['id'] == 'light_bulb':
        kind = {'led':'nonburnable','fluorescent':'hazardous'}.get(a.get('bulb_type'),'review')
    elif item['id'] == 'glass_bottle':
        kind = {'intact':'recyclables','broken':'nonburnable'}.get(a.get('state'),'review')
    return kind

@app.post('/api/ask')
async def ask(payload: dict = Body(...)):
    # Retrieval & condition flow only: NO LLM is called and NO answer is invented.
    query = str(payload.get('query') or '').strip()[:500]
    explicit_id = str(payload.get('item_id') or '').strip()
    answers = payload.get('answers') if isinstance(payload.get('answers'), dict) else {}
    for item in catalog()['items']:
        if explicit_id == item['id']:
            match = item; break
    else:
        match = by_name().get(normal(query))
        if not match and len(normal(query)) >= 3:
            candidates = [i for i in catalog()['items'] if any(len(normal(n)) >= 3 and normal(n) in normal(query)
                for n in [i['en'],i['th'],i['ja'],*i.get('aliases',[])])]
            match = candidates[0] if len(candidates) == 1 else None
    if not match:
        special = next(((label, name, ja, note) for label,(name,ja,note) in EXTRA_KNOWLEDGE.items() if normal(label) in normal(query) or normal(name) in normal(query)), None)
        if special:
            _, name, ja, note = special
            return {'found':False,'message_th':f'{name}: {note} ควรตรวจสอบในคู่มือเอเบ็ตสึหรือโทร 011-384-5600', 'source':catalog()['sources'][0], 'suggestions':[]}
        return {'found':False,'message_th':'ยังไม่พบรายการที่ยืนยันได้ในฐานข้อมูล ไม่ควรเดาวิธีทิ้งจากข้อความนี้ กรุณาระบุวัสดุหรือเลือกหมวด และตรวจคู่มือเมืองเอเบ็ตสึ', 'source':catalog()['sources'][0], 'suggestions':[{'id':x['id'],'th':x['th']} for x in catalog()['items'][:5]]}
    cat = choose_category(match, answers)
    return {'found':True,'item':match,'category_id':cat,'category':catalog()['category_names'][cat],
            'requires_confirmation':cat == 'review' or match['status'] in ('conditional','provisional'),
            'message_th':match['details_th'], 'source':match['source']}

# /predict is the endpoint the original SoruMate HTML uses;
# keep compatibility with /api/predict on the Render deployment.
app.add_api_route('/predict', predict, methods=['POST'], include_in_schema=False)
