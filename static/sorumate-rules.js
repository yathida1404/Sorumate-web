(() => {
 'use strict';
 const $ = (s) => document.querySelector(s);
 const E = (s, text, cls) => {const el=document.createElement(s);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
 let catalog = null, selection = '', answers = {};
 window.SM_CATALOG_MAP = {};
 window.SM_CAT_NAMES = {};
 window.SM_RESOLVE_CATEGORY = (item, a={}) => {
   if (item.id === 'cup') return ({paper:'burnable',plastic_soft:'burnable',plastic_hard:'nonburnable'})[a.material] || 'review';
   if (item.id === 'light_bulb') return ({led:'nonburnable',fluorescent:'hazardous'})[a.bulb_type] || 'review';
   if (item.id === 'glass_bottle') return ({intact:'recyclables',broken:'nonburnable'})[a.state] || 'review';
   return item.category;
 };
 const locale = () => (document.documentElement.lang === 'ja' ? 'ja' : 'en');
 const select = $('#sm-select');
 const materialFilter=$('#sm-material');
 function filterGrid(){ const m=materialFilter?.value||'all';document.querySelectorAll('.sm-item-button').forEach(b=>{b.hidden=m==='other'||(m!=='all'&&b.dataset.material!==m)});if(m==='other')showMessage('สำหรับขยะนอก 25 รายการ กรุณาพิมพ์ชื่อหรือรายละเอียดด้านบน — ถ้าไม่มีข้อมูลที่ยืนยัน ระบบจะแนะนำให้ตรวจคู่มือเมือง');}
 const output = $('#sm-answer');
 function showMessage(message) {output.replaceChildren(E('p',message));}
 function renderQuestions() {
   const area=$('#sm-questions'); area.replaceChildren();answers={};
   const item=window.SM_CATALOG_MAP[selection];if(!item)return;
   for(const q of item.questions||[]) {
     const field=E('fieldset',null,'sm-question');const leg=E('legend',q.label_th+' / '+q.label_ja);field.append(leg);
     for(const opt of q.options){const label=E('label'),input=E('input');input.type='radio';input.name='sm-q-'+q.id;input.value=opt.id;
       input.addEventListener('change',()=>{answers[q.id]=opt.id});label.append(input,E('span',opt.th+' / '+opt.ja));field.append(label);}
     area.append(field);
   }
 }
 function selectItem(id){ selection=id;select.value=id;renderQuestions();const item=window.SM_CATALOG_MAP[id];if(item) $('#sm-search').value=item.th;output.replaceChildren();}
 async function submit() {
   const query=$('#sm-search').value.trim(),details=$('#sm-description').value.trim();
   if(!query&&!selection&&!details){showMessage('โปรดพิมพ์สิ่งของหรือเลือกหมวดก่อน / 品目を入力してください');return;}
   showMessage('กำลังค้นข้อมูลจากกฎที่เตรียมไว้…');
   try {
     const response=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:query||details,item_id:selection,answers,details})});
     if(!response.ok)throw new Error('HTTP '+response.status);
     const data=await response.json();output.replaceChildren();
     if(data.found){const item=data.item;output.append(E('b',`${item.th} / ${item.ja}`));
       output.append(E('p', data.category.th+' / '+data.category.ja));
       output.append(E('p', data.message_th));
       if(data.requires_confirmation)output.append(E('p','⚠️ ต้องตรวจวัสดุ/สภาพก่อนทิ้ง — AI ยังไม่ได้ยืนยันทั้งหมด'));
     }else{output.append(E('b','ยังไม่มีคำตอบที่ยืนยันได้ / 要確認'));output.append(E('p',data.message_th));}
     if(details)output.append(E('p','รายละเอียดที่คุณระบุ: '+details+' — ข้อมูลนี้ช่วยให้คุณอธิบายเพิ่มเติม แต่ยังไม่ได้รับการวิเคราะห์โดยโมเดล AI'));
     const link=E('a','เปิดคู่มือเมืองเอเบ็ตสึ ↗');link.href=data.source||'https://www.city.ebetsu.hokkaido.jp/site/gomi/2021.html';link.target='_blank';link.rel='noopener noreferrer';output.append(link);
   }catch(error){showMessage('ไม่สามารถเชื่อมฐานข้อมูลกฎได้ / 接続できません: '+error.message);}
 }
 async function initialize() {
   if(!select)return;
   select.replaceChildren(E('option','กำลังโหลดรายการ...'));
   try {const response=await fetch('/api/catalog',{cache:'no-store'});if(!response.ok)throw Error('API error');catalog=await response.json();
     window.SM_CATALOG_MAP=Object.fromEntries(catalog.items.map(i=>[i.id,i]));window.SM_CAT_NAMES=catalog.category_names;
     select.replaceChildren(E('option','— เลือกรายการ / 品目を選ぶ —'));
     const grid=$('#sm-catalog-grid');grid.replaceChildren();
     for(const item of catalog.items){const opt=E('option',item.th+' / '+item.ja);opt.value=item.id;select.append(opt);
       const button=E('button',null,'sm-item-button');button.type='button';button.dataset.material=item.material;button.append(E('span',item.th),E('small',item.en));button.onclick=()=>{selectItem(item.id);$('#sm-assistant').scrollIntoView({behavior:'smooth',block:'start'})};grid.append(button);
       // Populate legacy name / rule steps so detected YOLO items can be confirmed.
       if(typeof CLASS_INFO==='object')CLASS_INFO[item.id]={name:(locale()==='ja'?item.ja:item.en),mat:item.material};
       if(typeof RULES==='object'&& !RULES[item.id])RULES[item.id]={name:(locale()==='ja'?item.ja:item.en),mat:item.material,icon:'♻️',summary:item.details_ja,prep:item.details_th,note:'Official guide + check material'};
       if(typeof QUESTION_SETS==='object' && item.questions && !QUESTION_SETS[item.id])QUESTION_SETS[item.id] = item.questions.map(q=>({id:q.id,title:locale()==='ja'?q.label_ja:q.label_en,options:q.options.map(o=>[o.id,'🔎',locale()==='ja'?o.ja:o.en])}));
     }
     if(typeof renderItemRules==='function')renderItemRules();
     filterGrid();
     // Ensure no unverified class can accidentally inherit PET-specific decisions.
     const note=E('p','※ 25 รายการข้างต้นเป็นแค็ตตาล็อกหน้าเว็บ ต้องเทียบชื่อกับ data.yaml ของโมเดลก่อนเปิดตรวจจับครบ 25 รายการ');note.className='sm-small';grid.before(note);
   }catch(error){showMessage('โหลดรายการไม่สำเร็จ: '+error.message);}
 }
 select?.addEventListener('change',()=>selectItem(select.value));
 materialFilter?.addEventListener('change',filterGrid);
 $('#sm-search-btn')?.addEventListener('click',()=>{selection='';select.value='';renderQuestions();submit();});
 $('#sm-check-btn')?.addEventListener('click',submit);
 $('#sm-reset-btn')?.addEventListener('click',()=>{selection='';select.value='';answers={};$('#sm-search').value='';$('#sm-description').value='';if(materialFilter)materialFilter.value='all';filterGrid();$('#sm-questions').replaceChildren();output.replaceChildren()});
 $('#sm-search')?.addEventListener('input',()=>{selection='';select.value='';$('#sm-questions').replaceChildren();answers={}});
 $('#sm-search')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit()}});
 $('#sm-open-helper')?.addEventListener('click',()=>{
   if(typeof go==='function')go(6);else location.hash='#/guide';
   setTimeout(()=>$('#sm-assistant')?.scrollIntoView({behavior:'smooth',block:'start'}),50);
 });
 document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>{setTimeout(()=>{if(!catalog)return;for(const item of catalog.items){if(typeof CLASS_INFO==='object')CLASS_INFO[item.id]={name:locale()==='ja'?item.ja:item.en,mat:item.material};if(typeof RULES==='object'&&!RULES[item.id])RULES[item.id]={name:locale()==='ja'?item.ja:item.en,mat:item.material,icon:'🔎',summary:locale()==='ja'?item.details_ja:item.details_th,prep:item.details_th,note:'Official Ebetsu guide'};if(typeof QUESTION_SETS==='object'&&item.questions&&!QUESTION_SETS[item.id])QUESTION_SETS[item.id]=item.questions.map(q=>({id:q.id,title:locale()==='ja'?q.label_ja:q.label_en,options:q.options.map(o=>[o.id,'🔎',locale()==='ja'?o.ja:o.en])}));}if(typeof renderItemRules==='function')renderItemRules();},0)}));
 document.addEventListener('DOMContentLoaded',initialize);
})();
