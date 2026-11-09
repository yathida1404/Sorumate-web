วางไฟล์โมเดลที่ export แล้วไว้ที่นี่ในชื่อ `best.onnx` (หรือกำหนดพาธด้วย `ONNX_MODEL_PATH`)

Export จาก Colab:
```python
from ultralytics import YOLO
YOLO("/content/drive/MyDrive/sorumate/runs/yolo26n_25k/weights/best.pt").export(format="onnx", imgsz=640, simplify=True)
```
จากนั้นอัปโหลด `best.onnx` ขึ้น GitHub (โฟลเดอร์ `models/`) แล้ว Render จะ deploy ใหม่
ตรวจชื่อ class: `python scripts/check_classes.py models/best.onnx`
