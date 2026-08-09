# Turing Machine — Web Edition

Une petite application web (PWA) qui génère de nouvelles énigmes de déduction
logique dans l'esprit du jeu de plateau **Turing Machine**, installable sur
Android comme une vraie application.

## ⚠️ À savoir sur les cartes de vérification

Cette version utilise les **48 vrais visuels** des cartes de vérification du
jeu (images `assets/cards/TM_GameCards_FR-01.webp` à `-48.webp`), ainsi que
la **logique réelle** de chaque carte, transcrite fidèlement à partir de ces
visuels (règle + toutes les variantes possibles + exemples imprimés sur
chaque carte, utilisés pour vérifier automatiquement que le code est exact).

C'est une application non-officielle, réalisée pour un usage strictement
personnel. Les visuels des cartes restent la propriété de l'éditeur du jeu
« Turing Machine » (Fabien Riffaud, Juliette Saudemont — Le Scorpion Masqué) ;
ne les redistribue pas publiquement.

## Comment fonctionne une carte

Chaque carte physique propose 2 à 9 critères possibles (les alternatives
imprimées en bas de la carte, par ex. "Bleu < 3 / Bleu = 3 / Bleu > 3"). Pour
chaque nouvelle énigme, l'appli tire au sort un jeu de cartes **distinctes**
puis, pour chacune, choisit **un seul** de ces critères comme "actif" — comme
la position du curseur sur la carte physique. L'image complète de la carte
est affichée, avec le critère actif mis en évidence en dessous.

## Structure du jeu

- Un code secret = 3 valeurs de 1 à 5 : **Bleu**, **Jaune**, **Violet**.
- Selon la difficulté, 3 à 6 cartes (parmi les 48, jamais deux fois la même)
  sont tirées au sort, chacune avec un critère actif tiré au sort parmi ses
  variantes possibles. Le générateur garantit que :
  - la combinaison de critères actifs détermine le code de façon **unique**
    parmi les 125 codes possibles,
  - **aucune carte n'est superflue** (retirer n'importe laquelle casse
    l'unicité de la solution).
- Le joueur propose un code, le teste contre une carte pour obtenir
  ✅/❌, note ses déductions, puis valide sa réponse finale.

## Fichiers du projet

```
index.html          Page principale
styles.css           Style (thème sombre façon carte perforée)
app.js               Logique de jeu, génération d'énigmes, interface
cards.js             Les 48 familles de cartes (règles + variantes + tests)
manifest.json        Manifeste PWA (nom, icônes, couleurs)
service-worker.js    Mise en cache pour le mode hors-ligne
icons/               Icônes de l'application (192px, 512px, maskable)
assets/cards/        Les 48 visuels officiels des cartes (format .webp)
```

## Installer l'appli sur ton téléphone Android

Une PWA doit être servie en HTTPS pour être "installable" par Chrome (ouvrir
le simple fichier `index.html` en local ne suffit pas). Voici la façon la
plus rapide et gratuite d'obtenir un lien HTTPS, **sans créer de compte** :

### Option A — Netlify Drop (le plus simple, aucun compte requis)

1. Sur un ordinateur, va sur **https://app.netlify.com/drop**
2. Glisse-dépose le dossier `turing-machine-app` (celui qui contient
   `index.html`) directement sur la page.
3. En quelques secondes, Netlify te donne une adresse du type
   `https://un-nom-aleatoire.netlify.app`.
4. Ouvre cette adresse dans **Chrome sur ton téléphone Android**.
5. Appuie sur le menu ⋮ de Chrome → **"Installer l'application"** (ou
   "Ajouter à l'écran d'accueil"). L'icône apparaît alors comme une vraie
   appli, utilisable hors-ligne.

### Option B — GitHub Pages (si tu as un compte GitHub)

1. Crée un nouveau dépôt (par ex. `turing-machine-app`) et mets-y tous les
   fichiers de ce dossier à la racine.
2. Dans les paramètres du dépôt → **Pages**, choisis la branche `main` et
   le dossier `/ (root)`.
3. GitHub te donne une adresse du type
   `https://ton-compte.github.io/turing-machine-app/`.
4. Ouvre-la dans Chrome sur ton téléphone et installe-la comme ci-dessus.

### Option C — Tester en local avant de déployer

Depuis un terminal, dans le dossier du projet :

```bash
python3 -m http.server 8080
```

puis ouvre `http://localhost:8080` dans un navigateur d'ordinateur pour
vérifier que tout fonctionne avant de déployer (l'installation PWA ne
fonctionnera pas sur `localhost` depuis un téléphone, elle est réservée au
déploiement HTTPS public ou aux tests sur le même appareil).

## Personnaliser

- **Ajouter/modifier des cartes** : édite `cards.js`. Chaque famille est un
  objet `{ id, image, summary, variants }` où `variants` est une liste de
  `{ key, label, test(code) }` (`test` reçoit `{ b, y, p }` et renvoie
  `true`/`false`). Le nom `image` correspond au fichier dans `assets/cards/`
  (sans l'extension).
- **Changer les niveaux de difficulté** : modifie le tableau
  `DIFFICULTIES` en haut de `app.js` (nombre de cartes par niveau).
- **Couleurs / thème** : tout est dans `styles.css`.
