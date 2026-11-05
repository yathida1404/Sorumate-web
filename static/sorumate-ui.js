/* SoruMate v3 — one-language-at-a-time search, catalog, city pages.
   UI only. City rules and classification stay in backend /api/ask. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const E = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined && text !== null) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const DICT = {
    th: {
      all:'ทั้งหมด', plastic:'พลาสติก', paper:'กระดาษ', metal:'โลหะ', glass:'แก้ว', mixed:'วัสดุผสม', hazardous:'ขยะอันตราย',
      count:n=>`${n} รายการ`,matches:n=>`พบ ${n} รายการ`, choose:'เลือกรายการที่ตรงกับสิ่งของ', noMatch:'ไม่พบรายการที่ตรงกันใน 25 ชนิด ลองใช้คำอื่นหรือดูคู่มือของเมือง',
      intro:'เลือกสิ่งของที่ต้องการตรวจสอบ', selected:'รายการที่เลือก', noItem:'กรุณาเลือกสิ่งของจากผลการค้นหาก่อน',
      condition:'ตรวจสอบวัสดุหรือสภาพ', needAnswers:'กรุณาเลือกคำตอบให้ครบก่อนดูวิธีทิ้ง',
      help:'ระบบยังไม่มีข้อมูลเพียงพอที่จะยืนยันวิธีทิ้งสำหรับคำค้นนี้ กรุณาตรวจคู่มือเมืองเอเบ็ตสึ',
      checking:'กำลังตรวจสอบข้อมูล…', error:'เชื่อมต่อข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง',
      how:'วิธีทิ้งที่แนะนำ', review:'ตรวจสอบเพิ่มเติมก่อนทิ้ง', details:'รายละเอียดที่ระบุ', detailNotInterpreted:'รายละเอียดนี้ไม่ได้ถูกวิเคราะห์โดย AI อัตโนมัติ',
      source:'แหล่งอ้างอิง', warning:'คำแนะนำนี้มีเงื่อนไข โปรดยืนยันวัสดุและสภาพจริงก่อนทิ้ง',
      go:'ตรวจสอบ →', empty:'ยังไม่มีรายการในหมวดนี้',
      cityBurn:'ขยะเผาได้', cityBurnD:'เช่น เศษอาหาร กระดาษใช้แล้ว ผ้า และพลาสติกอ่อนบางประเภท โดยขึ้นอยู่กับวัสดุและสภาพ',
      cityNon:'ขยะเผาไม่ได้',cityNonD:'เช่น เครื่องแก้วแตก เซรามิก โลหะบางชนิด และพลาสติกแข็งที่ไม่อยู่ในระบบรีไซเคิล',
      cityRec:'ขยะรีไซเคิล',cityRecD:'เฉพาะรายการที่เมืองรับ เช่น ขวด PET ที่เข้าเงื่อนไข ขวดแก้วและกระป๋องที่ล้างสะอาด',
      cityHaz:'ขยะอันตราย',cityHazD:'เช่น ถ่านไฟฉาย หลอดฟลูออเรสเซนต์ กระป๋องสเปรย์ และไฟแช็ก ต้องแยกจากขยะทั่วไป',
    },
    ja: {
      all:'すべて',plastic:'プラスチック',paper:'紙',metal:'金属',glass:'ガラス',mixed:'複合素材',hazardous:'危険ごみ',
      count:n=>`${n}品目`,matches:n=>`${n}件見つかりました`,choose:'実物に合う品目を選んでください',noMatch:'25品目から見つかりませんでした。別の言葉か市の手引きで確認してください。',
      intro:'調べたい品目を選んでください',selected:'選択した品目',noItem:'検索結果から品目を選んでください',
      condition:'材質・状態を確認',needAnswers:'分別方法を確認する前に質問に答えてください',
      help:'この検索では確かな分別方法を特定できません。江別市の公式手引きを確認してください。',
      checking:'分別情報を確認しています…',error:'データに接続できませんでした。もう一度お試しください。',
      how:'分別の目安',review:'出す前に確認が必要',details:'入力した詳細',detailNotInterpreted:'この文章はAIによる自動判定の対象ではありません。',
      source:'参照資料',warning:'材質や状態によって分別が変わります。現物を確認してください。',
      go:'確認 →',empty:'該当する品目がありません',
      cityBurn:'燃やせるごみ',cityBurnD:'生ごみ、使用済み紙類、布類、一部の軟質プラスチックなど。材質と状態によって異なります。',
      cityNon:'燃やせないごみ',cityNonD:'割れたガラス、陶器、一部の金属製品、資源回収対象外の硬質プラスチックなど。',
      cityRec:'資源物',cityRecD:'対象のPETボトル、洗ってきれいな飲食用びんや缶など、市が対象とする品目。',
      cityHaz:'危険ごみ',cityHazD:'乾電池、蛍光管、スプレー缶、ライターなど。一般ごみと混ぜないでください。',
    },
    en: {
      all:'All',plastic:'Plastic',paper:'Paper',metal:'Metal',glass:'Glass',mixed:'Mixed materials',hazardous:'Hazardous',
      count:n=>`${n} items`,matches:n=>`${n} matches`,choose:'Choose the item that matches yours',noMatch:'Not found among the 25 listed items. Try another word or check the official guide.',
      intro:'Choose an item to check',selected:'Selected item',noItem:'Please choose an item from the search results first.',
      condition:'Confirm material or condition',needAnswers:'Please answer the questions before checking disposal advice.',
      help:'There is not enough verified information to identify a disposal method from this query. Check the official Ebetsu guide.',
      checking:'Checking sorting information…',error:'Could not connect to the rules service. Please try again.',
      how:'Disposal guidance',review:'Check before disposal',details:'Details supplied',detailNotInterpreted:'This text has not been interpreted by an AI chatbot.',
      source:'Source',warning:'Sorting depends on material and condition. Confirm the physical item before disposal.',
      go:'Check →',empty:'No items in this category',
      cityBurn:'Burnable waste',cityBurnD:'Examples include food scraps, used paper, textiles and certain soft plastics, depending on material and condition.',
      cityNon:'Non-burnable waste',cityNonD:'Examples include broken glass, ceramics, certain metal items and rigid plastic outside accepted recycling.',
      cityRec:'Recyclables',cityRecD:'Eligible PET bottles and clean glass food/drink bottles and cans, subject to the city collection criteria.',
      cityHaz:'Hazardous waste',cityHazD:'Examples include batteries, fluorescent tubes, spray cans and lighters. Keep separate from general waste.',
    }
  };
  const materialLabels = {Plastic:'plastic', Paper:'paper', Metal:'metal',Glass:'glass',Hazardous:'hazardous', Mixed:'mixed'};
  const iconByMaterial={Plastic:'♻️',Paper:'📄',Metal:'🥫',Glass:'🍾',Hazardous:'⚠️',Mixed:'🧩'};
  let catalog=null, currentId='', currentAnswers={}, lastResult=null, libraryFilter='all';
  const locale=()=>['th','ja','en'].includes(document.documentElement.lang)?document.documentElement.lang:'th';
  const W=(k)=>DICT[locale()][k];
  const name=i=>i?.[locale()]||i?.en||'';
  const detail=i=>i?.['details_'+locale()]||'';
  const norm=t=>String(t||'').normalize('NFKC').toLocaleLowerCase().trim().replace(/[_\-]/g,' ');
  function namesFor(i){return [i?.th,i?.ja,i?.en,...(i?.aliases||[])].filter(Boolean).map(norm)}
  function findItems(q){q=norm(q);if(!catalog)return[];if(!q)return catalog.items;return catalog.items.filter(i=>namesFor(i).some(s=>s.includes(q)||q.includes(s)&&s.length>=3));}
  function sourceLink(url){const a=E('a',t('Open Ebetsu sorting guide ↗'));a.href=url||'https://www.city.ebetsu.hokkaido.jp/uploaded/attachment/71884.pdf';a.target='_blank';a.rel='noopener noreferrer';return a}
  function localizedCategory(obj){return obj?.[locale()]||obj?.en||''}
  function showOutput(message,mode='plain'){
    const area=$('#sm-output');area.replaceChildren();if(!message)return;
    if(mode==='plain'){area.append(E('p',message));return;}
    if(mode==='notfound') {area.append(E('h3',W('review')),E('p',message),sourceLink());return;}
    const result=message, i=result.item;
    area.append(E('h3',name(i)));
    const pill=E('span',localizedCategory(result.category),'sm-category-pill');area.append(pill);
    if(i?.questions?.length){
      for(const question of i.questions){
        const option=question.options.find(o=>o.id===currentAnswers[question.id]);
        if(option)area.append(E('p',(question['label_'+locale()]||question.label_en)+': '+(option[locale()]||option.en)));
      }
    }
    if(i?.id==='cup' && currentAnswers.material){
      area.append(E('p',({th:'หมวดทิ้งที่แสดงอ้างอิงจากวัสดุที่คุณเลือก โปรดตรวจวัสดุจริงและคู่มือเมืองอีกครั้ง',ja:'表示した分別区分は選択した材質に基づきます。現物と市の手引きを確認してください。',en:'The shown category is based on the material you selected. Confirm the actual item and the city guide.'})[locale()]));
    }else area.append(E('p',detail(i)));
    if(result.requires_confirmation){area.append(E('p','⚠️ '+W('warning'),'sm-alert'));}
    if($('#sm-notes').value.trim()){
      area.append(E('b',W('details')+':'),E('p',$('#sm-notes').value.trim()));
      area.append(E('p',W('detailNotInterpreted'),'sm-muted'));
    }
    area.append(sourceLink(result.source));
  }
  function renderHits(){if(!catalog)return;
    const list=$('#sm-hits'),items=findItems($('#sm-q').value),filtered=items.slice(0,$('#sm-q').value.trim()?25:6);
    $('#sm-count').textContent=$('#sm-q').value.trim()?W('matches')(items.length):W('choose');
    list.replaceChildren();
    if(!filtered.length){list.append(E('p',W('noMatch'),'sm-empty'));return;}
    for(const i of filtered){const b=E('button',null,'sm-hit');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(i.id===currentId));
      b.append(E('span',iconByMaterial[i.material]||'♻️','sm-icon'));
      const m=E('span');m.append(E('span',name(i),'sm-hit-name'),E('span',W(materialLabels[i.material]||'mixed'),'sm-hit-sub'));
      b.append(m,E('span','›','sm-row-arrow'));
      b.onclick=()=>select(i.id);
      list.append(b);
    }
  }
  function renderSelected(){const region=$('#sm-selected'), cond=$('#sm-conditions');region.replaceChildren();cond.replaceChildren();
    const item=catalog?.items.find(i=>i.id===currentId);region.hidden=!item;cond.hidden=!item?.questions?.length;
    if(!item)return;
    region.append(E('span',W('selected'),'sm-hit-sub'),E('strong',name(item)));
    region.append(E('p',W(materialLabels[item.material]||'mixed')));
    if(!item.questions?.length)return;
    cond.append(E('h3',W('condition')));
    for(const q of item.questions){const field=E('fieldset',null,'sm-question'), legend=E('legend',q['label_'+locale()]||q.label_en);
      field.append(legend);const group=E('div',null,'sm-choices');
      for(const option of q.options){const label=E('label'),radio=E('input');radio.type='radio';radio.name='sm-c-'+q.id;radio.value=option.id;radio.checked=currentAnswers[q.id]===option.id;
        radio.onchange=()=>{currentAnswers[q.id]=option.id;lastResult=null;showOutput('');};
        label.append(radio,E('span',option[locale()]||option.en));group.append(label);
      }field.append(group);cond.append(field);
    }
  }
  function select(id){currentId=id;currentAnswers={};lastResult=null;renderSelected();renderHits();showOutput('');}
  async function check(){const q=$('#sm-q').value.trim();const matches=findItems(q);
    if(!currentId){if(q&&matches.length===1)select(matches[0].id);else {showOutput(q?W('help'):W('noItem'),'notfound');return;}}
    const item=catalog.items.find(i=>i.id===currentId);if(!item){showOutput(W('noItem'));return;}
    if((item.questions||[]).some(question=>!currentAnswers[question.id])){showOutput(W('needAnswers'));return;}
    showOutput(W('checking'));
    try{
      const response=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({item_id:currentId,query:q,details:$('#sm-notes').value,answers:currentAnswers})});
      if(!response.ok)throw Error('HTTP '+response.status);
      const result=await response.json();lastResult=result;
      if(result.found)showOutput(result,'found');else showOutput(W('help'),'notfound');
    }catch(e){showOutput(W('error'));}
  }
  function renderCatalog(){if(!catalog)return;
    const q=norm($('#sm-catalog-q').value),holder=$('#sm-item-list');holder.replaceChildren();
    const materials=[['all','all'],['Plastic','plastic'],['Paper','paper'],['Metal','metal'],['Glass','glass'],['Hazardous','hazardous'],['Mixed','mixed']];
    const tabs=$('#sm-tabs');tabs.replaceChildren();
    for(const [id,label] of materials){const b=E('button',W(label));b.type='button';b.setAttribute('aria-pressed',String(libraryFilter===id));b.onclick=()=>{libraryFilter=id;renderCatalog()};tabs.append(b)}
    const filtered=catalog.items.filter(i=>(libraryFilter==='all'||i.material===libraryFilter)&&(!q||namesFor(i).some(n=>n.includes(q))));
    $('#sm-catalog-count').textContent=W('count')(filtered.length);
    if(!filtered.length){holder.append(E('p',W('empty'),'sm-empty'));return;}
    for(const i of filtered){const row=E('button',null,'sm-item-row');row.type='button';row.append(E('span',iconByMaterial[i.material]||'♻️','sm-icon'));
      const m=E('span');m.append(E('span',name(i),'sm-item-row-title'),E('span',W(materialLabels[i.material]||'mixed'),'sm-item-row-sub'));
      row.append(m,E('span','›','sm-row-arrow'));row.onclick=()=>{go(8);$('#sm-q').value=name(i);select(i.id)};holder.append(row);
    }
  }
  function renderCity(){const area=$('#sm-city-list');area.replaceChildren();
    for(const row of [['🔥','cityBurn','cityBurnD'],['🧱','cityNon','cityNonD'],['♻️','cityRec','cityRecD'],['⚠️','cityHaz','cityHazD']]){
      const e=E('article',null,'sm-city-row');e.append(E('span',row[0],'sm-icon'));
      const body=E('div');body.append(E('h3',W(row[1])),E('p',W(row[2])));e.append(body);area.append(e);
    }
  }
  function refresh(){renderCatalog();renderHits();renderSelected();renderCity();if(lastResult)showOutput(lastResult,lastResult.found?'found':'notfound')}
  async function init(){
    try{const r=await fetch('/api/catalog',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);catalog=await r.json();if(!Array.isArray(catalog.items))throw Error('No catalog');}
    catch(e){showOutput(W('error'));return;}
    $('#sm-q').addEventListener('input',()=>{currentId='';currentAnswers={};lastResult=null;renderHits();renderSelected();showOutput('')});
    $('#sm-q').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();check()}});
    $('#sm-find').onclick=()=>{const matches=findItems($('#sm-q').value);if(matches.length===1)select(matches[0].id);else renderHits();$('#sm-hits').scrollIntoView({behavior:'smooth',block:'nearest'})};
    $('#sm-clear').onclick=()=>{$('#sm-q').value='';$('#sm-notes').value='';select('');};
    $('#sm-answer-btn').onclick=check;
    $('#sm-catalog-q').addEventListener('input',renderCatalog);
    const oldApplyLanguage=window.applyLanguage;
    if(typeof oldApplyLanguage==='function')window.applyLanguage=function(next){oldApplyLanguage(next);refresh();};
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
