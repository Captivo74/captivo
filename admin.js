/* ---------------- CAPTIVO — PANEL ADMIN ---------------- */
var SUPABASE_URL = "https://pieyxpbfjjpshzyevdxu.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_Dmpuq5e7RcVHxg_A7T5p6w_gdetzdd4";

var supabase;
try{
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch(e){
  console.error('Connexion Supabase impossible :', e);
}

var currentAdmin = null;

function escapeHtml(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function showLoginError(msg){
  var el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
  alert(msg);
}

async function submitAdminLogin(e){
  e.preventDefault();
  var btn = document.getElementById('login-btn');
  btn.disabled = true;
  var email = document.getElementById('admin-email').value;
  var password = document.getElementById('admin-pass').value;

  if(!supabase){
    btn.disabled = false;
    showLoginError("La connexion à Supabase n'a pas pu s'établir (problème réseau ou script bloqué). Rechargez la page et réessayez.");
    return false;
  }

  try{
    var res = await supabase.auth.signInWithPassword({ email: email, password: password });
    if(res.error){
      btn.disabled = false;
      showLoginError(res.error.message);
      return false;
    }

    var user = res.data.user;
    var adminCheck = await supabase.from('admins').select('*').eq('user_id', user.id).maybeSingle();
    if(adminCheck.error){
      await supabase.auth.signOut();
      btn.disabled = false;
      showLoginError("Erreur de vérification : " + adminCheck.error.message);
      return false;
    }
    if(!adminCheck.data){
      await supabase.auth.signOut();
      btn.disabled = false;
      showLoginError("Ce compte n'a pas les droits administrateur.");
      return false;
    }

    currentAdmin = user;
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('panel-view').style.display = 'block';
    loadAllUsers();
    loadPendingVerifications();
    loadPhotographersList();
    loadAdminsList();
    loadBansList();
    loadReviews();
    return false;
  } catch(err){
    btn.disabled = false;
    showLoginError("Erreur inattendue : " + (err && err.message ? err.message : String(err)));
    return false;
  }
}

async function logoutAdmin(){
  await supabase.auth.signOut();
  currentAdmin = null;
  document.getElementById('panel-view').style.display = 'none';
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-pass').value = '';
}

/* ---------------- VÉRIFICATIONS EN ATTENTE ---------------- */

async function loadPendingVerifications(){
  var listEl = document.getElementById('verif-list');
  listEl.innerHTML = '<div class="admin-empty">Chargement…</div>';
  var res = await supabase.from('photographers').select('*').eq('verification_status', 'pending').order('verification_submitted_at');
  var rows = res.data || [];
  document.getElementById('verif-count').textContent = rows.length;
  document.getElementById('stat-pending').textContent = rows.length;

  if(!rows.length){
    listEl.innerHTML = '<div class="admin-empty">Aucun dossier en attente.</div>';
    return;
  }

  listEl.innerHTML = rows.map(function(p){
    return (
      '<div class="admin-card" data-photographer-id="' + p.id + '">' +
        '<div class="admin-card-top">' +
          '<div>' +
            '<b>' + escapeHtml(p.name) + '</b>' +
            '<div class="admin-sub">' + escapeHtml(p.city) + ' — ' + escapeHtml(p.style) + '</div>' +
          '</div>' +
          '<span class="admin-pill">En attente</span>' +
        '</div>' +
        '<div class="admin-detail">SIRET : <b>' + escapeHtml(p.verification_siret || 'Non renseigné (photographe débutant)') + '</b></div>' +
        '<div class="admin-detail">Soumis le : ' + (p.verification_submitted_at ? new Date(p.verification_submitted_at).toLocaleString('fr-FR') : '—') + '</div>' +
        '<div class="admin-actions">' +
          '<button class="admin-btn view" data-view-doc="' + p.id + '" data-doc-path="' + (p.verification_document_path||'') + '">Voir le justificatif</button>' +
          '<button class="admin-btn approve" data-approve="' + p.id + '">Approuver</button>' +
          '<button class="admin-btn reject" data-reject="' + p.id + '">Refuser</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-view-doc]'), function(btn){
    btn.onclick = async function(){
      var path = btn.dataset.docPath;
      if(!path){ alert("Aucun fichier associé à ce dossier."); return; }
      var res = await supabase.storage.from('verification-docs').createSignedUrl(path, 300);
      if(res.error){ alert("Impossible d'ouvrir le document : " + res.error.message); return; }
      window.open(res.data.signedUrl, '_blank');
    };
  });

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-approve]'), function(btn){
    btn.onclick = async function(){
      btn.disabled = true;
      var id = btn.dataset.approve;
      var res = await supabase.from('photographers').update({ verification_status: 'verified', verification_note: null }).eq('id', id);
      if(res.error){ alert("Erreur : " + res.error.message); btn.disabled = false; return; }
      loadPendingVerifications();
    };
  });

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-reject]'), function(btn){
    btn.onclick = async function(){
      var reason = prompt("Motif du refus (visible par le photographe) :");
      if(reason === null) return;
      btn.disabled = true;
      var id = btn.dataset.reject;
      var res = await supabase.from('photographers').update({ verification_status: 'rejected', verification_note: reason }).eq('id', id);
      if(res.error){ alert("Erreur : " + res.error.message); btn.disabled = false; return; }
      loadPendingVerifications();
    };
  });
}

