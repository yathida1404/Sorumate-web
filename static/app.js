(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fileInput = $('file-input');
  const cameraInput = $('camera-input');
  const chooseBtn = $('choose-btn');
  const cameraBtn = $('camera-btn');
  const drop = $('dropzone');
  const empty = $('empty-state');
  const wrap = $('preview-wrap');
  const preview = $('preview');
  const boxes = $('boxes');
  const scanBtn = $('scan-btn');
  const resultEmpty = $('result-empty');
  const resultMessage = $('result-message');
  const resultList = $('detections');
  const confirmPanel = $('confirm-panel');
  const condition = $('condition');
  const conditionNote = $('condition-note');
  const status = $('model-status');
  const accessWrap = $('access-wrap');
  const code = $('access-code');
  let selectedFile = null;
  let blobUrl = null;
  let predictions = [];

  function showMessage(message, kind='warn') {
    resultMessage.hidden = false;
    resultMessage.className = 'result-message ' + kind;
    resultMessage.textContent = message;
  }

  function clearResults() {
    predictions = [];
    boxes.replaceChildren();
    resultList.replaceChildren();
    resultMessage.hidden = true;
    confirmPanel.hidden = true;
    condition.value = '';
    conditionNote.textContent = '';
    $('result-count').textContent = 'ยังไม่มีผลลัพธ์';
    resultEmpty.hidden = false;
  }

  function loadFile(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showMessage('กรุณาเลือกไฟล์ JPG, PNG หรือ WebP', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showMessage('รูปนี้ใหญ่เกิน 10 MB กรุณาเลือกรูปอื่น', 'error');
      return;
    }
    selectedFile = file;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(file);
    preview.src = blobUrl;
    empty.hidden = true;
    wrap.hidden = false;
    scanBtn.disabled = false;
    clearResults();
    showMessage('เลือกรูปสำเร็จแล้ว กด “เริ่มตรวจจับภาพ” ได้เลย', 'good');
  }

  chooseBtn.addEventListener('click', () => fileInput.click());
  cameraBtn.addEventListener('click', () => cameraInput.click());
  fileInput.addEventListener('change', () => loadFile(fileInput.files?.[0]));
  cameraInput.addEventListener('change', () => loadFile(cameraInput.files?.[0]));
  drop.addEventListener('click', e => {
    if (e.target.closest('.detect-box')) return;
    if (!selectedFile) fileInput.click();
  });
  drop.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !selectedFile) { e.preventDefault(); fileInput.click(); }});
  ['dragenter','dragover'].forEach(evt => drop.addEventListener(evt, e => {e.preventDefault();drop.classList.add('dragging');}));
  ['dragleave','drop'].forEach(evt => drop.addEventListener(evt, e => {e.preventDefault();drop.classList.remove('dragging');}));
  drop.addEventListener('drop', e => loadFile(e.dataTransfer?.files?.[0]));

  async function checkHealth() {
    try {
      const resp = await fetch('/health', {cache: 'no-store'});
      if (!resp.ok) throw new Error('offline');
      const data = await resp.json();
      status.classList.toggle('offline', !data.ai_ready);
      status.querySelector('span:last-child').textContent = data.ai_ready ? 'AI พร้อมตรวจจับภาพ' : 'หน้าเว็บพร้อม · รอเชื่อมโมเดล AI';
      accessWrap.hidden = !data.requires_access_code;
      if (!data.ai_ready) showMessage('ตอนนี้หน้าเว็บเปิดให้ทดลองเลือกภาพได้แล้ว แต่การตรวจจับจริงจะเปิดหลังจากเชื่อมโมเดล Roboflow ที่เทรนเสร็จ', 'warn');
    } catch (_) {
      status.classList.add('offline');
      status.querySelector('span:last-child').textContent = 'เปิดดูหน้าเว็บได้ · API ยังไม่เชื่อมต่อ';
    }
  }

  function selectDetection(index) {
    [...boxes.children].forEach((el, i) => el.classList.toggle('active', i === index));
    [...resultList.children].forEach((el, i) => el.classList.toggle('active', i === index));
    const item = predictions[index];
    if (!item) return;
    $('confirm-description').textContent = `ระบบตรวจพบ “${item.label_th || item.model_label || 'วัตถุ'}” ด้วยความมั่นใจ ${Math.round(item.confidence*100)}% โปรดตรวจสอบกับวัตถุจริง`;
    confirmPanel.hidden = false;
    condition.value = '';
    conditionNote.textContent = '';
  }

  function renderPredictions(data) {
    clearResults();
    resultEmpty.hidden = true;
    predictions = Array.isArray(data.detections) ? data.detections : [];
    $('result-count').textContent = predictions.length + ' รายการ';
    if (!predictions.length) {
      showMessage('ยังไม่พบวัตถุที่มั่นใจเพียงพอในภาพนี้ ลองถ่ายให้ชัดขึ้นหรือใช้พื้นหลังเรียบ ๆ', 'warn');
      return;
    }
    predictions.forEach((item, i) => {
      const bbox = Array.isArray(item.bbox) ? item.bbox : [0,0,0,0];
      const rect = document.createElement('div');
      rect.className = 'detect-box';
      rect.style.left = (Math.max(0,Math.min(1,bbox[0]))*100) + '%';
      rect.style.top = (Math.max(0,Math.min(1,bbox[1]))*100) + '%';
      rect.style.width = (Math.max(0,Math.min(1,bbox[2]))*100) + '%';
      rect.style.height = (Math.max(0,Math.min(1,bbox[3]))*100) + '%';
      const label = document.createElement('span');
      label.textContent = `${item.label_th || item.model_label} ${Math.round(item.confidence*100)}%`;
      rect.append(label); boxes.append(rect);

      const card = document.createElement('button');
      card.type = 'button'; card.className = 'detection';
      const left = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = item.label_th || item.model_label;
      const model = document.createElement('small'); model.textContent = item.model_label || '';
      left.append(name, model);
      const score = document.createElement('span');score.className='confidence';score.textContent = `${Math.round(item.confidence*100)}%`;
      card.append(left, score);
      card.addEventListener('click', () => selectDetection(i));
      resultList.append(card);
    });
    showMessage('ตรวจพบวัตถุแล้ว กรุณากดเลือกรายการและยืนยันชนิดขยะก่อนดูคู่มือ', 'good');
    selectDetection(0);
  }

  scanBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    clearResults();
    resultEmpty.hidden = true;
    scanBtn.disabled = true;
    scanBtn.textContent = 'กำลังตรวจจับภาพ…';
    showMessage('กำลังส่งภาพให้ระบบ AI ประมวลผล…', 'warn');
    try {
      const form = new FormData();
      form.append('file', selectedFile, selectedFile.name || 'waste.jpg');
      const headers = {};
      if (code.value) headers['x-demo-code'] = code.value;
      const response = await fetch('/api/predict', {method:'POST',body:form,headers});
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.detail === 'string' ? payload.detail : 'เชื่อมต่อ AI ไม่สำเร็จ');
      renderPredictions(payload);
    } catch (err) {
      resultEmpty.hidden = false;
      showMessage(err?.message || 'ตรวจจับไม่ได้ โปรดลองอีกครั้ง', 'error');
    } finally {
      scanBtn.disabled = false;
      scanBtn.innerHTML = '🔎 &nbsp; เริ่มตรวจจับภาพ <span class="arr">↗</span>';
    }
  });

  condition.addEventListener('change', () => {
    const messages = {
      yes: 'ขอบคุณที่ยืนยันค่ะ จากนี้ให้ตรวจสภาพขยะและขั้นตอนเตรียมทิ้งตามคู่มือทางการก่อนทิ้ง',
      unclear: 'อย่าเพิ่งทิ้งตามผล AI เพียงอย่างเดียว ลองตรวจสัญลักษณ์วัสดุหรือถามเจ้าหน้าที่ดูแลจุดทิ้ง',
      no: 'ผลตรวจจับอาจผิดพลาด กรุณาอย่าใช้ผลนี้ตัดสินวิธีทิ้ง และตรวจประเภทขยะจากคู่มือแทน',
    };
    conditionNote.textContent = messages[condition.value] || '';
  });
  checkHealth();
})();
