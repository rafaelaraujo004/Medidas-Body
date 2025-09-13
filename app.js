// app.js - PWA-style single file logic
const LS_KEY = 'perimetria_records_v1';

function $(id){return document.getElementById(id)}
function qs(sel){return document.querySelector(sel)}
function qsa(sel){return Array.from(document.querySelectorAll(sel))}

let records = loadRecords();
let chart;

// Form elements
const form = $('measureForm');
const recordList = $('recordList');
const dateInput = $('date');
const pesoInput = $('peso');

// map of all measurement ids used in the form & avatar labels
const MEASURES = ['peito','cintura','quadril','abdomen','bracoD','bracoE','coxaD','coxaE','pantD','pantE'];

function makeRecordFromForm(){
  const r = {
    id: 'r'+Date.now(),
    date: dateInput.value || new Date().toISOString().slice(0,10),
    peso: parseFloat(pesoInput.value || '0'),
  };
  MEASURES.forEach(k => {
    const el = $(k);
    r[k] = el && el.value ? parseFloat(el.value) : null;
  });
  return r;
}

function saveRecords(){
  localStorage.setItem(LS_KEY, JSON.stringify(records));
}

function loadRecords(){
  const raw = localStorage.getItem(LS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function renderList(){
  recordList.innerHTML = '';
  if(records.length===0){
    recordList.innerHTML = '<li>Sem registros ainda.</li>';
    updateAvatar(null);
    updateChart();
    return;
  }
  // sort desc by date
  records.sort((a,b)=> new Date(b.date)-new Date(a.date));
  for(const r of records){
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<strong>${r.date}</strong> • ${r.peso} kg`;
    const actions = document.createElement('div');
    actions.style.display='flex';
    actions.style.gap='6px';

    const btnView = document.createElement('button');
    btnView.textContent='Ver';
    btnView.onclick = ()=> {
      updateAvatar(r);
      highlightFields(r);
    };

    const btnEdit = document.createElement('button');
    btnEdit.textContent='Editar';
    btnEdit.onclick = ()=> {
      fillForm(r);
    };

    const btnDel = document.createElement('button');
    btnDel.textContent='Apagar';
    btnDel.onclick = ()=> {
      if(confirm('Apagar registro?')) {
        records = records.filter(x=>x.id!==r.id);
        saveRecords();
        renderList();
      }
    };

    actions.append(btnView, btnEdit, btnDel);
    li.appendChild(left);
    li.appendChild(actions);
    recordList.appendChild(li);
  }
  updateChart();
}

function fillForm(r){
  dateInput.value = r.date;
  pesoInput.value = r.peso;
  MEASURES.forEach(k => {
    if(r[k] != null) $(k).value = r[k];
    else $(k).value = '';
  });
  // focus save
  window.scrollTo({top:0,behavior:'smooth'});
}

function highlightFields(r){
  // temporarily show values in the form fields as preview
  MEASURES.forEach(k=>{
    const el = $(k);
    if(!el) return;
    el.value = r[k] != null ? r[k] : '';
  });
  $('peso').value = r.peso;
  $('date').value = r.date;
}

function updateAvatar(r){
  // update SVG text nodes
  const setText = (id, v) => {
    const el = document.getElementById('label-'+id);
    if(!el) return;
    el.textContent = `${id === 'peso' ? 'Peso' : (id === 'bracoD' ? 'BD' : id === 'bracoE' ? 'BE' : id === 'coxaD' ? 'CD' : id === 'coxaE' ? 'CE' : id === 'pantD' ? 'PD' : id === 'pantE' ? 'PE' : id )}: ${v ?? '-'}${id==='peso' ? ' kg' : ' cm'}`;
  };

  if(!r){
    // clear
    setText('peito', null); setText('cintura', null); setText('quadril', null);
    setText('bracoD', null); setText('bracoE', null); setText('coxaD', null); setText('coxaE', null);
    setText('pantD', null); setText('pantE', null); setText('peso', null);
    return;
  }

  setText('peito', r.peito);
  setText('cintura', r.cintura);
  setText('quadril', r.quadril);
  setText('bracoD', r.bracoD);
  setText('bracoE', r.bracoE);
  setText('coxaD', r.coxaD);
  setText('coxaE', r.coxaE);
  setText('pantD', r.pantD);
  setText('pantE', r.pantE);
  setText('peso', r.peso);
}

form.addEventListener('submit', e=>{
  e.preventDefault();
  const newR = makeRecordFromForm();
  // if id exists -> update; else insert
  const existingIndex = records.findIndex(x=>x.date === newR.date); // one record per date policy
  if(existingIndex >= 0){
    // merge but keep id
    newR.id = records[existingIndex].id;
    records[existingIndex] = newR;
  } else {
    records.push(newR);
  }
  saveRecords();
  renderList();
  updateAvatar(newR);
  form.reset();
});

$('clearAll').addEventListener('click', ()=>{
  if(confirm('Apagar TODOS os registros?')) {
    records = [];
    saveRecords();
    renderList();
    updateAvatar(null);
  }
});

// Export
$('exportCSV').addEventListener('click', ()=>{
  if(records.length===0){alert('Sem registros');return;}
  const cols = ['date','peso',...MEASURES];
  const lines = [cols.join(',')];
  for(const r of records){
    lines.push(cols.map(c=>r[c] ?? '').join(','));
  }
  const blob = new Blob([lines.join('\n')],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download='perimetria.csv'; a.click();
  URL.revokeObjectURL(url);
});
$('exportJSON').addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(records,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download='perimetria.json'; a.click();
  URL.revokeObjectURL(url);
});

// Chart
function updateChart(){
  const ctx = $('chartMeasures').getContext('2d');
  if(chart) chart.destroy();
  if(records.length===0){
    chart = new Chart(ctx,{type:'line',data:{labels:[],datasets:[]},options:{}});
    return;
  }
  // sort by date asc for chart
  const rows = [...records].sort((a,b)=> new Date(a.date)-new Date(b.date));
  const labels = rows.map(r=>r.date);

  const selected = qsa('.ch-measure:checked').map(c=>c.value);
  const datasets = selected.map((key, idx) => {
    return {
      label: key,
      data: rows.map(r=> r[key] != null ? r[key] : null),
      spanGaps: true,
      borderWidth: 2,
      tension: 0.25,
    };
  });

  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive:true,
      interaction:{mode:'index',intersect:false},
      stacked:false,
      plugins:{legend:{position:'bottom'}}
    }
  });
}

qsa('.ch-measure').forEach(ch => ch.addEventListener('change', updateChart));

/* initialize */
renderList();
updateChart();

/* Smart feature ideas (quick comments in code):
 - auto-suggest targets based on %Gordura and massa magra (use formula)
 - anomaly detection: if new measure deviates > X% from last => show note
 - compare left/right symmetry and score (0-100)
 - OCR hook: allow upload photo of paper, call OCR service to auto-fill fields (future)
*/