/* ---------------- TOUS LES COMPTES (via Edge Function admin-users) ---------------- */

var allUsersCache = [];

async function callAdminUsersFunction(payload){
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload });
  if(error){
    // supabase-js met le vrai message d'erreur JSON dans error.context si la fonction a répondu avec un code d'erreur
    let msg = error.message;
    try{
      const body = await error.context.json();
      if(body && body.error) msg = body.error;
    } catch(e){}
    return { error: msg };
  }
  return data;
}

async function loadAllUsers(){
  const listEl = document.getElementById('allusers-list');
  listEl.innerHTML = '<div class="admin-empty">Chargement…</div>';
  const res = await callAdminUsersFunction({ action: 'list_users' });
  if(res.error){
    listEl.innerHTML = `<div class="admin-empty">Erreur : ${res.error}</div>`;
    document.getElementById('allusers-count').textContent = '0';
    return;
  }
  allUsersCache = res.users || [];
  document.getElementById('allusers-count').textContent = allUsersCache.length;
  renderAllUsersList();
}

function renderAllUsersList(){
  const listEl = document.getElementById('allusers-list');
  const search = (document.getElementById('allusers-search').value || '').toLowerCase().trim();
  const roleFilter = document.getElementById('allusers-role-filter').value;

  const roleLabel = { client:'Client', photographer:'Photographe', admin:'Admin' };

  const filtered = allUsersCache.filter(u=>{
    const okRole = !roleFilter || u.role === roleFilter;
    const okSearch = !search
      || (u.email && u.email.toLowerCase().includes(search))
      || (u.full_name && u.full_name.toLowerCase().includes(search))
      || (u.photographer_name && u.photographer_name.toLowerCase().includes(search));
    return okRole && okSearch;
  });

  if(!filtered.length){
    listEl.innerHTML = '<div class="admin-empty">Aucun compte ne correspond.</div>';
    return;
  }

  listEl.innerHTML = filtered.map(u=>`
    <div class="admin-card">
      <div class="admin-card-top">
        <div>
          <b>${escapeHtml(u.full_name || u.photographer_name || '(nom non renseigné)')}</b>
          <div class="admin-sub">${escapeHtml(u.email)} · inscrit le ${new Date(u.created_at).toLocaleDateString('fr-FR')}${!u.email_confirmed ? ' · email non confirmé' : ''}</div>
        </div>
        <span class="admin-pill">${u.is_banned ? 'Banni' : roleLabel[u.role]}</span>
      </div>
      ${u.is_banned ? `<div class="admin-detail">Motif : « ${escapeHtml(u.ban_reason)} »</div>` : ''}
      <div class="admin-actions">
        ${u.is_banned
          ? `<button class="admin-btn approve" data-au-unban="${u.id}">Débannir</button>`
          : `<button class="admin-btn reject" data-au-ban="${u.id}" data-au-name="${escapeHtml(u.full_name || u.email)}">Bannir</button>`
        }
        <button class="admin-btn reject" data-au-delete="${u.id}" data-au-name="${escapeHtml(u.full_name || u.email)}">Supprimer le compte</button>
      </div>
    </div>
  `).join('');

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-au-ban]'), function(btn){
    btn.onclick = async function(){
      const reason = prompt("Motif du bannissement de " + btn.dataset.auName + " :");
      if(!reason) return;
      btn.disabled = true;
      const res = await supabase.from('banned_users').insert({ user_id: btn.dataset.auBan, reason: reason, banned_by: currentAdmin.id });
      if(res.error){ alert("Erreur : " + res.error.message); btn.disabled = false; return; }
      await loadAllUsers();
      loadPhotographersList();
      loadBansList();
    };
  });

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-au-unban]'), function(btn){
    btn.onclick = async function(){
      btn.disabled = true;
      await supabase.from('banned_users').delete().eq('user_id', btn.dataset.auUnban);
      await loadAllUsers();
      loadPhotographersList();
      loadBansList();
    };
  });

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-au-delete]'), function(btn){
    btn.onclick = async function(){
      if(!confirm("Supprimer DÉFINITIVEMENT le compte de " + btn.dataset.auName + " ? Cette action est irréversible (compte, profil, réservations...).")) return;
      btn.disabled = true;
      const res = await callAdminUsersFunction({ action:'delete_user', user_id: btn.dataset.auDelete });
      if(res.error){ alert("Erreur : " + res.error); btn.disabled = false; return; }
      await loadAllUsers();
      loadPhotographersList();
      loadAdminsList();
    };
  });
}

