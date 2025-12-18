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

// Set today's date by default
function initDateField(){
  if(!dateInput.value){
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

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
    recordList.innerHTML = '<li style="text-align:center;color:#999;font-style:italic;">📝 Nenhum registro ainda. Comece preenchendo o formulário acima!</li>';
    updateAvatar(null);
    updateChart();
    return;
  }
  // sort desc by date
  records.sort((a,b)=> new Date(b.date)-new Date(a.date));
  for(const r of records){
    const li = document.createElement('li');
    const left = document.createElement('div');
    
    // Format date
    const dateObj = new Date(r.date + 'T00:00:00');
    const dateFormatted = dateObj.toLocaleDateString('pt-BR', {day:'2-digit', month:'short', year:'numeric'});
    
    left.innerHTML = `<strong>📅 ${dateFormatted}</strong> • ⚖️ ${r.peso} kg`;
    const actions = document.createElement('div');
    actions.style.display='flex';
    actions.style.gap='6px';

    const btnView = document.createElement('button');
    btnView.textContent='👁️ Ver';
    btnView.style.background='#3498db';
    btnView.style.fontSize='12px';
    btnView.style.padding='6px 10px';
    btnView.title='Visualizar medidas no avatar';
    btnView.onclick = ()=> {
      updateAvatar(r);
      highlightFields(r);
      // Scroll to avatar
      $('avatarWrap').scrollIntoView({behavior:'smooth', block:'center'});
    };

    const btnEdit = document.createElement('button');
    btnEdit.textContent='✏️ Editar';
    btnEdit.style.background='#f39c12';
    btnEdit.style.fontSize='12px';
    btnEdit.style.padding='6px 10px';
    btnEdit.title='Editar este registro';
    btnEdit.onclick = ()=> {
      fillForm(r);
      window.scrollTo({top:0,behavior:'smooth'});
    };

    const btnDel = document.createElement('button');
    btnDel.textContent='🗑️';
    btnDel.style.background='#e74c3c';
    btnDel.style.fontSize='12px';
    btnDel.style.padding='6px 10px';
    btnDel.title='Apagar este registro';
    btnDel.onclick = ()=> {
      if(confirm('❌ Tem certeza que deseja apagar este registro?\n\nEsta ação não pode ser desfeita.')) {
        records = records.filter(x=>x.id!==r.id);
        saveRecords();
        renderList();
        showNotification('✅ Registro apagado com sucesso!');
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
  // update SVG text nodes com labels separados
  const setText = (id, v) => {
    const valorEl = document.getElementById('label-'+id+'-valor');
    if(!valorEl) return;
    
    if(id === 'peso') {
      valorEl.textContent = v ? `${v} kg` : '- kg';
    } else {
      valorEl.textContent = v ? `${v} cm` : '- cm';
    }
  };

  if(!r){
    // clear
    setText('peito', null); setText('cintura', null); setText('quadril', null); setText('abdomen', null);
    setText('bracoD', null); setText('bracoE', null); setText('coxaD', null); setText('coxaE', null);
    setText('pantD', null); setText('pantE', null); setText('peso', null);
    resetAvatarScale();
    return;
  }

  setText('peito', r.peito);
  setText('cintura', r.cintura);
  setText('quadril', r.quadril);
  setText('abdomen', r.abdomen);
  setText('bracoD', r.bracoD);
  setText('bracoE', r.bracoE);
  setText('coxaD', r.coxaD);
  setText('coxaE', r.coxaE);
  setText('pantD', r.pantD);
  setText('pantE', r.pantE);
  setText('peso', r.peso);
  
  // Atualizar proporções do corpo
  updateBodyProportions(r);
}

// Função para atualizar proporções do corpo em tempo real
function updateBodyProportions(data) {
  // Valores base para referência (medidas médias)
  const baseValues = {
    peito: 100,
    cintura: 80,
    abdomen: 85,
    quadril: 95,
    bracoD: 35,
    bracoE: 35,
    coxaD: 55,
    coxaE: 55,
    pantD: 38,
    pantE: 38
  };
  
  // Função para calcular escala (limita entre 0.6 e 1.8 para manter proporções visuais)
  const calcScale = (value, base, factor = 1) => {
    if (!value || value <= 0) return 1;
    const scale = (value / base) * factor;
    return Math.max(0.6, Math.min(1.8, scale));
  };
  
  // Atualizar Peito
  if (data.peito) {
    const scaleX = calcScale(data.peito, baseValues.peito, 1.2);
    const peitoEsq = document.getElementById('peitoral-esq');
    const peitoDir = document.getElementById('peitoral-dir');
    if (peitoEsq) peitoEsq.setAttribute('rx', 18 * scaleX);
    if (peitoDir) peitoDir.setAttribute('rx', 18 * scaleX);
  }
  
  // Atualizar Cintura
  if (data.cintura) {
    const scaleX = calcScale(data.cintura, baseValues.cintura, 1.1);
    const cintura = document.getElementById('cintura-core');
    if (cintura) {
      const newWidth = 30 * scaleX;
      cintura.setAttribute('width', newWidth);
      cintura.setAttribute('x', 100 - newWidth/2);
    }
  }
  
  // Atualizar Abdômen
  if (data.abdomen) {
    const scaleX = calcScale(data.abdomen, baseValues.abdomen, 1.1);
    const abdomen = document.getElementById('abdomen-core');
    if (abdomen) {
      const newWidth = 40 * scaleX;
      abdomen.setAttribute('width', newWidth);
      abdomen.setAttribute('x', 100 - newWidth/2);
    }
  }
  
  // Atualizar Quadril
  if (data.quadril) {
    const scale = calcScale(data.quadril, baseValues.quadril, 1.15);
    const quadril = document.getElementById('quadril-shape');
    if (quadril) quadril.setAttribute('rx', 24 * scale);
  }
  
  // Atualizar Braço Direito
  if (data.bracoD) {
    const scale = calcScale(data.bracoD, baseValues.bracoD, 1.0);
    const bicepsD = document.getElementById('biceps-d');
    const antebracoD = document.getElementById('antebraco-d');
    if (bicepsD) bicepsD.setAttribute('rx', 13 * scale);
    if (antebracoD) antebracoD.setAttribute('rx', 11 * scale);
  }
  
  // Atualizar Braço Esquerdo
  if (data.bracoE) {
    const scale = calcScale(data.bracoE, baseValues.bracoE, 1.0);
    const bicepsE = document.getElementById('biceps-e');
    const antebracoE = document.getElementById('antebraco-e');
    if (bicepsE) bicepsE.setAttribute('rx', 13 * scale);
    if (antebracoE) antebracoE.setAttribute('rx', 11 * scale);
  }
  
  // Atualizar Coxa Direita
  if (data.coxaD) {
    const scale = calcScale(data.coxaD, baseValues.coxaD, 1.0);
    const coxaD = document.getElementById('coxa-d');
    if (coxaD) coxaD.setAttribute('rx', 16 * scale);
  }
  
  // Atualizar Coxa Esquerda
  if (data.coxaE) {
    const scale = calcScale(data.coxaE, baseValues.coxaE, 1.0);
    const coxaE = document.getElementById('coxa-e');
    if (coxaE) coxaE.setAttribute('rx', 16 * scale);
  }
  
  // Atualizar Panturrilha Direita
  if (data.pantD) {
    const scale = calcScale(data.pantD, baseValues.pantD, 1.0);
    const pantDTop = document.getElementById('pant-d-top');
    const pantDBot = document.getElementById('pant-d-bot');
    if (pantDTop) pantDTop.setAttribute('rx', 13 * scale);
    if (pantDBot) pantDBot.setAttribute('rx', 11 * scale);
  }
  
  // Atualizar Panturrilha Esquerda
  if (data.pantE) {
    const scale = calcScale(data.pantE, baseValues.pantE, 1.0);
    const pantETop = document.getElementById('pant-e-top');
    const pantEBot = document.getElementById('pant-e-bot');
    if (pantETop) pantETop.setAttribute('rx', 13 * scale);
    if (pantEBot) pantEBot.setAttribute('rx', 11 * scale);
  }
}

// Função para resetar as escalas do avatar
function resetAvatarScale() {
  // Resetar para valores padrão
  const defaults = {
    'peitoral-esq': {rx: 18}, 'peitoral-dir': {rx: 18},
    'cintura-core': {width: 30, x: 85},
    'abdomen-core': {width: 40, x: 80},
    'quadril-shape': {rx: 24},
    'biceps-d': {rx: 13}, 'antebraco-d': {rx: 11},
    'biceps-e': {rx: 13}, 'antebraco-e': {rx: 11},
    'coxa-d': {rx: 16}, 'coxa-e': {rx: 16},
    'pant-d-top': {rx: 13}, 'pant-d-bot': {rx: 11},
    'pant-e-top': {rx: 13}, 'pant-e-bot': {rx: 11}
  };
  
  for (const [id, attrs] of Object.entries(defaults)) {
    const el = document.getElementById(id);
    if (el) {
      for (const [attr, value] of Object.entries(attrs)) {
        el.setAttribute(attr, value);
      }
    }
  }
}

// Notification system
function showNotification(message, type='success'){
  const notif = document.createElement('div');
  notif.textContent = message;
  notif.style.cssText = `
    position:fixed;
    top:20px;
    right:20px;
    background:${type==='success'?'#27ae60':'#e74c3c'};
    color:white;
    padding:12px 20px;
    border-radius:8px;
    box-shadow:0 4px 12px rgba(0,0,0,0.2);
    z-index:10000;
    font-weight:600;
    animation:slideIn 0.3s ease;
  `;
  document.body.appendChild(notif);
  setTimeout(()=>{
    notif.style.animation='slideOut 0.3s ease';
    setTimeout(()=>notif.remove(), 300);
  }, 3000);
}

form.addEventListener('submit', e=>{
  e.preventDefault();
  const newR = makeRecordFromForm();
  // if id exists -> update; else insert
  const existingIndex = records.findIndex(x=>x.date === newR.date); // one record per date policy
  let isUpdate = false;
  if(existingIndex >= 0){
    // merge but keep id
    newR.id = records[existingIndex].id;
    records[existingIndex] = newR;
    isUpdate = true;
  } else {
    records.push(newR);
  }
  saveRecords();
  renderList();
  updateAvatar(newR);
  form.reset();
  initDateField(); // Reset date to today
  
  // Show success message
  if(isUpdate){
    showNotification('✅ Registro atualizado com sucesso!');
  } else {
    showNotification('✅ Novo registro salvo com sucesso!');
  }
  
  // Scroll to records
  $('records').scrollIntoView({behavior:'smooth', block:'start'});
});

$('clearAll').addEventListener('click', ()=>{
  if(records.length === 0){
    showNotification('ℹ️ Não há registros para apagar', 'info');
    return;
  }
  if(confirm(`⚠️ ATENÇÃO!\n\nVocê está prestes a apagar TODOS os ${records.length} registro(s).\n\nEsta ação é irreversível!\n\nDeseja continuar?`)) {
    records = [];
    saveRecords();
    renderList();
    updateAvatar(null);
    showNotification('✅ Todos os registros foram apagados');
  }
});

// Export
$('exportCSV').addEventListener('click', ()=>{
  if(records.length===0){
    showNotification('ℹ️ Não há registros para exportar', 'info');
    return;
  }
  const cols = ['date','peso',...MEASURES];
  const lines = [cols.join(',')];
  for(const r of records){
    lines.push(cols.map(c=>r[c] ?? '').join(','));
  }
  const blob = new Blob([lines.join('\n')],{type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `medidas_corporais_${new Date().toISOString().split('T')[0]}.csv`;
  a.href = url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
  showNotification('✅ Arquivo CSV baixado com sucesso!');
});
$('exportJSON').addEventListener('click', ()=>{
  if(records.length===0){
    showNotification('ℹ️ Não há registros para exportar', 'info');
    return;
  }
  const blob = new Blob([JSON.stringify(records,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `medidas_corporais_${new Date().toISOString().split('T')[0]}.json`;
  a.href = url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
  showNotification('✅ Arquivo JSON baixado com sucesso!');
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

// Atualização em tempo real do avatar enquanto digita
function setupRealTimeUpdate() {
  const inputs = ['peso', 'peito', 'cintura', 'abdomen', 'bracoD', 'bracoE', 'coxaD', 'coxaE', 'pantD', 'pantE'];
  
  inputs.forEach(id => {
    const input = $(id);
    if (input) {
      input.addEventListener('input', () => {
        const currentData = {};
        inputs.forEach(k => {
          const el = $(k);
          if (el && el.value) {
            currentData[k] = parseFloat(el.value);
          }
        });
        updateBodyProportions(currentData);
        
        // Atualizar labels com valores separados
        inputs.forEach(k => {
          const el = $(k);
          if (el) {
            const valorEl = document.getElementById('label-' + k + '-valor');
            if (valorEl) {
              const val = el.value;
              if (k === 'peso') {
                valorEl.textContent = val ? `${val} kg` : '- kg';
              } else {
                valorEl.textContent = val ? `${val} cm` : '- cm';
              }
            }
          }
        });
      });
    }
  });
}

/* initialize */
renderList();
updateChart();
initDateField();
setupRealTimeUpdate();

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Welcome Guide functionality
const GUIDE_SEEN_KEY = 'perimetria_guide_seen';
const welcomeGuide = document.getElementById('welcomeGuide');
const closeGuideBtn = document.getElementById('closeGuide');
const gotItBtn = document.getElementById('gotItBtn');
const helpButton = document.getElementById('helpButton');

function showGuide() {
  if (welcomeGuide) {
    welcomeGuide.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function hideGuide() {
  if (welcomeGuide) {
    welcomeGuide.classList.add('hidden');
    document.body.style.overflow = '';
    localStorage.setItem(GUIDE_SEEN_KEY, 'true');
  }
}

// Show guide on first visit
if (!localStorage.getItem(GUIDE_SEEN_KEY)) {
  setTimeout(showGuide, 500);
}

// Event listeners
if (closeGuideBtn) {
  closeGuideBtn.addEventListener('click', hideGuide);
}

if (gotItBtn) {
  gotItBtn.addEventListener('click', hideGuide);
}

if (helpButton) {
  helpButton.addEventListener('click', showGuide);
}

// Close guide when clicking outside
if (welcomeGuide) {
  welcomeGuide.addEventListener('click', (e) => {
    if (e.target === welcomeGuide) {
      hideGuide();
    }
  });
}

// Quick Guide Toggle functionality
const quickGuideToggle = document.getElementById('quickGuideToggle');
const quickGuideCard = document.querySelector('.quick-guide-card');
const QUICK_GUIDE_STATE_KEY = 'perimetria_quick_guide_state';

function toggleQuickGuide() {
  if (quickGuideCard) {
    quickGuideCard.classList.toggle('collapsed');
    const isCollapsed = quickGuideCard.classList.contains('collapsed');
    localStorage.setItem(QUICK_GUIDE_STATE_KEY, isCollapsed ? 'collapsed' : 'expanded');
  }
}

// Restore previous state
if (quickGuideCard) {
  const savedState = localStorage.getItem(QUICK_GUIDE_STATE_KEY);
  if (savedState === 'collapsed') {
    quickGuideCard.classList.add('collapsed');
  }
}

// Add click listener
if (quickGuideToggle) {
  quickGuideToggle.addEventListener('click', toggleQuickGuide);
}

/* Smart feature ideas (quick comments in code):
 - auto-suggest targets based on %Gordura and massa magra (use formula)
 - anomaly detection: if new measure deviates > X% from last => show note
 - compare left/right symmetry and score (0-100)
 - OCR hook: allow upload photo of paper, call OCR service to auto-fill fields (future)
*/
