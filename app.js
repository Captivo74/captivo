/* ---------------- DATA ---------------- */
/* ---------------- RÉSEAUX SOCIAUX ---------------- */
/* Remplace ces liens par les comptes réels de Captivo */
var socialLinks = {
  instagram: "https://www.instagram.com/captivo.contact?igsh=ZDJoZmdkYmZ1bm95",
  tiktok: "https://www.tiktok.com/@captivo0?_r=1&_t=ZN-982WDLelR8I",
  discord: "https://discord.gg/Jz4w6jhCVU",
};
document.getElementById('social-instagram').href = socialLinks.instagram;
document.getElementById('social-tiktok').href = socialLinks.tiktok;
document.getElementById('social-discord').href = socialLinks.discord;

/* ---------------- CONNEXION SUPABASE (vraie base de données) ---------------- */
var SUPABASE_URL = "https://pieyxpbfjjpshzyevdxu.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_Dmpuq5e7RcVHxg_A7T5p6w_gdetzdd4";

var supabase;
try{
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch(e){
  console.error('Connexion Supabase impossible au chargement :', e);
  const unavailableError = { message: "Connexion à la base de données indisponible. Vérifiez votre connexion internet et rechargez la page." };
  const bannerHtml = `<div style="background:#B23A3A;color:#fff;text-align:center;padding:10px;font-size:13.5px;font-weight:600;position:fixed;top:0;left:0;right:0;z-index:9999;">⚠ ${unavailableError.message}</div>`;
  document.addEventListener('DOMContentLoaded', ()=>{ document.body.insertAdjacentHTML('afterbegin', bannerHtml); });
  const fail = async () => ({ data:null, error:unavailableError });
  const chain = { select:()=>chain, insert:()=>chain, update:()=>chain, delete:()=>chain, eq:()=>chain, in:()=>chain, order:()=>chain, single:()=>chain, maybeSingle:()=>chain, then:(res)=>fail().then(res) };
  supabase = {
    from:()=>chain,
    storage:{ from:()=>({ upload:fail, getPublicUrl:()=>({data:{publicUrl:''}}), remove:fail }) },
    auth:{
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
      signUp:fail, signInWithPassword:fail, signOut:async()=>({error:null}),
      resetPasswordForEmail:fail, updateUser:fail
    }
  };
}

var photographers = [];

function mapDbPhotographer(row){
  return {
    id: row.id, user_id: row.user_id, name: row.name, city: row.city, style: row.style,
    styles: (row.styles && row.styles.length) ? row.styles : [row.style],
    rate: row.rate, prices: row.prices || {}, rating: row.rating, bio: row.bio, initials: row.initials, color: row.color,
    verification_status: row.verification_status || 'unverified',
    verification_siret: row.verification_siret || '',
    verification_note: row.verification_note || '',
    slots: (row.slots || []).map(s=>({id:s.id, label:s.label}))
  };
}

async function loadPhotographersFromDB(){
  try{
    const { data, error } = await supabase.from('photographers').select('*, slots(*)');
    if(error){ console.warn('Chargement photographes impossible :', error.message); return; }
    photographers.length = 0;
    photographers.push(...data.map(mapDbPhotographer));

    const { data: photos } = await supabase.from('photographer_photos').select('photographer_id, url, created_at').order('created_at');
    const { data: reviewsAll } = await supabase.from('reviews').select('photographer_id, rating');

    photographers.forEach(p=>{
      const firstPhoto = (photos||[]).find(ph=>ph.photographer_id===p.id);
      p.cover_photo = firstPhoto ? firstPhoto.url : null;
      const myReviews = (reviewsAll||[]).filter(r=>r.photographer_id===p.id);
      p.review_count = myReviews.length;
      if(myReviews.length){
        p.rating = Math.round((myReviews.reduce((s,r)=>s+r.rating,0)/myReviews.length)*10)/10;
      }
    });

    if(document.getElementById('results-view').style.display==='block') runSearch();
  } catch(e){ console.warn('Connexion Supabase impossible :', e); }
}
loadPhotographersFromDB();

supabase.auth.onAuthStateChange(async (event, session)=>{
  if(event === 'PASSWORD_RECOVERY') openSetNewPassword();

  // Filet de sécurité : si Supabase reconnecte automatiquement la personne au retour
  // du lien de confirmation email (comportement par défaut selon la configuration du
  // projet), on en profite pour créer sa fiche photographe tout de suite, sans qu'elle
  // ait besoin de comprendre qu'il fallait "se reconnecter manuellement".
  if(event === 'SIGNED_IN' && session){
    try{
      const pendingRaw = localStorage.getItem('captivo_pending_photographer');
      if(pendingRaw){
        const pending = JSON.parse(pendingRaw);
        if(pending.email === session.user.email){
          localStorage.removeItem('captivo_pending_photographer');
          const photographerRef = await fetchOrCreatePhotographerProfile(
            session.user.id, pending.name, pending.city, pending.styles, pending.email
          );
          const existingIdx = photographers.findIndex(x=>x.id===photographerRef.id);
          if(existingIdx>=0) photographers[existingIdx] = photographerRef;
          else photographers.push(photographerRef);
          if(!currentUser){
            currentUser = { type:'photographer', id: session.user.id, name: photographerRef.name, email: pending.email, photographerRef };
            renderHeader();
          }
        }
      }
    } catch(e){ console.warn('Création automatique du profil impossible :', e); }
  }
});

var styleIcons = {
  "Mariage":"M12 21s-7-4.6-7-10a5 5 0 0110-1 5 5 0 0110 1c0 5.4-7 10-7 10z",
  "Portrait":"M12 12a4 4 0 100-8 4 4 0 000 8zM5 21a7 7 0 0114 0",
  "Famille":"M12 11a3 3 0 100-6 3 3 0 000 6zM5 21a4 4 0 018 0M19 21a4 4 0 00-6-3.5M17 11a2.5 2.5 0 100-5",
  "Grossesse":"M9 3a3 3 0 116 0c0 5 4 4 4 10a7 7 0 01-14 0c0-4 2-5 4-10z",
  "Événementiel":"M4 4h16v16H4zM4 9h16M9 4v5",
  "Corporate":"M4 21V8l8-4 8 4v13M9 21v-6h6v6",
  "Immobilier":"M3 11l9-7 9 7M5 10v10h14V10",
  "Mode":"M8 3l4 3 4-3 3 4-3 3v10H8V7L5 4z",
  "Culinaire":"M6 3v7a2 2 0 002 2v9M10 3v9M14 3c-2 0-2 4 0 6s2 4 0 12",
  "Sport":"M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18",
  "Architecture":"M4 21V9l8-6 8 6v12M9 21v-6h6v6M9 12h6",
  "Paysage":"M3 18l6-8 4 5 3-4 5 7H3z",
  "Nature":"M12 2C8 6 5 10 5 14a7 7 0 0014 0c0-4-3-8-7-12z",
  "Nouveau-né":"M12 21c4-2 7-5 7-9a7 7 0 00-14 0c0 4 3 7 7 9z",
  "Vidéaste":"M15 10l5-3v10l-5-3zM3 6h11a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V7a1 1 0 011-1z",
};
var styleDescriptions = {
  "Mariage":"Cérémonie, préparatifs, soirée",
  "Portrait":"Individuel, duo, studio",
  "Famille":"Séances en extérieur ou à domicile",
  "Grossesse":"Séances cocooning avant l'arrivée",
  "Événementiel":"Soirées, concerts, séminaires",
  "Corporate":"Portraits pro, équipes, LinkedIn",
  "Immobilier":"Biens, intérieurs, drone",
  "Mode":"Lookbook, éditorial, portfolio",
  "Culinaire":"Restaurants, recettes, packaging",
  "Sport":"Compétitions, performance, action",
  "Architecture":"Bâtiments, intérieurs, urbanisme",
  "Paysage":"Nature, voyage, extérieurs",
  "Nature":"Faune, flore, macro",
  "Nouveau-né":"Séances douces les premiers jours",
  "Vidéaste":"Films de mariage, clips, reportages",
};
var stylesGrid = document.getElementById('styles-grid');
Object.keys(styleIcons).forEach(s=>{
  const d = document.createElement('div');
  d.className='style-card';
  d.innerHTML = `<div class="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="${styleIcons[s]}"/></svg></div><span>${s}</span><p class="style-desc">${styleDescriptions[s]||''}</p>`;
  d.onclick = ()=>{ document.getElementById('q-name').value=''; document.getElementById('q-city').value=''; searchByStyle(s); };
  stylesGrid.appendChild(d);
});

var styleSelect = document.getElementById('q-style');
Object.keys(styleIcons).forEach(s=>{
  const opt = document.createElement('option');
  opt.value = s; opt.textContent = s;
  styleSelect.appendChild(opt);
});
styleSelect.addEventListener('change', runSearch);

// Empêche toute donnée saisie par un utilisateur (nom, bio, avis, message...) d'être
// interprétée comme du code HTML quand elle est affichée à d'autres visiteurs.
function escapeHtml(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// Affiche une liste de styles de façon compacte : "Mariage, Portrait" ou "Mariage, Portrait +2"
function formatStyles(stylesArr){
  const arr = (stylesArr && stylesArr.length) ? stylesArr : [];
  if(!arr.length) return '';
  if(arr.length <= 2) return arr.join(', ');
  return arr.slice(0,2).join(', ') + ' +' + (arr.length - 2);
}

// Calcule un résumé court du tarif le plus bas parmi tous les styles renseignés (ex. "Dès 120€")
function summarizeLowestPrice(prices){
  const values = Object.values(prices || {})
    .map(v => parseFloat(String(v).replace(/[^\d.,]/g,'').replace(',','.')))
    .filter(n => !isNaN(n) && n > 0);
  if(!values.length) return 'Tarifs sur demande';
  return `Dès ${Math.min(...values)}€`;
}

function normalize(s){ return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

function levenshtein(a, b){
  const m = a.length, n = b.length;
  const dp = Array.from({length:m+1}, (_,i)=>[i, ...new Array(n).fill(0)]);
  for(let j=0;j<=n;j++) dp[0][j]=j;
  for(let i=1;i<=m;i++){
    for(let j=1;j<=n;j++){
      dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp[m][n];
}

function fuzzyIncludes(text, query){
  if(!query) return true;
  if(text.includes(query)) return true;
  if(query.length < 3) return false; // trop court pour tolérer une faute sans faux positifs
  const maxDist = query.length <= 5 ? 1 : 2;
  const minWin = Math.max(1, query.length-1), maxWin = query.length+1;
  for(let winLen=minWin; winLen<=maxWin; winLen++){
    for(let i=0; i+winLen<=text.length; i++){
      if(levenshtein(text.substr(i,winLen), query) <= maxDist) return true;
    }
  }
  return false;
}

function searchByStyle(style){
  document.getElementById('q-style').value = style;
  runSearch();
}

function runSearch(){
  const name = normalize(document.getElementById('q-name').value.trim());
  const city = normalize(document.getElementById('q-city').value.trim());
  const style = document.getElementById('q-style').value;
  if(!name && !city && !style){ showHome(); return; }
  const filtered = photographers.filter(p=>{
    const okName = name ? fuzzyIncludes(normalize(p.name), name) : true;
    const okCity = city ? fuzzyIncludes(normalize(p.city), city) : true;
    const okStyle = style ? (p.styles || [p.style]).includes(style) : true;
    return okName && okCity && okStyle;
  });
  const parts = [];
  if(document.getElementById('q-name').value.trim()) parts.push(`« ${document.getElementById('q-name').value} »`);
  if(document.getElementById('q-city').value.trim()) parts.push(document.getElementById('q-city').value);
  if(style) parts.push(`style « ${style} »`);
  const label = parts.join(' — ') || 'tous les photographes';
  renderResults(filtered, label);
}
['q-name','q-city'].forEach(id=>{
  document.getElementById(id).addEventListener('input', runSearch);
});

var lastMainView = 'home';

function renderResults(list, label){
  lastMainView = 'results';
  document.getElementById('home-content').style.display='none';
  document.getElementById('results-view').style.display='block';
  document.getElementById('results-title').textContent = list.length ? `Photographes — ${label}` : `Aucun résultat pour ${label}`;
  document.getElementById('results-count').textContent = list.length ? `${list.length} photographe${list.length>1?'s':''} trouvé${list.length>1?'s':''}` : '';
  const grid = document.getElementById('results-grid');
  grid.innerHTML='';
  if(!list.length){
    grid.innerHTML = `<div class="no-results" style="grid-column:1/-1;"><h3>Pas encore de tirage pour cette recherche</h3><p>Essayez un autre nom, ou une ville voisine.</p></div>`;
    return;
  }
  list.forEach((p,i)=>{
    const card = document.createElement('div');
    card.className='pcard';
    card.style.animationDelay = (i*0.05)+'s';
    card.innerHTML = `
      <div class="cover" style="${p.cover_photo ? `background-image:url('${p.cover_photo}');background-size:cover;background-position:center;` : `background:${p.color}`}">${p.cover_photo ? '' : p.initials}<div class="badge">★ ${p.rating}${p.review_count ? ` (${p.review_count})` : ''}</div></div>
      <div class="body">
        <p class="name">${escapeHtml(p.name)}${p.verification_status==='verified' ? ' <span class="verified-badge" title="Identité vérifiée">✓ Vérifié</span>' : ''}</p>
        <p class="city">📍 ${escapeHtml(p.city)} — ${escapeHtml(formatStyles(p.styles))}</p>
        <div class="meta"><span>${summarizeLowestPrice(p.prices)}</span><span class="rate" style="cursor:pointer">Voir profil</span></div>
        <button class="book-btn">Réserver un créneau</button>
      </div>`;
    card.querySelector('.rate').onclick = ()=> showProfilePage(p.name);
    card.querySelector('.book-btn').onclick = ()=> showProfilePage(p.name);
    grid.appendChild(card);
  });
}

/* ---------------- PROFIL PHOTOGRAPHE ---------------- */
var pendingBooking = null; // { name, slot }
var currentProfile = null;

async function showProfilePage(name){
  const p = photographers.find(x=>x.name===name);
  if(!p) return;
  currentProfile = p;
  document.getElementById('home-content').style.display='none';
  document.getElementById('results-view').style.display='none';
  document.getElementById('profile-view').style.display='block';
  document.getElementById('profile-banner').style.background = `linear-gradient(120deg, var(--navy-950), ${p.color.match(/#([0-9A-Fa-f]{6})/)[0]})`;
  document.getElementById('profile-avatar').style.background = p.color;
  document.getElementById('profile-avatar').textContent = p.initials;
  document.getElementById('profile-name').innerHTML = escapeHtml(p.name) + (p.verification_status==='verified' ? ' <span class="verified-badge" title="Identité vérifiée">✓ Vérifié</span>' : '');
  document.getElementById('profile-bio').textContent = p.bio;
  document.getElementById('profile-meta').textContent = `📍 ${p.city} — ${formatStyles(p.styles)} · ★ ${p.rating}`;

  const portfolio = document.getElementById('profile-portfolio');
  portfolio.innerHTML='<div class="empty-state">Chargement…</div>';
  renderBookingPanel(p, p.style);
  window.scrollTo({top:0, behavior:'instant'});

  const { data: photos } = await supabase.from('photographer_photos').select('*').eq('photographer_id', p.id).order('created_at');
  portfolio.innerHTML='';
  if(photos && photos.length){
    photos.forEach(ph=>{
      const img = document.createElement('img');
      img.className='ph'; img.src = ph.url; img.alt = p.name+' — portfolio';
      // Décourage la copie facile : pas de clic droit "Enregistrer l'image", pas de glisser-déposer
      img.draggable = false;
      img.oncontextmenu = ()=> false;
      portfolio.appendChild(img);
    });
  } else {
    const shades = ['#0F2A4D','#1B4C8C','#215FAE','#2E6FBE','#7FAEE0','#0A1B33'];
    for(let i=0;i<6;i++){
      const ph = document.createElement('div');
      ph.className='ph';
      ph.style.background = shades[i % shades.length];
      portfolio.appendChild(ph);
    }
  }

  // Liste compacte en pastilles, une ligne par style proposé
  const pricesEl = document.getElementById('profile-prices');
  const stylesForPricing = p.styles || [p.style];
  pricesEl.innerHTML = stylesForPricing.map(s=>{
    const priceValue = (p.prices && p.prices[s]) ? p.prices[s] : null;
    return `<div class="price-row">
      <span class="price-row-style">${escapeHtml(s)}</span>
      <span class="price-row-pill">${priceValue ? `Dès ${escapeHtml(priceValue)}` : 'Sur demande'}</span>
    </div>`;
  }).join('');

  const { data: reviews } = await supabase.from('reviews').select('*').eq('photographer_id', p.id).order('created_at', {ascending:false});
  const reviewsEl = document.getElementById('profile-reviews');
  if(reviews && reviews.length){
    const avg = (reviews.reduce((s,r)=>s+r.rating,0) / reviews.length).toFixed(1);
    document.getElementById('reviews-title').textContent = `Avis clients — ${avg}★ (${reviews.length} avis)`;
    document.getElementById('profile-meta').textContent = `📍 ${p.city} — ${formatStyles(p.styles)} · ★ ${avg} (${reviews.length} avis)`;
    reviewsEl.innerHTML = reviews.map(r=>`
      <div class="review-item">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <b style="font-size:14px;">${escapeHtml(r.client_name) || 'Client Captivo'}</b>
          <span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
        </div>
        ${r.comment ? `<p style="color:var(--ink-soft);font-size:13.5px;margin:6px 0 0;">${escapeHtml(r.comment)}</p>` : ''}
      </div>
    `).join('');
  } else {
    document.getElementById('reviews-title').textContent = 'Avis clients';
    reviewsEl.innerHTML = `<div class="empty-state">Aucun avis pour le moment.</div>`;
  }
}

function closeProfile(){
  document.getElementById('profile-view').style.display='none';
  if(lastMainView==='results'){
    document.getElementById('home-content').style.display='none';
    document.getElementById('results-view').style.display='block';
  } else {
    showHome();
  }
}

function renderBookingPanel(p, selectedStyle){
  const styles = Object.keys(styleIcons);
  const availableSlots = (p.styles || [p.style]).includes(selectedStyle) ? p.slots : [];
  const panel = document.getElementById('booking-panel');
  panel.innerHTML = `
    <h3>Réserver un créneau</h3>
    <p class="sub">Choisissez le type de séance souhaité, puis un créneau disponible.</p>
    <div class="field">
      <label>Style de photo souhaité</label>
      <select id="style-select">
        ${styles.map(s=>`<option value="${s}" ${s===selectedStyle?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    ${availableSlots.length ? `
      <div class="slot-list" id="slot-list"></div>
    ` : `
      <div class="no-slots">Aucun créneau disponible pour « ${escapeHtml(selectedStyle)} » chez ${escapeHtml(p.name)} pour le moment.</div>
      <button class="modal-submit client" id="contact-btn">Contacter le photographe</button>
    `}
  `;
  document.getElementById('style-select').onchange = (e)=> renderBookingPanel(p, e.target.value);
  if(availableSlots.length){
    const list = document.getElementById('slot-list');
    availableSlots.forEach(slot=>{
      const b = document.createElement('button');
      b.className='slot-btn';
      b.textContent = slot.label;
      b.onclick = ()=> selectSlot(p, slot, selectedStyle);
      list.appendChild(b);
    });
  } else {
    document.getElementById('contact-btn').onclick = ()=> openContactForm(p, selectedStyle);
  }
}

function selectSlot(p, slot, style){
  if(currentUser && currentUser.type==='photographer'){ showBlocked('client'); return; }
  if(currentUser && currentUser.type==='client'){ confirmBookingRequest(p, slot, style); return; }
  pendingBooking = { p, slot, style };
  showAuthForm('client','login');
}

async function confirmBookingRequest(p, slot, style){
  const { data, error } = await supabase.from('booking_requests').insert({
    photographer_id: p.id,
    client_id: currentUser.id,
    client_name: currentUser.name,
    client_email: currentUser.email || '—',
    style, slot_label: slot.label, status:'pending', client_notified:true
  }).select().single();

  if(error){
    document.getElementById('overlay').style.display='flex';
    document.getElementById('modal-body').innerHTML = `
      <div class="modal-tag client">Erreur</div>
      <h3>La demande n'a pas pu être envoyée</h3>
      <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;">${error.message}</p>
      <button class="modal-submit client" onclick="closeAuth()">Fermer</button>
    `;
    return;
  }

  await supabase.from('slots').delete().eq('id', slot.id);
  p.slots = p.slots.filter(s=>s.id!==slot.id);
  if(document.getElementById('profile-view').style.display==='block' && currentProfile===p){
    renderBookingPanel(p, style);
  }
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag client">Demande envoyée</div>
    <h3>Créneau demandé ✔</h3>
    <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 18px;">Votre demande pour une séance <b>${escapeHtml(style)}</b> le <b>${escapeHtml(slot.label)}</b> auprès de <b>${escapeHtml(p.name)}</b> a été transmise. ${escapeHtml(p.name)} doit encore la confirmer — suivez le statut à tout moment depuis <b>« Mes réservations »</b> en haut à droite du site.</p>
    <button class="modal-submit client" onclick="closeAuth()">Fermer</button>
  `;
}

function openContactForm(p, style){
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag client">Aucun créneau disponible</div>
    <h3>Contacter ${escapeHtml(p.name)}</h3>
    <p style="color:var(--ink-soft);font-size:13.5px;line-height:1.6;margin:0 0 18px;">Ce message sera transmis directement au photographe (visible dans son tableau de bord et envoyé par email), qui reprendra contact avec vous.</p>
    <form onsubmit="return submitContact(event,'${p.id}','${style.replace(/'/g,"\\'")}')">
      <div class="field"><label>Nom complet</label><input type="text" id="contact-name" required></div>
      <div class="field"><label>Email</label><input type="email" id="contact-email" required></div>
      <div class="field"><label>Téléphone</label><input type="tel" id="contact-phone" required></div>
      <div class="field"><label>Style souhaité</label><input type="text" id="contact-style" value="${style}"></div>
      <div class="field"><label>Date souhaitée</label><input type="text" id="contact-date" placeholder="Ex. courant août"></div>
      <div class="field"><label>Message</label><input type="text" id="contact-message" placeholder="Détails de votre demande"></div>
      <button class="modal-submit client" type="submit">Envoyer la demande par email</button>
    </form>
  `;
}

async function submitContact(e, photographerId, defaultStyle){
  e.preventDefault();
  const photographerName = (photographers.find(x=>x.id===photographerId) || {}).name || '';
  const { error } = await supabase.from('contact_messages').insert({
    photographer_id: photographerId,
    name: document.getElementById('contact-name').value,
    email: document.getElementById('contact-email').value,
    phone: document.getElementById('contact-phone').value,
    style: document.getElementById('contact-style').value || defaultStyle,
    date_wanted: document.getElementById('contact-date').value,
    message: document.getElementById('contact-message').value,
    read:false
  });
  if(error){
    document.getElementById('modal-body').innerHTML = `
      <div class="modal-tag client">Erreur</div>
      <h3>Le message n'a pas pu être envoyé</h3>
      <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;">${error.message}</p>
      <button class="modal-submit client" onclick="closeAuth()">Fermer</button>
    `;
    return false;
  }
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag client">Demande envoyée</div>
    <h3>Message transmis ✔</h3>
    <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 18px;">Votre demande a été envoyée à <b>${photographerName}</b>, avec toutes vos informations. Il ou elle vous recontactera directement.</p>
    <button class="modal-submit client" onclick="closeAuth()">Fermer</button>
  `;
  return false;
}

var selectedRating = 5;
function openReviewForm(bookingId, photographerId, photographerName){
  selectedRating = 5;
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag client">Laisser un avis</div>
    <h3>Votre séance avec ${photographerName}</h3>
    <div class="field">
      <label>Note</label>
      <div id="star-picker" style="font-size:28px;color:var(--gold-500);cursor:pointer;letter-spacing:4px;">★★★★★</div>
    </div>
    <div class="field"><label>Commentaire (optionnel)</label><input type="text" id="review-comment" placeholder="Votre expérience avec le photographe"></div>
    <button class="modal-submit client" onclick="submitReview('${bookingId}','${photographerId}')">Publier l'avis</button>
  `;
  const picker = document.getElementById('star-picker');
  picker.onmousemove = (e)=>{
    const rect = picker.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const n = Math.max(1, Math.min(5, Math.ceil(ratio*5)));
    picker.textContent = '★'.repeat(n) + '☆'.repeat(5-n);
  };
  picker.onclick = (e)=>{
    const rect = picker.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    selectedRating = Math.max(1, Math.min(5, Math.ceil(ratio*5)));
  };
}

async function submitReview(bookingId, photographerId){
  const comment = document.getElementById('review-comment').value;
  const { error } = await supabase.from('reviews').insert({
    booking_request_id: bookingId,
    photographer_id: photographerId,
    client_id: currentUser.id,
    client_name: currentUser.name,
    rating: selectedRating,
    comment
  });
  if(error){
    document.getElementById('modal-body').innerHTML = `<div class="modal-tag client">Erreur</div><h3>L'avis n'a pas pu être publié</h3><p style="color:var(--ink-soft);font-size:14px;">${error.message}</p><button class="modal-submit client" onclick="closeAuth()">Fermer</button>`;
    return;
  }
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag client">Merci ✔</div>
    <h3>Votre avis a été publié</h3>
    <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 18px;">Il est désormais visible sur le profil public du photographe.</p>
    <button class="modal-submit client" onclick="closeAuth()">Fermer</button>
  `;
}

async function confirmCancelBooking(reqId){
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag client">Confirmer l'annulation</div>
    <h3>Annuler cette réservation ?</h3>
    <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 18px;">Le photographe sera informé de l'annulation. Cette action est irréversible.</p>
    <div class="req-actions">
      <button class="btn-decline" onclick="cancelBookingNow('${reqId}')">Oui, annuler</button>
      <button class="btn-accept" onclick="openClientBookings()">Retour</button>
    </div>
  `;
}

async function cancelBookingNow(reqId){
  const { data: req } = await supabase.from('booking_requests').select('*').eq('id', reqId).single();
  await supabase.from('booking_requests').update({ status:'cancelled_by_client' }).eq('id', reqId);
  if(req){
    await supabase.from('slots').insert({ photographer_id: req.photographer_id, label: req.slot_label });
  }
  await openClientBookings();
}

async function openClientBookings(){
  if(!currentUser || currentUser.type!=='client') return;
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `<div class="modal-tag client">Mes réservations</div><h3>Chargement…</h3>`;

  const { data, error } = await supabase
    .from('booking_requests')
    .select('*, photographers(name)')
    .eq('client_id', currentUser.id)
    .order('created_at', { ascending:false });

  if(error){
    document.getElementById('modal-body').innerHTML = `<div class="modal-tag client">Mes réservations</div><h3>Erreur de chargement</h3><p style="color:var(--ink-soft);font-size:14px;">${error.message}</p><button class="modal-submit client" onclick="closeAuth()">Fermer</button>`;
    return;
  }

  const mine = data || [];
  const { data: myReviews } = await supabase.from('reviews').select('booking_request_id').eq('client_id', currentUser.id);
  const reviewedIds = new Set((myReviews||[]).map(r=>r.booking_request_id));
  const statusLabel = {pending:'En attente de confirmation', confirmed:'Confirmée ✔', declined:'Refusée', cancelled_by_client:'Annulée par vous', cancelled_by_photographer:'Annulée par le photographe'};
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag client">Mes réservations</div>
    <h3>Statut de mes demandes</h3>
    ${mine.length ? mine.map(r=>`
      <div class="req-item" ${r.client_notified===false ? 'style="border-color:var(--gold-500);background:var(--gold-100);"' : ''}>
        <div class="top">
          <div><div class="who">${r.photographers ? r.photographers.name : 'Photographe'}</div><div class="detail">Séance ${r.style}</div></div>
          <span class="status-pill ${r.status==='confirmed'?'confirmed':(r.status==='pending'?'pending':'declined')}">${statusLabel[r.status]}</span>
        </div>
        <div class="detail">Créneau : <b>${r.slot_label}</b></div>
        ${r.status==='declined' && r.decline_reason ? `<div class="detail">Motif du refus : « ${escapeHtml(r.decline_reason)} »</div>` : ''}
        ${r.client_notified===false ? `<div class="detail" style="color:#8A5A0F;font-weight:700;margin-top:6px;">● Nouveau : le photographe vient de mettre à jour cette demande</div>` : ''}
        ${(r.status==='pending' || r.status==='confirmed') ? `<div class="req-actions"><button class="btn-decline" data-cancel-booking="${r.id}">Annuler cette réservation</button>${r.status==='confirmed' && !reviewedIds.has(r.id) ? `<button class="btn-accept" data-review-booking="${r.id}" data-review-photographer="${r.photographer_id}" data-review-name="${r.photographers?r.photographers.name:''}">Laisser un avis</button>` : ''}</div>` : ''}
      </div>
    `).join('') : `<div class="empty-state">Aucune demande de réservation pour le moment.</div>`}
  `;

  document.querySelectorAll('[data-cancel-booking]').forEach(btn=>{
    btn.onclick = ()=> confirmCancelBooking(btn.dataset.cancelBooking);
  });
  document.querySelectorAll('[data-review-booking]').forEach(btn=>{
    btn.onclick = ()=> openReviewForm(btn.dataset.reviewBooking, btn.dataset.reviewPhotographer, btn.dataset.reviewName);
  });

  // marque les notifications comme vues
  const unseenIds = mine.filter(r=>r.client_notified===false).map(r=>r.id);
  if(unseenIds.length){
    await supabase.from('booking_requests').update({client_notified:true}).in('id', unseenIds);
  }
  currentUser.unseenCount = 0;
  renderHeader();
}

function openSupport(){
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag photog">Support Captivo</div>
    <h3>Un problème, une question ?</h3>
    <p style="color:var(--ink-soft);font-size:13.5px;line-height:1.6;margin:0 0 16px;">Contactez-nous directement sur WhatsApp pour une réponse rapide, ou passez par le formulaire pour un message détaillé.</p>
    <a class="modal-submit" style="display:flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;background:#25D366;color:#fff;margin-bottom:20px;" href="https://wa.me/33669108317?text=${encodeURIComponent("Bonjour, nouvelle demande depuis Captivo. (Merci d'envoyer ce message sans le modifier pour démarrer votre prise en charge.)")}" target="_blank" rel="noopener">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.3A8.9 8.9 0 0012 4a8.9 8.9 0 00-7.7 13.4L3 21l3.7-1.2A8.9 8.9 0 0012 21a8.9 8.9 0 006.3-15.3zM12 19.4a7.4 7.4 0 01-3.8-1l-.3-.2-2.8.9.9-2.7-.2-.3A7.4 7.4 0 1119.4 12 7.4 7.4 0 0112 19.4zm4-5.5c-.2-.1-1.3-.6-1.5-.7s-.4-.1-.5.1-.6.7-.7.9-.3.2-.5.1a6 6 0 01-1.8-1.1 6.7 6.7 0 01-1.2-1.5c-.1-.2 0-.4.1-.5l.3-.4.2-.3v-.3c0-.1-.5-1.3-.7-1.7s-.4-.4-.5-.4h-.5a.9.9 0 00-.6.3 2.7 2.7 0 00-.9 2 4.7 4.7 0 001 2.5 10.6 10.6 0 004 3.6c.6.2 1 .4 1.4.5a3.4 3.4 0 001.5.1 2.5 2.5 0 001.6-1.1 1.9 1.9 0 00.1-1.1c-.1-.1-.2-.2-.4-.3z"/></svg>
      Nous écrire sur WhatsApp
    </a>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
      <div style="flex:1;height:1px;background:var(--line-dark);"></div>
      <span style="font-size:11.5px;color:var(--ink-soft);font-weight:600;">OU</span>
      <div style="flex:1;height:1px;background:var(--line-dark);"></div>
    </div>
    <form onsubmit="return submitSupport(event)">
      <div class="field"><label>Nom complet</label><input type="text" id="support-name" required></div>
      <div class="field"><label>Email</label><input type="email" id="support-email" required></div>
      <div class="field">
        <label>Sujet</label>
        <select id="support-subject">
          <option>Problème de réservation</option>
          <option>Problème de compte / connexion</option>
          <option>Signaler un photographe</option>
          <option>Question générale</option>
          <option>Autre</option>
        </select>
      </div>
      <div class="field"><label>Message</label><textarea id="support-message" placeholder="Décrivez votre problème" required></textarea></div>
      <button class="modal-submit photog" type="submit">Envoyer au support</button>
    </form>
  `;
}

async function submitSupport(e){
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  if(btn) btn.disabled = true;
  const name = document.getElementById('support-name').value;
  const email = document.getElementById('support-email').value;
  const subject = document.getElementById('support-subject').value;
  const message = document.getElementById('support-message').value;

  const { error } = await supabase.from('contact_messages').insert({
    photographer_id: null,
    name, email, subject, message,
    read: false
  });

  if(error){
    document.getElementById('modal-body').innerHTML = `
      <div class="modal-tag client">Erreur</div>
      <h3>Le message n'a pas pu être envoyé</h3>
      <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 18px;">Réessayez dans quelques instants, ou écrivez-nous directement à <b>captivo.contact@gmail.com</b>.</p>
      <button class="modal-submit client" onclick="closeAuth()">Fermer</button>
    `;
    return false;
  }

  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag photog">Message envoyé ✔</div>
    <h3>Merci, on vous répond vite</h3>
    <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 18px;">Votre message a été transmis directement à l'équipe Captivo. Vous recevrez une réponse à <b>${escapeHtml(email)}</b> dans les meilleurs délais.</p>
    <button class="modal-submit photog" onclick="closeAuth()">Fermer</button>
  `;
  return false;
}


function showHome(){
  lastMainView = 'home';
  document.getElementById('home-content').style.display='block';
  document.getElementById('results-view').style.display='none';
}

function goHome(){
  document.getElementById('profile-view').style.display='none';
  document.getElementById('pro-dashboard').style.display='none';
  document.getElementById('q-name').value='';
  document.getElementById('q-city').value='';
  document.getElementById('q-style').value='';
  showHome();
  window.scrollTo({top:0, behavior:'smooth'});
}

/* ---------------- AUTH (deux espaces séparés) ---------------- */
var currentUser = null; // {type:'photographer'|'client', name, email, photographerRef?}

function renderHeader(){
  const el = document.getElementById('header-actions');
  if(currentUser){
    const unseenCount = currentUser.type==='client' ? (currentUser.unseenCount || 0) : 0;
    el.innerHTML = `
      <div class="user-chip" ${currentUser.type==='photographer' ? 'style="cursor:pointer" onclick="openDashboard()"' : 'style="cursor:pointer" onclick="openClientBookings()"'}>
        <div class="av">${escapeHtml(currentUser.name[0].toUpperCase())}</div>${escapeHtml(currentUser.name)} · ${currentUser.type==='photographer'?'Pro':'Client'}
      </div>
      ${currentUser.type==='photographer' ? `<button class="btn btn-outline" onclick="openDashboard()">Tableau de bord</button>` : `
        <button class="btn btn-outline" style="position:relative;" onclick="openClientBookings()">
          Mes réservations
          ${unseenCount>0 ? `<span class="dot-badge show" style="position:absolute;top:-7px;right:-7px;">${unseenCount}</span>` : ''}
        </button>
      `}
      <button class="btn btn-ghost-white" onclick="logout()">Déconnexion</button>
    `;
  } else {
    el.innerHTML = `
      <button class="btn btn-outline" onclick="openAuth('photographer')"><span class="long">Espace </span>Photographe</button>
      <button class="btn btn-gold" onclick="openAuth('client')"><span class="long">Espace </span>Client</button>
    `;
  }
}
renderHeader();

function openAuth(type){
  // empêche la double connexion : un compte connecté d'un côté ne peut pas ouvrir l'autre espace
  if(currentUser && currentUser.type!==type){
    showBlocked(type);
    return;
  }
  if(currentUser && currentUser.type===type){
    document.getElementById('overlay').style.display='flex';
    document.getElementById('modal-body').innerHTML = `
      <div class="modal-tag ${type==='photographer'?'photog':'client'}">${type==='photographer'?'Espace Photographe':'Espace Client'}</div>
      <h3>Déjà connecté(e)</h3>
      <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;">Vous êtes connecté(e) en tant que <b>${escapeHtml(currentUser.name)}</b>. Déconnectez-vous pour changer de compte.</p>
      <button class="modal-submit ${type==='photographer'?'photog':'client'}" onclick="logout(); closeAuth();">Se déconnecter</button>
    `;
    return;
  }
  showAuthForm(type, 'login');
}

function showBlocked(triedType){
  document.getElementById('overlay').style.display='flex';
  const otherLabel = currentUser.type==='photographer' ? 'photographe' : 'client';
  const triedLabel = triedType==='photographer' ? 'photographe' : 'client';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag ${triedType==='photographer'?'photog':'client'}">${triedType==='photographer'?'Espace Photographe':'Espace Client'}</div>
    <h3>Un seul espace à la fois</h3>
    <div class="blocked-msg">Vous êtes actuellement connecté(e) en tant que <b>${otherLabel}</b>. Pour accéder à l'espace ${triedLabel}, déconnectez-vous d'abord — un même compte ne peut pas cumuler les deux profils.</div>
    <button class="modal-submit ${currentUser.type==='photographer'?'photog':'client'}" onclick="logout(); closeAuth();">Se déconnecter puis continuer</button>
  `;
}

function showAuthForm(type, mode){
  const isPhotog = type==='photographer';
  const styleCheckboxes = Object.keys(styleIcons).map(s=>`<label class="style-checkbox"><input type="checkbox" name="auth-styles" value="${s}">${s}</label>`).join('');
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag ${isPhotog?'photog':'client'}">${isPhotog?'Espace Photographe':'Espace Client'}</div>
    <h3>${mode==='login' ? 'Connexion' : 'Créer un compte'}</h3>
    <div class="tabs">
      <div class="tab ${mode==='login'?'active':''}" onclick="showAuthForm('${type}','login')">Connexion</div>
      <div class="tab ${mode==='signup'?'active':''}" onclick="showAuthForm('${type}','signup')">Inscription</div>
    </div>
    <div id="auth-error" style="display:none;background:#FBE3E3;color:#B23A3A;border-radius:10px;padding:11px 14px;font-size:13px;font-weight:600;margin-bottom:14px;"></div>
    <form onsubmit="return submitAuth(event,'${type}','${mode}')">
      ${mode==='signup' ? `<div class="field"><label>Nom complet</label><input type="text" id="auth-name" required placeholder="${isPhotog?'Nom du studio ou photographe':'Prénom et nom'}"></div>` : ''}
      <div class="field"><label>Email</label><input type="email" id="auth-email" required placeholder="vous@exemple.com"></div>
      ${mode==='signup' && isPhotog ? `
        <div class="field"><label>Secteur d'exercice</label><input type="text" id="auth-city" placeholder="Ex. Annecy" required></div>
        <div class="field"><label>Styles proposés <span style="font-weight:400;color:var(--ink-soft);">(cochez-en au moins un)</span></label><div class="style-checkbox-grid">${styleCheckboxes}</div></div>
      ` : ''}
      <div class="field"><label>Mot de passe</label><input type="password" id="auth-pass" required minlength="6" placeholder="6 caractères minimum"></div>
      <button class="modal-submit ${isPhotog?'photog':'client'}" type="submit" id="auth-submit-btn">${mode==='login' ? 'Se connecter' : 'Créer mon compte '+(isPhotog?'photographe':'client')}</button>
    </form>
    ${mode==='login' ? `<p style="text-align:center;margin:12px 0 0;"><a href="#" onclick="openForgotPassword('${type}');return false;" style="color:var(--blue-600);font-size:13px;font-weight:600;">Mot de passe oublié ?</a></p>` : ''}
    <p class="modal-note">${isPhotog ? "Réservé aux photographes professionnels — la souscription client se fait depuis l'espace client." : "Réservé aux clients — les photographes s'inscrivent depuis leur espace dédié."}</p>
  `;
}

var shadeColors = ["linear-gradient(135deg,#1B4C8C,#2E6FBE)","linear-gradient(135deg,#0F2A4D,#215FAE)","linear-gradient(135deg,#215FAE,#7FAEE0)","linear-gradient(135deg,#1B4C8C,#0F2A4D)","linear-gradient(135deg,#0A1B33,#1B4C8C)"];

function showAuthError(message){
  const el = document.getElementById('auth-error');
  el.textContent = message;
  el.style.display = 'block';
  const btn = document.getElementById('auth-submit-btn');
  if(btn) btn.disabled = false;
}

function showBanScreen(reason){
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag client" style="background:#B23A3A;color:#fff;">Accès suspendu</div>
    <h3>Ce compte a été retiré du site</h3>
    <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 14px;">
      Votre compte a été suspendu par l'équipe Captivo${reason ? ' pour le motif suivant :' : '.'}
    </p>
    ${reason ? `<div class="blocked-msg">« ${escapeHtml(reason)} »</div>` : ''}
    <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 18px;">
      Si vous pensez qu'il s'agit d'une erreur, ou pour demander un déblocage, contactez le support à l'adresse
      <a href="mailto:captivo.contact@gmail.com?subject=${encodeURIComponent('Demande de déblocage de compte')}" style="color:var(--blue-600);font-weight:600;">captivo.contact@gmail.com</a>.
    </p>
    <button class="modal-submit client" onclick="closeAuth()">Fermer</button>
  `;
}

function showEmailConfirmationScreen(type, email){
  const photogWarning = type==='photographer'
    ? `<div class="blocked-msg">⚠️ Important : votre profil ne sera visible dans les recherches qu'après cette première reconnexion — pas avant.</div>`
    : '';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag ${type==='photographer'?'photog':'client'}">Compte créé ✔</div>
    <h3>Vérifiez votre boîte mail</h3>
    <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 14px;">
      Votre compte a bien été créé avec l'adresse <b>${email}</b>. Un email de confirmation vient de vous être envoyé —
      cliquez sur le lien qu'il contient, <b>puis revenez sur Captivo et connectez-vous</b> (avec le bouton ${type==='photographer'?'« Espace Photographe »':'« Espace Client »'}).
    </p>
    ${photogWarning}
    <p style="color:var(--ink-soft);font-size:13px;line-height:1.6;margin:0 0 18px;">Pensez à vérifier vos courriers indésirables si vous ne le voyez pas sous quelques minutes.</p>
    <button class="modal-submit ${type==='photographer'?'photog':'client'}" onclick="closeAuth()">J'ai compris</button>
  `;
}

function openForgotPassword(type){
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag ${type==='photographer'?'photog':'client'}">Mot de passe oublié</div>
    <h3>Réinitialiser mon mot de passe</h3>
    <p style="color:var(--ink-soft);font-size:13.5px;line-height:1.6;margin:0 0 18px;">Indiquez votre email — vous recevrez un lien pour choisir un nouveau mot de passe.</p>
    <div id="auth-error" style="display:none;background:#FBE3E3;color:#B23A3A;border-radius:10px;padding:11px 14px;font-size:13px;font-weight:600;margin-bottom:14px;"></div>
    <form onsubmit="return submitForgotPassword(event,'${type}')">
      <div class="field"><label>Email</label><input type="email" id="forgot-email" required placeholder="vous@exemple.com"></div>
      <button class="modal-submit ${type==='photographer'?'photog':'client'}" type="submit" id="auth-submit-btn">Envoyer le lien de réinitialisation</button>
    </form>
    <p style="text-align:center;margin:12px 0 0;"><a href="#" onclick="showAuthForm('${type}','login');return false;" style="color:var(--blue-600);font-size:13px;font-weight:600;">← Retour à la connexion</a></p>
  `;
}

async function submitForgotPassword(e, type){
  e.preventDefault();
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled = true;
  const email = document.getElementById('forgot-email').value;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
  if(error){ showAuthError(error.message); return false; }
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag ${type==='photographer'?'photog':'client'}">Email envoyé ✔</div>
    <h3>Vérifiez votre boîte mail</h3>
    <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 18px;">Si un compte existe avec l'adresse <b>${email}</b>, un lien de réinitialisation vient d'être envoyé. Cliquez dessus pour choisir un nouveau mot de passe.</p>
    <button class="modal-submit client" onclick="closeAuth()">Fermer</button>
  `;
  return false;
}

function openSetNewPassword(){
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag client">Nouveau mot de passe</div>
    <h3>Choisissez un nouveau mot de passe</h3>
    <div id="auth-error" style="display:none;background:#FBE3E3;color:#B23A3A;border-radius:10px;padding:11px 14px;font-size:13px;font-weight:600;margin-bottom:14px;"></div>
    <form onsubmit="return submitNewPassword(event)">
      <div class="field"><label>Nouveau mot de passe</label><input type="password" id="new-pass" required minlength="6" placeholder="6 caractères minimum"></div>
      <button class="modal-submit client" type="submit" id="auth-submit-btn">Valider le nouveau mot de passe</button>
    </form>
  `;
}

async function submitNewPassword(e){
  e.preventDefault();
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled = true;
  const newPassword = document.getElementById('new-pass').value;
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if(error){ showAuthError(error.message); return false; }
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag client">Mot de passe modifié ✔</div>
    <h3>C'est fait</h3>
    <p style="color:var(--ink-soft);font-size:14px;line-height:1.6;margin:0 0 18px;">Votre mot de passe a été mis à jour. Vous pouvez continuer à utiliser Captivo.</p>
    <button class="modal-submit client" onclick="closeAuth()">Fermer</button>
  `;
  return false;
}

async function fetchOrCreatePhotographerProfile(userId, fallbackName, city, styles, email){
  const { data: existing } = await supabase.from('photographers').select('*, slots(*)').eq('user_id', userId).maybeSingle();
  if(existing){
    // Corrige une fiche qui aurait été créée sans les bonnes infos (ex. premier login avant confirmation email)
    const updates = {};
    if(fallbackName && fallbackName !== existing.name) updates.name = fallbackName;
    if(city && existing.city === 'Secteur non renseigné') updates.city = city;
    if(styles && styles.length && (!existing.styles || !existing.styles.length)){
      updates.styles = styles;
      updates.style = styles[0];
    }

    // Comble un manque possible : un compte créé avant l'ajout de photographer_emails
    // (ou dont l'email n'a jamais pu être enregistré pour une autre raison) n'a jamais
    // de ligne ici — on la crée dès qu'on la détecte manquante, à chaque connexion.
    if(email){
      const { data: existingEmail } = await supabase.from('photographer_emails').select('photographer_id').eq('photographer_id', existing.id).maybeSingle();
      if(!existingEmail){
        const { error: emailError } = await supabase.from('photographer_emails').insert({ photographer_id: existing.id, email });
        if(emailError) console.error('Impossible d\'enregistrer l\'email du photographe :', emailError.message, emailError);
      }
    }

    if(Object.keys(updates).length){
      if(updates.name){
        updates.initials = updates.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      }
      const { data: updated } = await supabase.from('photographers').update(updates).eq('id', existing.id).select().single();
      return mapDbPhotographer({...existing, ...updated, slots: existing.slots});
    }
    return mapDbPhotographer(existing);
  }

  const name = fallbackName || 'Photographe';
  const stylesArr = (styles && styles.length) ? styles : ["Portrait"];
  const { data, error } = await supabase.from('photographers').insert({
    user_id: userId, name,
    city: city || "Secteur non renseigné", style: stylesArr[0], styles: stylesArr,
    rate:"À définir", rating:5.0,
    initials: name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),
    color: shadeColors[Math.floor(Math.random()*shadeColors.length)],
    bio:"Nouveau photographe sur Captivo — profil en cours de complétion."
  }).select().single();
  if(error) throw error;
  if(email){
    const { error: emailError } = await supabase.from('photographer_emails').insert({ photographer_id: data.id, email });
    if(emailError) console.error('Impossible d\'enregistrer l\'email du photographe (nouvelle inscription) :', emailError.message, emailError);
  }
  return mapDbPhotographer({...data, slots:[]});
}

async function submitAuth(e, type, mode){
  e.preventDefault();
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled = true;
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-pass').value;
  const nameEl = document.getElementById('auth-name');
  const cityEl = document.getElementById('auth-city');
  const stylesCheckboxes = document.querySelectorAll('input[name="auth-styles"]:checked');
  const stylesArr = stylesCheckboxes ? Array.prototype.map.call(stylesCheckboxes, function(c){ return c.value; }) : [];

  try{
    let authData;
    if(mode==='signup'){
      if(type==='photographer'){
        if(!stylesArr.length){
          showAuthError("Merci de cocher au moins un style que vous proposez.");
          btn.disabled = false;
          return false;
        }
        try{
          localStorage.setItem('captivo_pending_photographer', JSON.stringify({
            email, name: nameEl.value, city: cityEl ? cityEl.value : null, styles: stylesArr
          }));
        } catch(e){ /* stockage indisponible, tant pis : le message de reconnexion manuelle reste le filet de secours */ }
      }
      const signUpOptions = type==='client' ? { data: { full_name: nameEl.value } } : undefined;
      const { data, error } = await supabase.auth.signUp({ email, password, options: signUpOptions });
      if(error) throw error;
      authData = data;
      if(!data.session){
        showEmailConfirmationScreen(type, email);
        return false;
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if(error) throw error;
      authData = data;
    }

    const user = authData.user;

    const { data: banRow } = await supabase.from('banned_users').select('*').eq('user_id', user.id).maybeSingle();
    if(banRow){
      await supabase.auth.signOut();
      showBanScreen(banRow.reason);
      return false;
    }

    if(type==='photographer'){
      if(mode==='login'){
        const { data: existingCheck } = await supabase.from('photographers').select('id').eq('user_id', user.id).maybeSingle();
        if(!existingCheck){
          await supabase.auth.signOut();
          showAuthError("Ce compte n'est pas enregistré comme photographe. Utilisez l'Espace Client pour vous connecter, ou inscrivez-vous ici en tant que photographe.");
          return false;
        }
      }
      const photographerRef = await fetchOrCreatePhotographerProfile(
        user.id,
        nameEl ? nameEl.value : null,
        cityEl ? cityEl.value : null,
        stylesArr.length ? stylesArr : null,
        email
      );
      const existingIdx = photographers.findIndex(x=>x.id===photographerRef.id);
      if(existingIdx>=0) photographers[existingIdx] = photographerRef;
      else photographers.push(photographerRef);
      currentUser = { type, id: user.id, name: photographerRef.name, email, photographerRef };
      renderHeader();
      await openDashboard();
      return false;
    }

    const { data: photographerCheck } = await supabase.from('photographers').select('id').eq('user_id', user.id).maybeSingle();
    if(photographerCheck){
      await supabase.auth.signOut();
      showAuthError("Ce compte est enregistré comme compte photographe. Utilisez l'Espace Photographe pour vous connecter.");
      return false;
    }

    const displayName = user.user_metadata && user.user_metadata.full_name ? user.user_metadata.full_name : email.split('@')[0];
    currentUser = { type, id: user.id, name: displayName, email, unseenCount:0 };
    renderHeader();
    refreshClientUnseenCount();
    if(pendingBooking){
      const b = pendingBooking;
      pendingBooking = null;
      confirmBookingRequest(b.p, b.slot, b.style);
    } else {
      closeAuth();
    }
    return false;
  } catch(err){
    showAuthError(err.message || "Une erreur est survenue.");
    return false;
  }
}

async function refreshClientUnseenCount(){
  if(!currentUser || currentUser.type!=='client') return;
  const { count } = await supabase
    .from('booking_requests')
    .select('id', { count:'exact', head:true })
    .eq('client_id', currentUser.id)
    .eq('client_notified', false);
  currentUser.unseenCount = count || 0;
  renderHeader();
}

async function logout(){
  await supabase.auth.signOut();
  currentUser = null;
  renderHeader();
  showHome();
}
function closeAuth(){ document.getElementById('overlay').style.display='none'; }
document.getElementById('overlay').addEventListener('click', e=>{ if(e.target.id==='overlay') closeAuth(); });

/* ---------------- ESPACE PHOTOGRAPHE — TABLEAU DE BORD ---------------- */
var frDays = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
var frMonths = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
function formatSlotLabel(dateValue, timeValue){
  const d = new Date(dateValue+'T00:00:00');
  return `${frDays[d.getDay()]}. ${d.getDate()} ${frMonths[d.getMonth()]} — ${timeValue}`;
}
var activeDashTab = 'apercu';

var dashRequestsCache = [];
var dashMessagesCache = [];
var dashPhotosCache = [];

async function openDashboard(){
  if(!currentUser || currentUser.type!=='photographer') return;
  closeAuth();
  document.getElementById('home-content').style.display='none';
  document.getElementById('results-view').style.display='none';
  document.getElementById('profile-view').style.display='none';
  document.getElementById('pro-dashboard').style.display='block';
  const p = currentUser.photographerRef;
  document.getElementById('dash-avatar').style.background = p.color;
  document.getElementById('dash-avatar').textContent = p.initials;
  document.getElementById('dash-name').textContent = p.name;
  document.getElementById('dash-meta').textContent = `📍 ${p.city} — ${formatStyles(p.styles)}`;
  document.querySelectorAll('.dash-tab').forEach(t=>{
    t.onclick = ()=> setDashTab(t.dataset.tab);
  });
  await setDashTab('apercu');
  window.scrollTo({top:0, behavior:'instant'});
}

function showPublicPreview(){
  showProfilePage(currentUser.photographerRef.name);
}

async function fetchPhotographerSlots(p){
  const { data } = await supabase.from('slots').select('*').eq('photographer_id', p.id).order('created_at');
  p.slots = (data || []).map(s=>({id:s.id, label:s.label}));
}
async function fetchPhotographerRequests(p){
  const { data } = await supabase.from('booking_requests').select('*').eq('photographer_id', p.id).order('created_at', {ascending:false});
  return data || [];
}
async function fetchPhotographerMessages(p){
  const { data } = await supabase.from('contact_messages').select('*').eq('photographer_id', p.id).order('created_at', {ascending:false});
  return data || [];
}
async function fetchPhotographerPhotos(p){
  const { data } = await supabase.from('photographer_photos').select('*').eq('photographer_id', p.id).order('created_at');
  return data || [];
}

async function setDashTab(tab){
  activeDashTab = tab;
  document.querySelectorAll('.dash-tab').forEach(t=> t.classList.toggle('active', t.dataset.tab===tab));
  const p = currentUser.photographerRef;
  const body = document.getElementById('dash-body');
  body.innerHTML = `<div class="dash-card"><div class="empty-state">Chargement…</div></div>`;

  if(tab==='agenda') await fetchPhotographerSlots(p);
  if(tab==='demandes' || tab==='apercu') dashRequestsCache = await fetchPhotographerRequests(p);
  if(tab==='messages' || tab==='apercu') dashMessagesCache = await fetchPhotographerMessages(p);
  if(tab==='portfolio') dashPhotosCache = await fetchPhotographerPhotos(p);

  if(tab==='apercu') body.innerHTML = renderDashOverview(p);
  if(tab==='agenda') body.innerHTML = renderDashAgenda(p);
  if(tab==='demandes') body.innerHTML = renderDashRequests(p);
  if(tab==='messages') body.innerHTML = renderDashMessages(p);
  if(tab==='portfolio') body.innerHTML = renderDashPortfolio(p);
  if(tab==='profil') body.innerHTML = renderDashProfile(p);
  wireDashEvents(p, tab);
  updateDashBadges();
}

function updateDashBadges(){
  if(!currentUser || currentUser.type!=='photographer') return;
  const pendingReq = dashRequestsCache.filter(r=>r.status==='pending').length;
  const unreadMsg = dashMessagesCache.filter(m=>!m.read).length;
  const rb = document.getElementById('badge-requests');
  const mb = document.getElementById('badge-messages');
  if(rb){ rb.textContent = pendingReq; rb.classList.toggle('show', pendingReq>0); }
  if(mb){ mb.textContent = unreadMsg; mb.classList.toggle('show', unreadMsg>0); }
}

function renderDashOverview(p){
  const pending = dashRequestsCache.filter(r=>r.status==='pending');
  const confirmed = dashRequestsCache.filter(r=>r.status==='confirmed').length;
  const unreadMsg = dashMessagesCache.filter(m=>!m.read).length;
  const profileIncomplete = !p.prices || !Object.keys(p.prices).length || (p.bio||'').startsWith('Nouveau photographe sur Captivo');
  return `
    ${profileIncomplete ? `
      <div class="dash-card" style="background:var(--gold-100);border-color:transparent;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
        <div>
          <h3 style="margin-bottom:4px;">Complétez votre profil</h3>
          <p class="hint" style="margin:0;">Ajoutez votre tarif et une présentation pour rassurer les clients et être mieux référencé(e).</p>
        </div>
        <button class="save-btn" onclick="setDashTab('profil')">Compléter maintenant</button>
      </div>
    ` : ''}
    <div class="dash-stats">
      <div class="stat-card"><div class="val">${p.slots.length}</div><div class="lbl">Créneaux publiés</div></div>
      <div class="stat-card"><div class="val">${pending.length}</div><div class="lbl">Demandes en attente</div></div>
      <div class="stat-card"><div class="val">${confirmed}</div><div class="lbl">Réservations confirmées</div></div>
      <div class="stat-card"><div class="val">${unreadMsg}</div><div class="lbl">Messages non lus</div></div>
    </div>
    <div class="profile-grid" style="grid-template-columns:1fr 1fr;margin-top:16px;">
      <div class="dash-card" style="margin:0;">
        <h3>Prochains créneaux disponibles</h3>
        ${p.slots.length ? `<div>${p.slots.slice(0,4).map(s=>`<div class="slot-row-item" style="cursor:default;"><span>${s.label}</span></div>`).join('')}</div>`
          : `<div class="empty-state">Aucun créneau publié. <a href="#" onclick="setDashTab('agenda');return false;" style="color:var(--blue-600);font-weight:600;">En ajouter un</a></div>`}
      </div>
      <div class="dash-card" style="margin:0;">
        <h3>Demandes à traiter</h3>
        ${pending.length ? `<div>${pending.slice(0,4).map(r=>`
          <div class="slot-row-item" style="cursor:default;"><span>${escapeHtml(r.client_name)} — ${r.style}</span></div>
        `).join('')}</div>` : `<div class="empty-state">Aucune demande en attente.</div>`}
      </div>
    </div>
    <div class="dash-card">
      <h3>Bienvenue, ${escapeHtml(p.name.split(' ')[0])} 👋</h3>
      <p class="hint" style="margin-bottom:0;">Gérez vos disponibilités dans « Mon agenda », répondez aux demandes de réservation dans « Demandes », et tenez votre profil public à jour pour être trouvé(e) plus facilement.</p>
    </div>
  `;
}

function renderDashAgenda(p){
  const today = new Date().toISOString().split('T')[0];
  return `
    <div class="dash-card">
      <h3>Mon agenda</h3>
      <p class="hint">Ajoutez les créneaux où vous êtes disponible pour une séance — ils apparaissent immédiatement sur votre profil public. ${p.slots.length} créneau${p.slots.length>1?'x':''} publié${p.slots.length>1?'s':''} actuellement.</p>
      <div class="add-slot-row">
        <div class="field"><label>Date</label><input type="date" id="new-slot-date" min="${today}"></div>
        <div class="field"><label>Heure</label><input type="time" id="new-slot-time"></div>
        <button id="add-slot-btn">+ Ajouter le créneau</button>
      </div>
      <div id="slot-error" style="display:none;color:#B23A3A;font-size:13px;font-weight:600;margin:-10px 0 14px;"></div>
      <div id="slot-list-dash">
        ${p.slots.length ? p.slots.map(s=>`
          <div class="slot-row-item"><span>${s.label}</span><button class="rm" data-slot-id="${s.id}">Supprimer</button></div>
        `).join('') : `<div class="empty-state">Aucun créneau publié pour l'instant.</div>`}
      </div>
    </div>
  `;
}

function renderDashRequests(p){
  const myReqs = dashRequestsCache;
  const pending = myReqs.filter(r=>r.status==='pending');
  const history = myReqs.filter(r=>r.status!=='pending');
  const statusLabel = {pending:'En attente', confirmed:'Confirmée', declined:'Refusée', cancelled_by_client:'Annulée par le client', cancelled_by_photographer:'Annulée par vous'};
  const pillClass = s => s==='confirmed' ? 'confirmed' : (s==='pending' ? 'pending' : 'declined');
  const reqCard = r => `
      <div class="req-item">
        <div class="top">
          <div><div class="who">${escapeHtml(r.client_name)}</div><div class="detail">${escapeHtml(r.client_email)}</div></div>
          <span class="status-pill ${pillClass(r.status)}">${statusLabel[r.status]}</span>
        </div>
        <div class="detail">Séance <b>${r.style}</b> — créneau demandé : <b>${r.slot_label}</b></div>
        ${r.status==='declined' && r.decline_reason ? `<div class="detail">Motif transmis au client : « ${escapeHtml(r.decline_reason)} »</div>` : ''}
        ${r.status==='pending' ? `
          <div class="req-actions">
            <button class="btn-accept" data-accept="${r.id}">Accepter</button>
            <button class="btn-decline" data-decline="${r.id}">Refuser</button>
          </div>` : ''}
        ${r.status==='confirmed' ? `
          <div class="req-actions">
            <button class="btn-decline" data-cancel="${r.id}">Annuler cette réservation</button>
          </div>` : ''}
      </div>`;
  return `
    <div class="dash-card">
      <h3>Demandes en attente ${pending.length ? `<span class="dot-badge show" style="background:var(--gold-500);color:var(--navy-950);position:relative;top:-1px;">${pending.length}</span>` : ''}</h3>
      <p class="hint">Acceptez ou refusez les demandes envoyées par les clients depuis votre profil.</p>
      ${pending.length ? pending.map(reqCard).join('') : `<div class="empty-state">Aucune demande en attente.</div>`}
    </div>
    ${history.length ? `
      <div class="dash-card">
        <h3>Historique</h3>
        ${history.map(reqCard).join('')}
      </div>
    ` : ''}
  `;
}

function renderDashMessages(p){
  const myMsgs = dashMessagesCache;
  if(!myMsgs.length) return `<div class="dash-card"><div class="empty-state">Aucun message reçu pour le moment.</div></div>`;
  return `<div class="dash-card">
    <h3>Messages reçus</h3>
    <p class="hint">Envoyés par des clients n'ayant trouvé aucun créneau correspondant à leur recherche.</p>
    ${myMsgs.map(m=>`
      <div class="msg-item">
        <div class="top">
          <div><div class="who">${escapeHtml(m.name)}</div><div class="detail">${escapeHtml(m.email)} ${m.phone ? '· '+escapeHtml(m.phone) : ''}</div></div>
          <span class="status-pill ${m.read?'confirmed':'pending'}">${m.read?'Lu':'Nouveau'}</span>
        </div>
        <div class="detail">Style souhaité : <b>${m.style}</b>${m.date_wanted ? ' · Date souhaitée : '+escapeHtml(m.date_wanted) : ''}</div>
        ${m.message ? `<div class="detail">« ${escapeHtml(m.message)} »</div>` : ''}
        <div class="req-actions">
          <a class="btn-accept" style="text-decoration:none;display:inline-block;" href="mailto:${escapeHtml(m.email)}?subject=${encodeURIComponent('Votre demande sur Captivo')}">Répondre par email</a>
          ${!m.read ? `<button class="btn-decline" data-read="${m.id}">Marquer comme lu</button>` : ''}
        </div>
      </div>
    `).join('')}
  </div>`;
}

function renderDashPortfolio(p){
  return `<div class="dash-card">
    <h3>Mon portfolio</h3>
    <p class="hint">Ajoutez vos meilleures photos — elles apparaissent directement sur votre profil public, à la place des blocs de couleur.</p>
    <div class="upload-box">
      <span style="font-size:13.5px;color:var(--ink-soft);font-weight:600;">Choisissez une photo (JPG ou PNG, 5 Mo max)</span>
      <input type="file" id="photo-upload-input" accept="image/png,image/jpeg">
      <div id="upload-status" style="display:none;font-size:13px;font-weight:600;margin-top:10px;"></div>
    </div>
    <div class="dash-portfolio-grid">
      ${dashPhotosCache.map(ph=>`
        <div class="dash-photo-item">
          <img src="${ph.url}" alt="Photo portfolio">
          <button class="rm-photo" data-photo-id="${ph.id}" data-photo-url="${ph.url}">✕</button>
        </div>
      `).join('')}
    </div>
    ${!dashPhotosCache.length ? `<div class="empty-state">Aucune photo pour l'instant.</div>` : ''}
  </div>`;
}

function renderDashProfile(p){
  const currentStyles = p.styles || [p.style];
  const styleCheckboxes = Object.keys(styleIcons).map(s=>`<label class="style-checkbox"><input type="checkbox" name="pf-styles" value="${s}" ${currentStyles.includes(s)?'checked':''} onchange="refreshPriceInputs()">${s}</label>`).join('');
  return `<div class="dash-card">
    <h3>Mon profil public</h3>
    <p class="hint">Ces informations sont visibles par les clients sur votre fiche et dans les résultats de recherche.</p>
    <div class="profile-form">
      <div class="field"><label>Nom complet</label><input type="text" id="pf-name" value="${escapeHtml(p.name)}"></div>
      <div class="field"><label>Secteur d'exercice</label><input type="text" id="pf-city" value="${escapeHtml(p.city)}"></div>
      <div class="field"><label>Styles proposés <span style="font-weight:400;color:var(--ink-soft);">(cochez-en au moins un)</span></label><div class="style-checkbox-grid">${styleCheckboxes}</div></div>
      <div class="field">
        <label>Tarifs <span style="font-weight:400;color:var(--ink-soft);">(un tarif « à partir de » par style proposé)</span></label>
        <div id="pf-prices-container">${renderPriceInputsHtml(currentStyles, p.prices || {})}</div>
      </div>
      <div class="field"><label>Présentation</label><textarea id="pf-bio">${escapeHtml(p.bio)}</textarea></div>
      <button class="save-btn" id="save-profile-btn">Enregistrer</button>
      <span class="saved-tag" id="saved-tag" style="display:none;">Profil mis à jour ✔</span>
    </div>
  </div>
  ${renderVerificationBlock(p)}`;
}

// Construit les champs "à partir de ... €" pour chaque style actuellement coché
function renderPriceInputsHtml(stylesArr, existingPrices){
  if(!stylesArr.length) return '<p class="hint" style="margin:0;">Cochez au moins un style ci-dessus pour renseigner son tarif.</p>';
  return stylesArr.map(s=>`
    <div class="price-input-row">
      <span class="price-input-label">${escapeHtml(s)}</span>
      <input type="text" class="pf-price-input" data-style="${escapeHtml(s)}" placeholder="ex. 800€" value="${escapeHtml(existingPrices[s]||'')}">
    </div>
  `).join('');
}

// Regénère les champs de tarifs quand on coche/décoche un style, sans perdre ce qui est déjà tapé
function refreshPriceInputs(){
  const checked = document.querySelectorAll('input[name="pf-styles"]:checked');
  const checkedStyles = Array.prototype.map.call(checked, c=>c.value);
  const existingInputs = document.querySelectorAll('.pf-price-input');
  const currentValues = {};
  Array.prototype.forEach.call(existingInputs, el=>{ currentValues[el.dataset.style] = el.value; });
  document.getElementById('pf-prices-container').innerHTML = renderPriceInputsHtml(checkedStyles, currentValues);
}

function renderVerificationBlock(p){
  if(p.verification_status==='verified'){
    return `<div class="dash-card">
      <h3><span class="verified-badge">✓ Vérifié</span> Identité vérifiée</h3>
      <p class="hint" style="margin-bottom:0;">Votre profil affiche le badge « Vérifié », visible par tous les clients.</p>
    </div>`;
  }
  if(p.verification_status==='pending'){
    return `<div class="dash-card">
      <h3>Vérification d'identité</h3>
      <div class="no-slots">Votre dossier est en cours d'examen. Vous recevrez une réponse par email dès qu'il aura été traité.</div>
    </div>`;
  }
  const rejected = p.verification_status==='rejected';
  return `<div class="dash-card">
    <h3>Vérification d'identité</h3>
    <p class="hint">Faites vérifier votre identité pour afficher le badge « ✓ Vérifié » sur votre profil, et rassurer les clients — même sans société créée, un justificatif d'identité suffit.</p>
    ${rejected ? `<div class="blocked-msg">Votre précédente demande a été refusée${p.verification_note ? ' : « '+escapeHtml(p.verification_note)+' »' : ''}. Vous pouvez soumettre un nouveau dossier ci-dessous.</div>` : ''}
    <div class="field"><label>Numéro SIREN <span style="font-weight:400;color:var(--ink-soft);">(facultatif — laissez vide si vous n'avez pas encore de société)</span></label><input type="text" id="verif-siret" placeholder="9 chiffres, ou laissez vide" value="${p.verification_siret||''}"></div>
    <div class="field">
      <label>Justificatif (pièce d'identité, ou extrait Kbis/SIREN si vous en avez un — PDF ou image)</label>
      <input type="file" id="verif-file" accept="image/png,image/jpeg,application/pdf">
    </div>
    <div id="verif-error" style="display:none;color:#B23A3A;font-size:13px;font-weight:600;margin-bottom:10px;"></div>
    <button class="save-btn" id="verif-submit-btn">Soumettre pour vérification</button>
  </div>`;
}

function openDeclineReason(reqId, p){
  document.getElementById('overlay').style.display='flex';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-tag photog">Refuser la demande</div>
    <h3>Expliquer le refus au client</h3>
    <p style="color:var(--ink-soft);font-size:13.5px;line-height:1.6;margin:0 0 18px;">Ce message sera visible par le client dans « Mes réservations », pour qu'il comprenne pourquoi et puisse retenter une autre date si besoin.</p>
    <form onsubmit="return submitDecline(event,'${reqId}')">
      <div class="field">
        <label>Motif du refus</label>
        <select id="decline-reason-select" onchange="document.getElementById('decline-reason-other').style.display=this.value==='Autre'?'block':'none';">
          <option>Créneau finalement indisponible</option>
          <option>Style de séance non proposé</option>
          <option>Zone géographique trop éloignée</option>
          <option>Informations manquantes / demande peu claire</option>
          <option>Autre</option>
        </select>
      </div>
      <div class="field" id="decline-reason-other" style="display:none;">
        <label>Précisez</label>
        <input type="text" id="decline-reason-text" placeholder="Détaillez le motif">
      </div>
      <button class="modal-submit photog" type="submit">Confirmer le refus</button>
    </form>
  `;
}

async function submitDecline(e, reqId){
  e.preventDefault();
  const select = document.getElementById('decline-reason-select').value;
  const other = document.getElementById('decline-reason-text').value;
  const reason = select==='Autre' && other ? other : select;
  const btn = e.target.querySelector('button[type="submit"]');
  if(btn) btn.disabled = true;

  const req = dashRequestsCache.find(x=>x.id===reqId);
  const { error } = await supabase.from('booking_requests').update({
    status:'declined', client_notified:false, decline_reason:reason
  }).eq('id', reqId);

  if(!error && req){
    const p = currentUser.photographerRef;
    await supabase.from('slots').insert({ photographer_id: p.id, label: req.slot_label });
    await fetchPhotographerSlots(p);
  }
  closeAuth();
  if(currentUser && currentUser.type==='photographer') await setDashTab('demandes');
  return false;
}

function wireDashEvents(p, tab){
  if(tab==='agenda'){
    document.getElementById('add-slot-btn').onclick = async ()=>{
      const d = document.getElementById('new-slot-date').value;
      const t = document.getElementById('new-slot-time').value;
      const errorEl = document.getElementById('slot-error');
      if(!d || !t){
        errorEl.textContent = "Choisissez une date et une heure.";
        errorEl.style.display='block';
        return;
      }
      const label = formatSlotLabel(d, t);
      if(p.slots.some(s=>s.label===label)){
        errorEl.textContent = "Ce créneau existe déjà dans votre agenda.";
        errorEl.style.display='block';
        return;
      }
      const { error } = await supabase.from('slots').insert({ photographer_id: p.id, label });
      if(error){
        errorEl.textContent = "Erreur : " + error.message;
        errorEl.style.display='block';
        return;
      }
      await setDashTab('agenda');
    };
    document.querySelectorAll('#slot-list-dash [data-slot-id]').forEach(btn=>{
      btn.onclick = async ()=>{
        await supabase.from('slots').delete().eq('id', btn.dataset.slotId);
        await setDashTab('agenda');
      };
    });
  }
  if(tab==='demandes'){
    document.querySelectorAll('[data-accept]').forEach(btn=>{
      btn.onclick = async ()=>{
        btn.disabled = true;
        await supabase.from('booking_requests').update({ status:'confirmed', client_notified:false }).eq('id', btn.dataset.accept);
        await setDashTab('demandes');
      };
    });
    document.querySelectorAll('[data-decline]').forEach(btn=>{
      btn.onclick = ()=> openDeclineReason(btn.dataset.decline, p);
    });
    document.querySelectorAll('[data-cancel]').forEach(btn=>{
      btn.onclick = async ()=>{
        if(!confirm("Confirmer l'annulation de cette réservation ? Le client sera informé.")) return;
        btn.disabled = true;
        const req = dashRequestsCache.find(x=>x.id===btn.dataset.cancel);
        await supabase.from('booking_requests').update({ status:'cancelled_by_photographer', client_notified:false }).eq('id', btn.dataset.cancel);
        if(req) await supabase.from('slots').insert({ photographer_id: p.id, label: req.slot_label });
        await fetchPhotographerSlots(p);
        await setDashTab('demandes');
      };
    });
  }
  if(tab==='messages'){
    document.querySelectorAll('[data-read]').forEach(btn=>{
      btn.onclick = async ()=>{
        await supabase.from('contact_messages').update({ read:true }).eq('id', btn.dataset.read);
        await setDashTab('messages');
      };
    });
  }
  if(tab==='portfolio'){
    document.getElementById('photo-upload-input').onchange = async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      const statusEl = document.getElementById('upload-status');
      if(file.size > 15*1024*1024){
        statusEl.style.display='block'; statusEl.style.color='#B23A3A';
        statusEl.textContent = "Fichier trop volumineux (15 Mo max).";
        return;
      }
      statusEl.style.display='block'; statusEl.style.color='var(--ink-soft)';
      statusEl.textContent = "Envoi en cours…";
      const ext = file.name.split('.').pop();
      const path = `${p.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('portfolios').upload(path, file);
      if(uploadError){
        statusEl.style.color='#B23A3A';
        statusEl.textContent = "Erreur : " + uploadError.message;
        return;
      }
      const { data: urlData } = supabase.storage.from('portfolios').getPublicUrl(path);
      await supabase.from('photographer_photos').insert({ photographer_id: p.id, url: urlData.publicUrl });
      await setDashTab('portfolio');
    };
    document.querySelectorAll('[data-photo-id]').forEach(btn=>{
      btn.onclick = async ()=>{
        btn.disabled = true;
        await supabase.from('photographer_photos').delete().eq('id', btn.dataset.photoId);
        const url = btn.dataset.photoUrl;
        const marker = '/portfolios/';
        const idx = url.indexOf(marker);
        if(idx>=0){
          const path = url.slice(idx+marker.length);
          await supabase.storage.from('portfolios').remove([path]);
        }
        await setDashTab('portfolio');
      };
    });
  }
  if(tab==='profil'){
    document.getElementById('save-profile-btn').onclick = async ()=>{
      const saveBtn = document.getElementById('save-profile-btn');
      const checkedStyles = document.querySelectorAll('input[name="pf-styles"]:checked');
      const stylesArr = checkedStyles ? Array.prototype.map.call(checkedStyles, function(c){ return c.value; }) : [];
      if(!stylesArr.length){ alert("Merci de cocher au moins un style que vous proposez."); return; }
      saveBtn.disabled = true;
      const newName = document.getElementById('pf-name').value.trim() || p.name;
      const priceInputs = document.querySelectorAll('.pf-price-input');
      const prices = {};
      Array.prototype.forEach.call(priceInputs, el=>{ if(el.value.trim()) prices[el.dataset.style] = el.value.trim(); });
      const updates = {
        name: newName,
        initials: newName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase(),
        city: document.getElementById('pf-city').value || p.city,
        style: stylesArr[0],
        styles: stylesArr,
        prices: prices,
        rate: summarizeLowestPrice(prices),
        bio: document.getElementById('pf-bio').value || p.bio
      };
      const { error } = await supabase.from('photographers').update(updates).eq('id', p.id);
      saveBtn.disabled = false;
      if(error){ alert("Erreur lors de l'enregistrement : " + error.message); return; }
      Object.assign(p, updates);
      document.getElementById('dash-name').textContent = p.name;
      document.getElementById('dash-meta').textContent = `📍 ${p.city} — ${formatStyles(p.styles)}`;
      const tag = document.getElementById('saved-tag');
      tag.style.display='inline';
      setTimeout(()=> tag.style.display='none', 2500);
    };

    const verifBtn = document.getElementById('verif-submit-btn');
    if(verifBtn){
      verifBtn.onclick = async ()=>{
        const errorEl = document.getElementById('verif-error');
        const siret = document.getElementById('verif-siret').value.trim();
        const file = document.getElementById('verif-file').files[0];
        if(siret && !/^\d{9}$/.test(siret)){
          errorEl.textContent = "Si renseigné, le SIREN doit comporter exactement 9 chiffres.";
          errorEl.style.display='block';
          return;
        }
        if(!file){
          errorEl.textContent = "Merci de joindre un justificatif.";
          errorEl.style.display='block';
          return;
        }
        if(file.size > 8*1024*1024){
          errorEl.textContent = "Fichier trop volumineux (8 Mo max).";
          errorEl.style.display='block';
          return;
        }
        verifBtn.disabled = true;
        const ext = file.name.split('.').pop();
        const path = `${p.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('verification-docs').upload(path, file);
        if(uploadError){
          errorEl.textContent = "Erreur d'envoi : " + uploadError.message;
          errorEl.style.display='block';
          verifBtn.disabled = false;
          return;
        }
        const { error } = await supabase.from('photographers').update({
          verification_status:'pending',
          verification_siret: siret || null,
          verification_document_path: path,
          verification_submitted_at: new Date().toISOString()
        }).eq('id', p.id);
        if(error){
          errorEl.textContent = "Erreur : " + error.message;
          errorEl.style.display='block';
          verifBtn.disabled = false;
          return;
        }
        p.verification_status = 'pending';
        p.verification_siret = siret;
        await setDashTab('profil');
      };
    }
  }
}


/* ---------------- PWA : installation ---------------- */
var deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
  var btn = document.getElementById('install-app-btn');
  if(btn) btn.style.display = 'inline-block';
});

async function installApp(){
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById('install-app-btn').style.display = 'none';
}

window.addEventListener('appinstalled', ()=>{
  var btn = document.getElementById('install-app-btn');
  if(btn) btn.style.display = 'none';
});

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(e=> console.warn('Service worker non enregistré :', e));
  });
}