document.getElementById('create-user-btn').onclick = async function(){
  const errorEl = document.getElementById('cu-error');
  errorEl.style.display = 'none';

  const name = document.getElementById('cu-name').value.trim();
  const email = document.getElementById('cu-email').value.trim();
  const password = document.getElementById('cu-password').value;
  const type = document.getElementById('cu-type').value;
  const city = document.getElementById('cu-city').value.trim();
  const style = document.getElementById('cu-style').value;

  if(!name || !email || !password){
    errorEl.textContent = "Nom, email et mot de passe sont requis.";
    errorEl.style.display = 'block';
    return;
  }
  if(password.length < 6){
    errorEl.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
    errorEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('create-user-btn');
  btn.disabled = true;
  const res = await callAdminUsersFunction({
    action: 'create_user', email, password, full_name: name, type, city, style
  });
  btn.disabled = false;

  if(res.error){
    errorEl.textContent = res.error;
    errorEl.style.display = 'block';
    return;
  }

  document.getElementById('cu-name').value = '';
  document.getElementById('cu-email').value = '';
  document.getElementById('cu-password').value = '';
  document.getElementById('cu-city').value = '';
  await loadAllUsers();
  if(type === 'photographer') loadPhotographersList();
};

/* ---------------- TOUS LES PHOTOGRAPHES ---------------- */

async function loadPhotographersList(){
  var listEl = document.getElementById('photographers-list');
  listEl.innerHTML = '<div class="admin-empty">Chargement…</div>';
  var res = await supabase.from('photographers').select('*, photographer_emails(email)').order('name');
  var rows = res.data || [];
  document.getElementById('photographers-count').textContent = rows.length;
  document.getElementById('stat-photographers').textContent = rows.length;
  document.getElementById('stat-verified').textContent = rows.filter(function(p){ return p.verification_status==='verified'; }).length;

  var banRes = await supabase.from('banned_users').select('user_id');
  var bannedIds = (banRes.data || []).map(function(b){ return b.user_id; });

  if(!rows.length){
    listEl.innerHTML = '<div class="admin-empty">Aucun photographe inscrit pour le moment.</div>';
    return;
  }

  var statusLabel = { unverified:'Non vérifié', pending:'En attente', verified:'Vérifié ✓', rejected:'Refusé' };

  listEl.innerHTML = rows.map(function(p){
    var email = p.photographer_emails ? p.photographer_emails.email : null;
    var isBanned = bannedIds.indexOf(p.user_id) !== -1;
    return (
      '<div class="admin-card">' +
        '<div class="admin-card-top">' +
          '<div>' +
            '<b>' + escapeHtml(p.name) + '</b>' +
            '<div class="admin-sub">' + escapeHtml(p.city) + ' — ' + escapeHtml(p.style) + (email ? ' · ' + escapeHtml(email) : '') + '</div>' +
          '</div>' +
          '<span class="admin-pill">' + (isBanned ? 'Banni' : statusLabel[p.verification_status]) + '</span>' +
        '</div>' +
        '<div class="admin-actions">' +
          (email ? '<a class="admin-btn view" style="text-decoration:none;display:inline-block;" href="mailto:' + email + '">Envoyer un email</a>' : '') +
          '<button class="admin-btn view" data-delete-profile="' + p.id + '">Supprimer le profil</button>' +
          (isBanned
            ? '<button class="admin-btn approve" data-unban-uid="' + p.user_id + '">Débannir</button>'
            : '<button class="admin-btn reject" data-ban-uid="' + p.user_id + '" data-ban-name="' + escapeHtml(p.name) + '">Bannir</button>') +
        '</div>' +
      '</div>'
    );
  }).join('');

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-delete-profile]'), function(btn){
    btn.onclick = async function(){
      if(!confirm("Supprimer définitivement le profil public de ce photographe ? Son compte de connexion ne sera pas supprimé, seulement sa fiche.")) return;
      btn.disabled = true;
      await supabase.from('photographers').delete().eq('id', btn.dataset.deleteProfile);
      loadPhotographersList();
    };
  });

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-ban-uid]'), function(btn){
    btn.onclick = async function(){
      var reason = prompt("Motif du bannissement de " + btn.dataset.banName + " (visible par la personne bannie) :");
      if(!reason) return;
      btn.disabled = true;
      var res = await supabase.from('banned_users').insert({ user_id: btn.dataset.banUid, reason: reason, banned_by: currentAdmin.id });
      if(res.error){ alert("Erreur : " + res.error.message); btn.disabled = false; return; }
      loadPhotographersList();
      loadBansList();
    };
  });

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-unban-uid]'), function(btn){
    btn.onclick = async function(){
      btn.disabled = true;
      await supabase.from('banned_users').delete().eq('user_id', btn.dataset.unbanUid);
      loadPhotographersList();
      loadBansList();
    };
  });
}

