# Captivo

Site de réservation de photographes — type "Doctolib des photographes".

## Structure du projet

```
captivo/
├── index.html      → structure de la page (HTML)
├── styles.css       → toute l'apparence du site (couleurs, mise en page, responsive)
├── app.js           → toute la logique (recherche, comptes, réservations, tableau de bord...)
├── cookie-consent.js → bannière de consentement cookies (RGPD)
├── admin.html / admin.js → panel d'administration (privé, voir plus bas)
├── mentions-legales.html    → page légale
├── cgu.html                 → conditions générales d'utilisation
├── confidentialite.html     → politique de confidentialité (RGPD)
├── assets/
│   └── logo.png
└── sql/
    ├── 01_setup.sql              → tables de base (photographes, créneaux, réservations, messages)
    ├── 02_update_photos_avis.sql → tables photos de portfolio + avis clients
    ├── 03_verification.sql       → vérification d'identité des photographes
    └── 04_admin.sql              → panel d'administration + protection anti-triche
```

## Panel d'administration

Accessible via `admin.html` (pas de lien visible sur le site public, à garder pour toi). Permet d'approuver/refuser les dossiers de vérification d'identité des photographes, et de modérer les avis.

**Pour t'ajouter comme administrateur (une seule fois) :**
1. Crée un compte normal sur Captivo (client ou photographe, peu importe) avec l'email que tu veux utiliser pour administrer
2. Dans Supabase → Authentication → Users, trouve ce compte et copie son **UID**
3. Dans Supabase → Table Editor → table `admins`, ajoute une ligne avec ce `user_id`
4. Connecte-toi ensuite sur `admin.html` avec l'email/mot de passe de ce compte

## ⚠️ Avant de publier : compléter les pages légales

Les pages `mentions-legales.html`, `cgu.html` et `confidentialite.html` contiennent des passages surlignés en orange du type `[À COMPLÉTER : ...]` — ce sont des informations que je ne pouvais pas inventer à ta place (statut juridique, SIRET, adresse...). Remplace-les avant toute mise en ligne publique. Ces pages sont des modèles rédigés avec soin mais ne remplacent pas la relecture d'un professionnel (avocat, ou service comme LegalPlace/Captain Contrat) avant un vrai lancement.

## Comment ouvrir et modifier le site

1. Ouvre le dossier `captivo/` entier dans VS Code (`Fichier > Ouvrir un dossier...`)
2. Pour voir le site s'afficher pendant que tu modifies :
   - Installe l'extension **Live Server** dans VS Code (icône Extensions à gauche, cherche "Live Server")
   - Clic droit sur `index.html` → **Open with Live Server**
   - Le site s'ouvre dans ton navigateur et se recharge automatiquement à chaque modification

## Où modifier quoi

| Je veux changer... | Fichier à ouvrir |
|---|---|
| Les couleurs, polices, tailles, mise en page | `styles.css` |
| Le texte, la structure des sections, les balises | `index.html` |
| Le fonctionnement (recherche, connexion, réservation, tableau de bord...) | `app.js` |
| La base de données (nouvelles tables, colonnes) | fichiers dans `sql/` — à exécuter dans Supabase, pas dans le navigateur |

## Connexion à Supabase

Le site est déjà connecté à ta base de données. Les identifiants se trouvent tout en haut de `app.js` :

```js
const SUPABASE_URL = "https://pieyxpbfjjpshzyevdxu.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_...";
```

Cette clé est la clé **publique** (anon key), normal qu'elle soit visible dans le code — c'est celle que Supabase prévoit pour un usage côté navigateur, protégée par les règles de sécurité (RLS) déjà en place dans les scripts SQL.

## Mettre le site en ligne après une modification

Une fois tes modifications faites et enregistrées :
1. Va sur [app.netlify.com/drop](https://app.netlify.com/drop)
2. Glisse-dépose **le dossier `captivo/` entier** (pas juste un fichier) dans la zone prévue
3. Netlify republie automatiquement ton site à jour

## Notes

- Pas de serveur ni d'installation nécessaire pour travailler sur ce projet (`npm install` non requis) — tout tourne directement dans le navigateur.
- Si tu ajoutes une nouvelle table ou colonne dans Supabase, pense à vérifier les règles de sécurité (RLS) comme dans les scripts SQL existants, sinon les données resteront inaccessibles depuis le site.
