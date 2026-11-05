"""SoruMate: lightweight Render-ready website and optional Roboflow hosted inference.
Images are handled in memory only. Do not put secrets in static files.
"""
import io
import logging
import os
import re
import time
from collections import defaultdict, deque
from functools import lru_cache
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
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
    return FileResponse(BASE / 'static' / 'sorumate.html', headers={'Cache-Control': 'no-cache'})

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
        label, th, ja, en = LABELS.get(key, (
            re.sub(r'[^a-z0-9]+', '_', cls.lower()).strip('_') or 'unknown', cls, cls, cls
        ))
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
