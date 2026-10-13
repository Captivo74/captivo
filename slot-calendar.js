// ============================================================
// CAPTIVO — Calendrier des créneaux (photographe + client)
// Jour grisé = aucun créneau · point vert = créneau(x) disponible(s)
// Case rouge = tous les créneaux du jour sont pris
// ============================================================

var SLOT_CAL_STATE = {};
var SC_MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var SC_MONTHS_SHORT = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.'];
var SC_WEEKDAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
var SC_DAYS_LONG = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

function scPad(n){ return (n<10?'0':'')+n; }
function scKey(y, m, d){ return y + '-' + scPad(m+1) + '-' + scPad(d); }
function scToday(){ const t = new Date(); return scKey(t.getFullYear(), t.getMonth(), t.getDate()); }

// Heure d'un créneau : colonne slot_time, sinon extraite du libellé (anciens créneaux)
function scSlotTime(s){
  if(s.slot_time) return s.slot_time;
  const m = /(\d{1,2})[:h](\d{2})\s*$/.exec(s.label || '');
  return m ? scPad(parseInt(m[1],10)) + ':' + m[2] : '';
}

function scGroupByDate(slots){
  const map = {};
  (slots || []).forEach(s=>{
    if(!s.slot_date) return;
    (map[s.slot_date] = map[s.slot_date] || []).push(s);
  });
  Object.keys(map).forEach(k=> map[k].sort((a,b)=> scSlotTime(a).localeCompare(scSlotTime(b))));
  return map;
}

function scLongDate(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  return SC_DAYS_LONG[d.getDay()] + ' ' + d.getDate() + ' ' + SC_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

/*
  mountSlotCalendar(container, cfg)
    cfg.key          identifiant (mémorise mois / jour choisis entre deux affichages)
    cfg.mode         'photographer' | 'client'
    cfg.getSlots()   renvoie la liste des créneaux à afficher
    cfg.renderDetail(detailEl, dateStr, daySlots, redraw)   contenu affiché sous le calendrier
*/
function mountSlotCalendar(container, cfg){
  const now = new Date();
  const st = SLOT_CAL_STATE[cfg.key] = SLOT_CAL_STATE[cfg.key] || { year: now.getFullYear(), month: now.getMonth(), selected: null };
  const isPhotographer = cfg.mode === 'photographer';

  function draw(){
    const byDate = scGroupByDate(cfg.getSlots());
    const today = scToday();
    const first = new Date(st.year, st.month, 1);
    const offset = (first.getDay() + 6) % 7; // lundi = 0
    const nbDays = new Date(st.year, st.month + 1, 0).getDate();

    let cells = '';
    for(let i = 0; i < offset; i++) cells += '<div class="sc-cell sc-empty"></div>';
    for(let d = 1; d <= nbDays; d++){
      const key = scKey(st.year, st.month, d);
      const list = byDate[key] || [];
      const past = key < today;
      const free = list.filter(s=>!s.booked).length;
      let cls = 'sc-none', dot = '', title = 'Aucun créneau';
      if(list.length && free > 0){ cls = 'sc-free'; dot = '<i class="sc-dot"></i>'; title = free + ' créneau' + (free>1?'x':'') + ' disponible' + (free>1?'s':''); }
      else if(list.length){ cls = 'sc-full'; title = 'Complet'; }
      const clickable = !past && (isPhotographer || list.length > 0);
      cells += '<button type="button" class="sc-cell ' + cls + (past ? ' sc-past' : '') + (key === today ? ' sc-today' : '') + (st.selected === key ? ' sc-selected' : '') + '"'
        + (clickable ? '' : ' disabled') + ' data-date="' + key + '" title="' + title + '" aria-label="' + d + ' ' + SC_MONTHS[st.month] + ' — ' + title + '">'
        + '<span>' + d + '</span>' + dot + '</button>';
    }

    const chips = SC_MONTHS_SHORT.map((n, i)=>
      '<button type="button" class="sc-chip' + (i === st.month ? ' active' : '') + '" data-month="' + i + '">' + n + '</button>').join('');

    container.innerHTML =
      '<div class="sc-wrap">'
      + '<div class="sc-year"><button type="button" class="sc-nav" data-year="-1" aria-label="Année précédente">‹</button><b>' + st.year + '</b><button type="button" class="sc-nav" data-year="1" aria-label="Année suivante">›</button></div>'
      + '<div class="sc-chips">' + chips + '</div>'
      + '<div class="sc-month-title">' + SC_MONTHS[st.month].charAt(0).toUpperCase() + SC_MONTHS[st.month].slice(1) + ' ' + st.year + '</div>'
      + '<div class="sc-grid sc-head">' + SC_WEEKDAYS.map(w=>'<div>' + w + '</div>').join('') + '</div>'
      + '<div class="sc-grid">' + cells + '</div>'
      + '<div class="sc-legend"><span><i class="sc-dot"></i> Disponible</span><span><i class="sc-sw sc-sw-full"></i> Complet</span><span><i class="sc-sw sc-sw-none"></i> Aucun créneau</span></div>'
      + '<div class="sc-detail" id="sc-detail-' + cfg.key + '"></div>'
      + '</div>';

    container.querySelectorAll('[data-month]').forEach(b=> b.onclick = ()=>{ st.month = parseInt(b.dataset.month, 10); st.selected = null; draw(); });
    container.querySelectorAll('[data-year]').forEach(b=> b.onclick = ()=>{ st.year += parseInt(b.dataset.year, 10); st.selected = null; draw(); });
    container.querySelectorAll('.sc-cell[data-date]').forEach(b=> b.onclick = ()=>{
      st.selected = (st.selected === b.dataset.date) ? null : b.dataset.date;
      draw();
    });

    if(st.selected){
      const detail = container.querySelector('.sc-detail');
      cfg.renderDetail(detail, st.selected, byDate[st.selected] || [], draw);
    }
  }

  draw();
  return { redraw: draw };
}
