/* ---------------- BANNIÈRE DE CONSENTEMENT COOKIES ---------------- */
(function(){
  var STORAGE_KEY = 'captivo_cookie_consent'; // valeurs possibles : "accepted" | "refused"

  function injectBanner(){
    var el = document.createElement('div');
    el.id = 'cookie-banner';
    el.innerHTML =
      '<div class="cookie-inner">' +
        '<p class="cookie-text">' +
          'Captivo utilise des cookies techniques nécessaires au fonctionnement du site (connexion à votre compte, sécurité). ' +
          'Aucun cookie publicitaire ou de suivi n\'est utilisé. ' +
          '<a href="confidentialite.html">En savoir plus</a>' +
        '</p>' +
        '<div class="cookie-actions">' +
          '<button class="cookie-btn refuse" id="cookie-refuse">Refuser les cookies non essentiels</button>' +
          '<button class="cookie-btn accept" id="cookie-accept">Accepter</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    document.getElementById('cookie-accept').onclick = function(){ setConsent('accepted'); };
    document.getElementById('cookie-refuse').onclick = function(){ setConsent('refused'); };
    requestAnimationFrame(function(){ el.classList.add('show'); });
  }

  function setConsent(value){
    try{ localStorage.setItem(STORAGE_KEY, value); } catch(e){ /* stockage indisponible, on n'insiste pas */ }
    var el = document.getElementById('cookie-banner');
    if(el) el.classList.remove('show');
  }

  function getConsent(){
    try{ return localStorage.getItem(STORAGE_KEY); } catch(e){ return null; }
  }

  document.addEventListener('DOMContentLoaded', function(){
    if(!getConsent()) injectBanner();
  });
})();