/* ---------------- GESTION DES CLIENTS ---------------- */

async function loadClientsList(){
  var listEl = document.getElementById('clients-list');
  listEl.innerHTML = '<div class="admin-empty">Chargement…</div>';
  var res = await callAdminUsersFunction({ action: 'list_users' });
  if(res.error){
    listEl.innerHTML = '<div class="admin-empty">Erreur : ' + escapeHtml(res.error) + '</div>';
    document.getElementById('clients-count').textContent = '0';
    return;
  }
  var rows = (res.users || []).filter(function(u){ return u.role === 'client'; });
  document.getElementById('clients-count').textContent = rows.length;

  if(!rows.length){
    listEl.innerHTML = '<div class="admin-empty">Aucun client inscrit pour le moment.</div>';
    return;
  }

  listEl.innerHTML = rows.map(function(u){
    return (
      '<div class="admin-card">' +
        '<div class="admin-card-top">' +
          '<div>' +
            '<b>' + escapeHtml(u.full_name || '(nom non renseigné)') + '</b>' +
            '<div class="admin-sub">' + escapeHtml(u.email) + ' · inscrit le ' + new Date(u.created_at).toLocaleDateString('fr-FR') + '</div>' +
          '</div>' +
          '<span class="admin-pill">' + (u.is_banned ? 'Banni' : 'Client') + '</span>' +
        '</div>' +
        (u.is_banned ? '<div class="admin-detail">Motif : « ' + escapeHtml(u.ban_reason) + ' »</div>' : '') +
        '<div class="admin-actions">' +
          '<a class="admin-btn view" style="text-decoration:none;display:inline-block;" href="mailto:' + escapeHtml(u.email) + '">Envoyer un email</a>' +
          (u.is_banned
            ? '<button class="admin-btn approve" data-client-unban="' + u.id + '">Débannir</button>'
            : '<button class="admin-btn reject" data-client-ban="' + u.id + '" data-client-name="' + escapeHtml(u.full_name || u.email) + '">Bannir</button>') +
          '<button class="admin-btn reject" data-client-delete="' + u.id + '" data-client-name="' + escapeHtml(u.full_name || u.email) + '">Supprimer le compte</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-client-ban]'), function(btn){
    btn.onclick = async function(){
      var reason = prompt("Motif du bannissement de " + btn.dataset.clientName + " (visible par la personne bannie) :");
      if(!reason) return;
      btn.disabled = true;
      var res = await supabase.from('banned_users').insert({ user_id: btn.dataset.clientBan, reason: reason, banned_by: currentAdmin.id });
      if(res.error){ alert("Erreur : " + res.error.message); btn.disabled = false; return; }
      loadClientsList();
      loadBansList();
    };
  });

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-client-unban]'), function(btn){
    btn.onclick = async function(){
      btn.disabled = true;
      await supabase.from('banned_users').delete().eq('user_id', btn.dataset.clientUnban);
      loadClientsList();
      loadBansList();
    };
  });

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-client-delete]'), function(btn){
    btn.onclick = async function(){
      if(!confirm("Supprimer DÉFINITIVEMENT le compte de " + btn.dataset.clientName + " ? Cette action est irréversible.")) return;
      btn.disabled = true;
      var res = await callAdminUsersFunction({ action:'delete_user', user_id: btn.dataset.clientDelete });
      if(res.error){ alert("Erreur : " + res.error); btn.disabled = false; return; }
      loadClientsList();
    };
  });
}

/* ---------------- GESTION DES ADMINS ---------------- */

async function loadAdminsList(){
  var listEl = document.getElementById('admins-list');
  listEl.innerHTML = '<div class="admin-empty">Chargement…</div>';
  var res = await supabase.from('admins').select('*').order('created_at');
  var rows = res.data || [];
  document.getElementById('admins-count').textContent = rows.length;

  if(!rows.length){
    listEl.innerHTML = '<div class="admin-empty">Aucun administrateur trouvé.</div>';
    return;
  }

  listEl.innerHTML = rows.map(function(a){
    var isSelf = currentAdmin && a.user_id === currentAdmin.id;
    return (
      '<div class="admin-card">' +
        '<div class="admin-card-top">' +
          '<div>' +
            '<b>' + a.user_id + '</b>' +
            (isSelf ? '<div class="admin-sub">C\'est vous</div>' : '') +
          '</div>' +
          '<span class="admin-pill">Admin</span>' +
        '</div>' +
        (isSelf ? '' : '<div class="admin-actions"><button class="admin-btn reject" data-remove-admin="' + a.id + '">Retirer les droits admin</button></div>') +
      '</div>'
    );
  }).join('');

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-remove-admin]'), function(btn){
    btn.onclick = async function(){
      if(!confirm("Retirer les droits administrateur de ce compte ?")) return;
      btn.disabled = true;
      await supabase.from('admins').delete().eq('id', btn.dataset.removeAdmin);
      loadAdminsList();
    };
  });

  var addBtn = document.getElementById('add-admin-btn');
  addBtn.onclick = async function(){
    var errorEl = document.getElementById('admin-form-error');
    errorEl.style.display = 'none';
    var uid = document.getElementById('new-admin-uid').value.trim();
    if(!/^[0-9a-f-]{36}$/i.test(uid)){
      errorEl.textContent = "Cela ne ressemble pas à un UID valide (36 caractères avec tirets).";
      errorEl.style.display = 'block';
      return;
    }
    addBtn.disabled = true;
    var res = await supabase.from('admins').insert({ user_id: uid });
    addBtn.disabled = false;
    if(res.error){
      errorEl.textContent = "Erreur : " + res.error.message;
      errorEl.style.display = 'block';
      return;
    }
    document.getElementById('new-admin-uid').value = '';
    loadAdminsList();
  };
}

/* ---------------- BANNISSEMENT ---------------- */

async function loadBansList(){
  var listEl = document.getElementById('bans-list');
  listEl.innerHTML = '<div class="admin-empty">Chargement…</div>';
  var res = await supabase.from('banned_users').select('*').order('banned_at', { ascending:false });
  var rows = res.data || [];
  document.getElementById('bans-count').textContent = rows.length;

  if(!rows.length){
    listEl.innerHTML = '<div class="admin-empty">Aucun compte banni actuellement.</div>';
  } else {
    listEl.innerHTML = rows.map(function(b){
      return (
        '<div class="admin-card">' +
          '<div class="admin-card-top">' +
            '<div>' +
              '<b>' + b.user_id + '</b>' +
              '<div class="admin-sub">Banni le ' + new Date(b.banned_at).toLocaleString('fr-FR') + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="admin-detail">Motif : « ' + escapeHtml(b.reason) + ' »</div>' +
          '<div class="admin-actions"><button class="admin-btn approve" data-unban="' + b.user_id + '">Débannir</button></div>' +
        '</div>'
      );
    }).join('');

    Array.prototype.forEach.call(listEl.querySelectorAll('[data-unban]'), function(btn){
      btn.onclick = async function(){
        btn.disabled = true;
        await supabase.from('banned_users').delete().eq('user_id', btn.dataset.unban);
        loadBansList();
        loadPhotographersList();
      };
    });
  }

  var submitBtn = document.getElementById('ban-submit-btn');
  submitBtn.onclick = async function(){
    var errorEl = document.getElementById('ban-form-error');
    errorEl.style.display = 'none';
    var uid = document.getElementById('ban-uid').value.trim();
    var reason = document.getElementById('ban-reason').value.trim();
    if(!/^[0-9a-f-]{36}$/i.test(uid)){
      errorEl.textContent = "Cela ne ressemble pas à un UID valide (36 caractères avec tirets).";
      errorEl.style.display = 'block';
      return;
    }
    if(!reason){
      errorEl.textContent = "Merci d'indiquer un motif.";
      errorEl.style.display = 'block';
      return;
    }
    submitBtn.disabled = true;
    var res = await supabase.from('banned_users').insert({ user_id: uid, reason: reason, banned_by: currentAdmin.id });
    submitBtn.disabled = false;
    if(res.error){
      errorEl.textContent = "Erreur : " + res.error.message;
      errorEl.style.display = 'block';
      return;
    }
    document.getElementById('ban-uid').value = '';
    document.getElementById('ban-reason').value = '';
    loadBansList();
    loadPhotographersList();
  };
}

/* ---------------- MODÉRATION DES AVIS ---------------- */

async function loadReviews(){
  var listEl = document.getElementById('reviews-list');
  listEl.innerHTML = '<div class="admin-empty">Chargement…</div>';
  var res = await supabase.from('reviews').select('*, photographers(name)').order('created_at', { ascending:false });
  var rows = res.data || [];
  document.getElementById('reviews-count').textContent = rows.length;
  document.getElementById('stat-reviews').textContent = rows.length;

  if(!rows.length){
    listEl.innerHTML = '<div class="admin-empty">Aucun avis publié.</div>';
    return;
  }

  listEl.innerHTML = rows.map(function(r){
    return (
      '<div class="admin-card">' +
        '<div class="admin-card-top">' +
          '<div>' +
            '<b>' + escapeHtml(r.client_name || 'Client') + '</b>' +
            '<div class="admin-sub">à propos de ' + escapeHtml(r.photographers ? r.photographers.name : '—') + '</div>' +
          '</div>' +
          '<span class="admin-pill stars">' + '★'.repeat(r.rating) + '☆'.repeat(5-r.rating) + '</span>' +
        '</div>' +
        (r.comment ? '<div class="admin-detail">« ' + escapeHtml(r.comment) + ' »</div>' : '') +
        '<div class="admin-actions"><button class="admin-btn reject" data-delete-review="' + r.id + '">Supprimer cet avis</button></div>' +
      '</div>'
    );
  }).join('');

  Array.prototype.forEach.call(listEl.querySelectorAll('[data-delete-review]'), function(btn){
    btn.onclick = async function(){
      if(!confirm("Supprimer définitivement cet avis ?")) return;
      btn.disabled = true;
      await supabase.from('reviews').delete().eq('id', btn.dataset.deleteReview);
      loadReviews();
    };
  });
}

function setAdminTab(tab){
  document.querySelectorAll('.admin-tab').forEach(function(t){ t.classList.toggle('active', t.dataset.tab===tab); });
  document.querySelectorAll('.admin-section').forEach(function(s){ s.style.display = s.dataset.section===tab ? 'block' : 'none'; });
  if(tab==='clients') loadClientsList();
}

/* ---------------- PWA : installation ---------------- */
var deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', function(e){
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

window.addEventListener('appinstalled', function(){
  var btn = document.getElementById('install-app-btn');
  if(btn) btn.style.display = 'none';
});

if('serviceWorker' in navigator){
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js').catch(function(e){ console.warn('Service worker non enregistré :', e); });
  });
}
