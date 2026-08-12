// ============================================================================
// Turing Machine — Web Edition — moteur de jeu et interface
// ============================================================================
(function () {
  "use strict";

  const { FAMILIES, VALUES, allCodes, codeEquals, codeKey } = window.TuringCards;
  const ALL_CODES = allCodes();

  // Identifiants "lettre" (A à F) attribués aux cartes actives d'une énigme,
  // dans l'ordre de tirage — au maximum 6 cartes actives (durée "Long").
  const LETTERS = ["A", "B", "C", "D", "E", "F"];

  // La "difficulté" restreint le pool de cartes utilisables (par numéro de
  // carte) ; la "durée" fixe le nombre de cartes actives dans l'énigme.
  // Les deux réglages sont indépendants et se combinent librement.
  const DIFFICULTIES = [
    { id: "facile", label: "Facile", maxCardId: 20, minCardId: 1, char: "F" },
    { id: "standard", label: "Standard", maxCardId: 35, minCardId: 1, char: "S" },
    { id: "expert", label: "Expert", maxCardId: 48, minCardId: 10, char: "X" },
    { id: "extremz", label: "Extrème", maxCardId: 48, minCardId: 25, char: "E" },
  ];
  const DURATIONS = [
    { id: "express", label: "Express", cardCount: 3, char: "3" },
    { id: "court", label: "Court", cardCount: 4, char: "4" },
    { id: "normal", label: "Normal", cardCount: 5, char: "5" },
    { id: "long", label: "Long", cardCount: 6, char: "6" },
  ];
  const DIFF_BY_CHAR = Object.fromEntries(DIFFICULTIES.map((d) => [d.char, d]));
  const DURATION_BY_CHAR = Object.fromEntries(DURATIONS.map((d) => [d.char, d]));

  // ------------------------------------------------------------------------
  // Bloc-notes : aide-mémoire personnel (élimine/valide un chiffre par
  // couleur), purement manuel — n'influence jamais la logique du jeu.
  // ------------------------------------------------------------------------
  const NOTE_VALUES = [5, 4, 3, 2, 1];
  const NOTE_CYCLE = ["none", "eliminated", "confirmed"];

  function freshNotes() {
    const notes = {};
    ["b", "y", "p"].forEach((color) => {
      notes[color] = {};
      VALUES.forEach((v) => {
        notes[color][v] = "none";
      });
    });
    return notes;
  }

  // ------------------------------------------------------------------------
  // Repérage visuel des variantes imprimées sur chaque visuel de carte, pour
  // pouvoir superposer une zone cliquable par variante (croix rouge
  // d'élimination manuelle, purement personnelle — n'influence pas le jeu).
  // Calibré par analyse d'image des 48 visuels réels : la zone des variantes
  // occupe toujours la même bande verticale (39%-92% de la hauteur), divisée
  // en une grille rows×cols dont l'ordre de remplissage (ligne ou colonne)
  // correspond à l'ordre du tableau `variants` de chaque famille.
  const VARIANT_BAND_TOP = 391 / 675;
  const VARIANT_BAND_BOTTOM = 621 / 675;
  const GRID_OVERRIDES = {
    33: { rows: 2, cols: 3, order: "col" },
    39: { rows: 2, cols: 3, order: "col" },
    40: { rows: 3, cols: 3, order: "col" },
    41: { rows: 3, cols: 3, order: "col" },
    42: { rows: 2, cols: 3, order: "row" },
    43: { rows: 2, cols: 3, order: "row" },
    44: { rows: 2, cols: 3, order: "row" },
    45: { rows: 2, cols: 4, order: "row" },
    46: { rows: 2, cols: 4, order: "row" },
    47: { rows: 2, cols: 4, order: "row" },
    48: { rows: 3, cols: 3, order: "col" },
  };

  function gridFor(family) {
    return GRID_OVERRIDES[parseInt(family.id, 10)] || { rows: 1, cols: family.variants.length, order: "row" };
  }

  // Rectangle (en % de l'image) occupé par la variante d'index `index`.
  function variantCellRect(family, index) {
    const { rows, cols, order } = gridFor(family);
    const row = order === "col" ? index % rows : Math.floor(index / cols);
    const col = order === "col" ? Math.floor(index / rows) : index % cols;
    const cellW = 100 / cols;
    const cellH = ((VARIANT_BAND_BOTTOM - VARIANT_BAND_TOP) * 100) / rows;
    return {
      left: col * cellW,
      top: VARIANT_BAND_TOP * 100 + row * cellH,
      width: cellW,
      height: cellH,
    };
  }

  // ------------------------------------------------------------------------
  // Générateur pseudo-aléatoire seedé (mulberry32) : permet de faire
  // correspondre un code alphanumérique d'énigme à une séquence de tirages
  // 100% reproductible, sur n'importe quel appareil.
  // ------------------------------------------------------------------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleWithRng(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function randomCodeWithRng(rng) {
    return {
      b: VALUES[Math.floor(rng() * VALUES.length)],
      y: VALUES[Math.floor(rng() * VALUES.length)],
      p: VALUES[Math.floor(rng() * VALUES.length)],
    };
  }

  // ------------------------------------------------------------------------
  // Code d'énigme alphanumérique <-> (difficulté, durée, seed 32 bits)
  // ------------------------------------------------------------------------
  function seedToPuzzleCode(diff, duration, seed) {
    const seedStr = (seed >>> 0).toString(36).toUpperCase().padStart(7, "0");
    return `${diff.char}${duration.char}-${seedStr}`;
  }

  function parsePuzzleCode(input) {
    const clean = (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length < 3) return { error: "Code trop court." };
    const diffChar = clean[0];
    const durationChar = clean[1];
    const diff = DIFF_BY_CHAR[diffChar];
    const duration = DURATION_BY_CHAR[durationChar];
    if (!diff) return { error: `Difficulté inconnue ("${diffChar}"). Le code doit commencer par F, S ou X.` };
    if (!duration) return { error: `Durée inconnue ("${durationChar}"). Le 2e caractère doit être 3, 4, 5 ou 6.` };
    const seedStr = clean.slice(2);
    const seed = parseInt(seedStr, 36);
    if (!seedStr || Number.isNaN(seed)) return { error: "Code invalide." };
    return { diff, duration, seed: seed >>> 0 };
  }

  // ------------------------------------------------------------------------
  // Pool à plat de tous les (famille, variante) possibles, filtrable par
  // difficulté (numéro de carte maximum autorisé).
  // ------------------------------------------------------------------------
  function flattenPool() {
    const pool = [];
    for (const family of FAMILIES) {
      for (const variant of family.variants) pool.push({ family, variant });
    }
    return pool;
  }
  const POOL = flattenPool();

  function poolForDifficulty(diff) {
    return POOL.filter((entry) =>  parseInt(entry.family.id, 10) >= diff.minCardId && parseInt(entry.family.id, 10) <= diff.maxCardId);
  }

  function sampleActiveCards(pool, n, rng) {
    const shuffled = shuffleWithRng(pool, rng);
    const usedFamilies = new Set();
    const chosen = [];
    for (const entry of shuffled) {
      if (usedFamilies.has(entry.family.id)) continue;
      chosen.push(entry);
      usedFamilies.add(entry.family.id);
      if (chosen.length === n) break;
    }
    return chosen.length === n ? chosen : null;
  }

  function candidatesFor(secret, activeCards) {
    return ALL_CODES.filter((code) =>
      activeCards.every((ac) => ac.variant.test(code) === ac.variant.test(secret))
    );
  }

  function isMinimal(secret, activeCards) {
    for (let i = 0; i < activeCards.length; i++) {
      const withoutOne = activeCards.slice(0, i).concat(activeCards.slice(i + 1));
      if (candidatesFor(secret, withoutOne).length === 1) return false;
    }
    return true;
  }

  /**
   * Génère une énigme jouable et 100% reproductible à partir d'une seed :
   * un code secret + un jeu de vérificateurs (chacun tiré d'une carte
   * distincte, parmi celles autorisées par la difficulté) qui détermine le
   * code de façon unique parmi les 125 possibles, sans carte superflue.
   *
   * Comme sur les cartes physiques du jeu, le curseur de chaque carte tirée
   * est toujours positionné sur le critère qui est VRAI pour le code secret :
   * on ne pioche donc que parmi les variantes vraies pour ce code (jamais une
   * variante qui serait fausse pour le secret). Un "VRAI" en jeu confirme
   * ainsi toujours que le code testé reste compatible avec le secret, et un
   * "FAUX" l'élimine directement.
   */
  function generatePuzzleFromSeed(diff, duration, seed) {
    const rng = mulberry32(seed);
    const basePool = poolForDifficulty(diff);
    const maxAttempts = 8000;
    let best = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const secret = randomCodeWithRng(rng);
      const truthyPool = basePool.filter((entry) => entry.variant.test(secret));
      const activeCards = sampleActiveCards(truthyPool, duration.cardCount, rng);
      if (!activeCards) continue;
      const candidates = candidatesFor(secret, activeCards);
      if (candidates.length === 1) {
        if (isMinimal(secret, activeCards)) {
          return { secret, activeCards };
        } else if (!best) {
          best = { secret, activeCards };
        }
      }
    }
    if (best) return best;

    const fallbackSecret = randomCodeWithRng(rng);
    const fallbackTruthyPool = basePool.filter((entry) => entry.variant.test(fallbackSecret));
    const fallbackCards = sampleActiveCards(fallbackTruthyPool, duration.cardCount, rng);
    return { secret: fallbackSecret, activeCards: fallbackCards };
  }

  function randomSeed() {
    return (Math.random() * 4294967296) >>> 0;
  }

  // ------------------------------------------------------------------------
  // État du jeu
  // ------------------------------------------------------------------------
  let state = {
    // Au premier lancement (aucune partie en cours), on propose une énigme
    // courte et facile plutôt qu'une difficulté/durée par défaut arbitraire.
    difficulty: "facile",
    duration: "express",
    puzzleCode: "",
    secret: null,
    activeCards: [],
    // Chaque ligne du suivi de déduction correspond à UN code distinct.
    // rows[i] = { code: {b,y,p}, cells: { [lettre]: true/false, bulb?: true/false } }
    // Une ligne "test" contient des clés lettre (A..F) ; une ligne "soumission"
    // ne contient que la clé "bulb" et est toujours créée à part (jamais fusionnée
    // avec une ligne de test existante pour le même code).
    rows: [],
    solved: false,
    gaveUp: false,
    startedAt: null,
    // Temps de résolution (en secondes), figé au moment de la soumission
    // gagnante — pour ne pas continuer à courir après coup si la partie est
    // rechargée plus tard.
    solveSeconds: null,
    notes: freshNotes(),
    // Croix rouges posées manuellement sur les variantes imprimées des
    // cartes actives, purement pour l'aide à la déduction personnelle —
    // clé `${familyId}:${variantIndex}` -> true. Remis à zéro à chaque
    // nouvelle énigme (voir startPuzzle).
    crossedVariants: {},
  };

  const el = (sel) => document.querySelector(sel);
  const elAll = (sel) => Array.from(document.querySelectorAll(sel));

  // ------------------------------------------------------------------------
  // Affichage "façon jeu" d'un code (formes colorées + gros chiffres)
  // ------------------------------------------------------------------------
  function codeDisplayHTML(code, size) {
    const sizeClass = size === "sm" ? " code-digit--sm" : "";
    const shapeSize = size === "sm" ? "shape--sm" : "shape--lg";
    return `
      <span class="code-display">
        <span class="code-chip"><span class="shape shape--b ${shapeSize}"></span><span class="code-digit code-digit--b${sizeClass}">${code.b}</span></span>
        <span class="code-chip"><span class="shape shape--y ${shapeSize}"></span><span class="code-digit code-digit--y${sizeClass}">${code.y}</span></span>
        <span class="code-chip"><span class="shape shape--p ${shapeSize}"></span><span class="code-digit code-digit--p${sizeClass}">${code.p}</span></span>
      </span>
    `;
  }

  // ------------------------------------------------------------------------
  // Menu latéral & popins
  // ------------------------------------------------------------------------
  function openOverlay(kind) {
    el("#overlay-backdrop").classList.remove("hidden");
    if (kind === "menu") el("#side-menu").classList.remove("hidden");
    if (kind === "newgame") el("#modal-newgame").classList.remove("hidden");
    if (kind === "help") el("#modal-help").classList.remove("hidden");
    if (kind === "notes") el("#notes-panel").classList.remove("hidden");
    if (kind === "confirmsubmit") el("#modal-confirm-submit").classList.remove("hidden");
  }

  function closeAllOverlays() {
    el("#overlay-backdrop").classList.add("hidden");
    el("#side-menu").classList.add("hidden");
    el("#modal-newgame").classList.add("hidden");
    el("#modal-help").classList.add("hidden");
    el("#notes-panel").classList.add("hidden");
    el("#modal-confirm-submit").classList.add("hidden");
  }

  // ------------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------------
  function renderDifficultyPicker() {
    const wrap = el("#difficulty-picker");
    wrap.innerHTML = "";
    DIFFICULTIES.forEach((d) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (state.difficulty === d.id ? " chip--active" : "");
      btn.textContent = d.label;
      btn.addEventListener("click", () => {
        state.difficulty = d.id;
        renderDifficultyPicker();
      });
      wrap.appendChild(btn);
    });
  }

  function renderDurationPicker() {
    const wrap = el("#duration-picker");
    wrap.innerHTML = "";
    DURATIONS.forEach((d) => {
      const btn = document.createElement("button");
      btn.className = "chip" + (state.duration === d.id ? " chip--active" : "");
      btn.textContent = `${d.cardCount} cartes`;
      btn.addEventListener("click", () => {
        state.duration = d.id;
        renderDurationPicker();
      });
      wrap.appendChild(btn);
    });
  }

  function renderPuzzleCode() {
    el("#puzzle-code").textContent = state.puzzleCode;
  }

  // Zones cliquables superposées au visuel d'une carte, une par variante
  // imprimée, pour permettre au joueur de poser une croix rouge manuelle sur
  // celles qu'il a déduit être éliminées (pure aide-mémoire personnelle,
  // n'influence jamais le jeu).
  function variantZonesHTML(family) {
    return family.variants
      .map((_, index) => {
        const rect = variantCellRect(family, index);
        const key = `${family.id}:${index}`;
        const crossedClass = state.crossedVariants[key] ? " card__variant-zone--crossed" : "";
        return `
          <div class="card__variant-zone${crossedClass}" data-family="${family.id}" data-index="${index}"
               style="left:${rect.left}%;top:${rect.top}%;width:${rect.width}%;height:${rect.height}%;"
               title="Marquer/démarquer cette possibilité comme éliminée">
            <svg class="card__variant-cross" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line x1="8" y1="8" x2="92" y2="92"></line>
              <line x1="92" y1="8" x2="8" y2="92"></line>
            </svg>
          </div>`;
      })
      .join("");
  }

  function toggleVariantCross(familyId, index) {
    const key = `${familyId}:${index}`;
    if (state.crossedVariants[key]) delete state.crossedVariants[key];
    else state.crossedVariants[key] = true;
    const zone = document.querySelector(`.card__variant-zone[data-family="${familyId}"][data-index="${index}"]`);
    if (zone) zone.classList.toggle("card__variant-zone--crossed", !!state.crossedVariants[key]);
    saveState();
  }

  // Le critère actif d'une carte n'est révélé qu'une fois l'énigme résolue
  // (ou après avoir demandé la solution) — jamais à la demande, pour
  // préserver le côté déductif du jeu.
  function renderCards() {
    const wrap = el("#cards-grid");
    wrap.innerHTML = "";
    const revealed = state.solved || state.gaveUp;
    state.activeCards.forEach((ac) => {
      const cardEl = document.createElement("div");
      cardEl.className = "card";
      cardEl.innerHTML = `
        <div class="card__img-wrap">
          <img class="card__img" src="assets/cards/${ac.family.image}.webp" alt="Carte de vérification ${ac.letter}" loading="lazy" />
          <div class="card__variant-overlay">${variantZonesHTML(ac.family)}</div>
        </div>
        <div class="card__active ${revealed ? "" : "hidden"}" data-active-id="${ac.family.id}">
          <span class="card__active-label">Segment actif pour cette énigme</span>
          <strong>${ac.variant.label}</strong>
        </div>
        <button class="card__test-btn" data-letter="${ac.letter}">
          <span class="card__test-btn__badges">
            <span class="card__letter">${ac.letter}</span>
          </span>
          <span class="card__test-btn__label">Tester</span>
        </button>
      `;
      wrap.appendChild(cardEl);
    });
    elAll(".card__test-btn").forEach((btn) => {
      btn.addEventListener("click", () => testCard(btn.dataset.letter));
    });
    elAll(".card__variant-zone").forEach((zone) => {
      zone.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleVariantCross(zone.dataset.family, parseInt(zone.dataset.index, 10));
      });
    });
    updateCardButtonsState();
  }

  // Dévoile le critère actif de toutes les cartes (énigme résolue ou
  // solution demandée), sans recharger les images.
  function revealAllActiveCards() {
    elAll(".card__active").forEach((box) => box.classList.remove("hidden"));
    updateSolvedViewClass();
  }

  // Une fois la partie terminée (résolue ou abandonnée), bascule vers un
  // affichage "récapitulatif" sans défilement interne : le suivi de
  // déduction complet et toutes les cartes actives restent visibles sans
  // avoir à scroller dans des panneaux exigus (c'est alors la page entière
  // qui défile si besoin). Revient à l'affichage normal (panneaux à
  // défilement indépendant) dès qu'une nouvelle énigme démarre.
  function updateSolvedViewClass() {
    document.body.classList.toggle("is-solved", state.solved || state.gaveUp);
  }

  function getProposedCode() {
    return {
      b: parseInt(el("#select-b").value, 10),
      y: parseInt(el("#select-y").value, 10),
      p: parseInt(el("#select-p").value, 10),
    };
  }

  const MAX_TESTS_PER_CODE = 3;

  // Une ligne de test regroupe tous les tests effectués sur UN même code
  // (jusqu'à 3 cartes différentes). Les soumissions ("ampoule") vivent
  // toujours dans leur propre ligne, jamais fusionnée avec une ligne de test.
  function findTestRowForCode(code) {
    const key = codeKey(code);
    return state.rows.find((r) => !("bulb" in r.cells) && codeKey(r.code) === key);
  }

  function countTestedCells(row) {
    if (!row) return 0;
    return Object.keys(row.cells).filter((k) => k !== "bulb").length;
  }

  // Liste à plat de tous les tests par carte effectués (toutes lignes
  // confondues), utile pour les statistiques. Les soumissions n'y figurent
  // pas : elles ne renseignent pas sur un critère précis, seulement sur le
  // code entier.
  function allTestCells() {
    const cells = [];
    state.rows.forEach((row) => {
      if ("bulb" in row.cells) return;
      Object.keys(row.cells).forEach((letter) => {
        cells.push({ code: row.code, letter, result: row.cells[letter] });
      });
    });
    return cells;
  }

  function testCard(letter) {
    if (state.solved || state.gaveUp) return;
    const ac = state.activeCards.find((a) => a.letter === letter);
    if (!ac) return;
    const candidate = getProposedCode();
    let row = findTestRowForCode(candidate);
    if (row && row.cells[letter] !== undefined) return; // déjà testé pour ce code
    if (countTestedCells(row) >= MAX_TESTS_PER_CODE) return; // 3 cartes max par code
    if (!row) {
      row = { code: { ...candidate }, cells: {} };
      state.rows.push(row);
    }
    const result = ac.variant.test(candidate);
    row.cells[letter] = result;
    dismissTransientBanner();
    renderHistory();
    renderStatus();
    updateCardButtonsState();
    flashResult(ac, candidate, result);
    saveState();
  }

  // Grise/dégrise les boutons "Tester" en fonction du code actuellement
  // proposé : une carte déjà testée pour ce code précis, ou la limite de 3
  // cartes par code déjà atteinte, désactive le(s) bouton(s) concerné(s)
  // jusqu'à ce qu'un nouveau code soit sélectionné.
  function updateCardButtonsState() {
    const candidate = getProposedCode();
    const row = findTestRowForCode(candidate);
    const maxed = countTestedCells(row) >= MAX_TESTS_PER_CODE;
    elAll(".card__test-btn").forEach((btn) => {
      const letter = btn.dataset.letter;
      const alreadyTested = !!(row && row.cells[letter] !== undefined);
      const disabled = state.solved || state.gaveUp || alreadyTested || maxed;
      btn.disabled = disabled;
      btn.classList.toggle("card__test-btn--disabled", disabled);
    });
  }

  function flashResult(ac, candidate, result) {
    const content = el("#test-result-content");
    content.innerHTML = `
      <div class="test-result__verdict ${result ? "test-result__verdict--ok" : "test-result__verdict--ko"}">
        ${result ? "✅ VRAI" : "❌ FAUX"}
      </div>
      <div class="test-result__meta">Carte ${ac.letter} — code testé :</div>
      ${codeDisplayHTML(candidate)}
      <div class="card__img-wrap test-result__card-img-wrap">
        <img class="card__img" src="assets/cards/${ac.family.image}.webp" alt="Carte ${ac.letter}" />
      </div>
    `;
    el("#modal-test-result").classList.remove("hidden");
  }

  function renderHistory() {
    const wrap = el("#history-list");
    wrap.innerHTML = "";
    if (state.rows.length === 0) {
      wrap.innerHTML = `<p class="muted">Aucun test effectué pour l'instant. Choisis un code avec les sélecteurs, puis clique sur "Tester" sous une carte (jusqu'à 3 cartes par code), ou soumets directement ta réponse.</p>`;
      return;
    }
    const letters = state.activeCards.map((ac) => ac.letter);
    const table = document.createElement("table");
    table.className = "history-table";
    const letterHeaders = letters.map((l) => `<th>${l}</th>`).join("");
    table.innerHTML = `
      <thead>
        <tr>
          <th>#</th>
          <th><span class="th-shape"><span class="shape shape--b"></span></span></th>
          <th><span class="th-shape"><span class="shape shape--y"></span></span></th>
          <th><span class="th-shape"><span class="shape shape--p"></span></span></th>
          ${letterHeaders}
          <th title="Soumission de code final">💡</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement("tbody");
    const cellHTML = (v) => `<td>${v === true ? "✅" : v === false ? "❌" : ""}</td>`;
    state.rows.slice().reverse().forEach((row, idx) => {
      const letterCells = letters.map((l) => cellHTML(row.cells[l])).join("");
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${state.rows.length - idx}</td>
        <td><span class="code-digit code-digit--b code-digit--sm">${row.code.b}</span></td>
        <td><span class="code-digit code-digit--y code-digit--sm">${row.code.y}</span></td>
        <td><span class="code-digit code-digit--p code-digit--sm">${row.code.p}</span></td>
        ${letterCells}
        ${cellHTML(row.cells.bulb)}
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  function renderStatus() {
    el("#stat-tests").textContent = allTestCells().length;
  }

  // ------------------------------------------------------------------------
  // Bloc-notes (grille d'élimination/validation manuelle par couleur)
  // ------------------------------------------------------------------------
  function renderNotes() {
    const wrap = el("#notes-grid");
    if (!wrap) return;
    const headerHTML = `
      <span class="notes-grid__head-cell"><span class="shape shape--b shape--lg"></span></span>
      <span class="notes-grid__head-cell"><span class="shape shape--y shape--lg"></span></span>
      <span class="notes-grid__head-cell"><span class="shape shape--p shape--lg"></span></span>
    `;
    const cellsHTML = NOTE_VALUES.map((v) =>
      ["b", "y", "p"]
        .map((color) => {
          const mark = state.notes[color][v];
          return `<button class="notes-cell notes-cell--${mark}" data-color="${color}" data-value="${v}">${v}</button>`;
        })
        .join("")
    ).join("");
    wrap.innerHTML = headerHTML + cellsHTML;
    elAll(".notes-cell").forEach((btn) => {
      btn.addEventListener("click", () => {
        cycleNote(btn.dataset.color, parseInt(btn.dataset.value, 10));
      });
    });
  }

  function cycleNote(color, value) {
    const current = state.notes[color][value] || "none";
    const next = NOTE_CYCLE[(NOTE_CYCLE.indexOf(current) + 1) % NOTE_CYCLE.length];
    state.notes[color][value] = next;
    renderNotes();
    saveState();
  }

  // ------------------------------------------------------------------------
  // Cycle de partie
  // ------------------------------------------------------------------------
  function startPuzzle(diff, duration, seed) {
    const puzzle = generatePuzzleFromSeed(diff, duration, seed);
    state.difficulty = diff.id;
    state.duration = duration.id;
    state.puzzleCode = seedToPuzzleCode(diff, duration, seed);
    state.secret = puzzle.secret;
    state.activeCards = puzzle.activeCards.map((ac, i) => ({ ...ac, letter: LETTERS[i] }));
    state.rows = [];
    state.solved = false;
    state.gaveUp = false;
    state.startedAt = Date.now();
    state.solveSeconds = null;
    state.notes = freshNotes();
    state.crossedVariants = {};
    updateSolvedViewClass();

    const banner = el("#solved-banner");
    banner.classList.add("hidden");
    delete banner.dataset.transient;
    el("#select-b").value = "1";
    el("#select-y").value = "1";
    el("#select-p").value = "1";

    renderPuzzleCode();
    renderCards();
    renderHistory();
    renderStatus();
    renderNotes();
    saveState();
  }

  function generateRandomPuzzle() {
    const diff = DIFFICULTIES.find((d) => d.id === state.difficulty) || DIFFICULTIES[0];
    const duration = DURATIONS.find((d) => d.id === state.duration) || DURATIONS[0];
    startPuzzle(diff, duration, randomSeed());
  }

  function loadPuzzleFromCode(input) {
    const parsed = parsePuzzleCode(input);
    const errorEl = el("#load-code-error");
    if (parsed.error) {
      errorEl.textContent = parsed.error;
      errorEl.classList.remove("hidden");
      return false;
    }
    errorEl.classList.add("hidden");
    startPuzzle(parsed.diff, parsed.duration, parsed.seed);
    return true;
  }

  // Formate une durée en secondes au format "m:ss" (ex. 125 -> "2:05").
  function formatMMSS(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds || 0));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, "0");
    return `${m}:${ss}`;
  }

  // Nombre de codes distincts testés (une ligne "test" du suivi = un code
  // distinct soumis à au moins une carte).
  function countCodesTested() {
    return state.rows.filter((r) => !("bulb" in r.cells)).length;
  }

  function countSubmit() {
    return state.rows.filter((r) => ("bulb" in r.cells)).length - 1;
  }
  
  // Estimation heuristique (glouton) du nombre minimum de "coups" — au sens
  // demandé : (nombre de codes testés) + (nombre de tests unitaires) —
  // nécessaires pour identifier avec certitude la variante active de
  // chaque carte en jeu, et donc le code secret, sans jamais avoir à
  // deviner. Ce n'est PAS une preuve mathématique du minimum absolu (le
  // problème exact — trouver la stratégie garantie optimale — est un
  // problème combinatoire coûteux, proche d'un solveur Mastermind) : c'est
  // une approximation réaliste calculée en simulant, à chaque étape, le
  // choix du code qui départage le mieux les hypothèses encore possibles
  // parmi les variantes imprimées de chaque carte encore ambiguë (jusqu'à
  // 3 cartes par code, comme dans le jeu).
  function estimateMinMoves(activeCards) {
    const remainingVariants = activeCards.map((ac) => ac.family.variants.slice());
    let codesTested = 0;
    let testsPerformed = 0;
    let safety = 0;

    while (remainingVariants.some((vs) => vs.length > 1) && safety < 60) {
      safety++;
      const ambiguousIdx = remainingVariants
        .map((vs, i) => ({ i, len: vs.length }))
        .filter((e) => e.len > 1)
        .sort((a, b) => b.len - a.len)
        .slice(0, MAX_TESTS_PER_CODE)
        .map((e) => e.i);

      if (ambiguousIdx.length === 0) break;

      // Choisit, parmi les 125 codes possibles, celui qui réduit le plus le
      // nombre total d'hypothèses restantes sur les cartes ambiguës visées.
      let bestCode = null;
      let bestScore = Infinity;
      for (const code of ALL_CODES) {
        let score = 0;
        for (const idx of ambiguousIdx) {
          const ac = activeCards[idx];
          const result = ac.variant.test(code);
          score += remainingVariants[idx].filter((v) => v.test(code) === result).length;
        }
        if (score < bestScore) {
          bestScore = score;
          bestCode = code;
        }
      }
      if (!bestCode) break;

      codesTested += 1;
      ambiguousIdx.forEach((idx) => {
        const ac = activeCards[idx];
        const result = ac.variant.test(bestCode);
        remainingVariants[idx] = remainingVariants[idx].filter((v) => v.test(bestCode) === result);
        testsPerformed += 1;
      });
    }

    return { moves: codesTested + testsPerformed, codes: codesTested, tests: testsPerformed };
  }

  // Construit le message affiché dans la bannière une fois l'énigme
  // résolue : temps écoulé, nombre de codes testés / tests effectués, et
  // une estimation du nombre minimum de coups théoriquement nécessaires.
  function buildSolvedBannerHTML() {
    const est = estimateMinMoves(state.activeCards);
    return (
      `🎉 Bravo ! Le code secret était bien ${codeDisplayHTML(state.secret)}<br><br>` +
      `<div>Résolu en ${formatMMSS(state.solveSeconds)} `+ (countSubmit() ? ` <span class="result-flash--ko">dont <b>${valueAndText('erreur', countSubmit())} !</b></span>` : ``) + `<br/><b>${valueAndText('manche', countCodesTested())}  (` + Math.round(est.codes  / countCodesTested() * 100) +`%), ${valueAndText('test', allTestCells().length)} (` + Math.round(est.tests  / allTestCells().length * 100) +`%)</b></div>` +
      `<br><span class="solved-banner__estimate">Minimum théorique estimé : ${valueAndText('manche', est.codes)}, ${valueAndText('test', est.tests)}.</span>`
    );
  }
  
  function valueAndText(mytext, value){
	  return value + ' ' + mytext + (value > 1 ? 's' : '');
  }

  function submitGuess() {
    if (state.solved || state.gaveUp) return;
    const guess = getProposedCode();
    const success = codeEquals(guess, state.secret);
    // Une soumission crée toujours une nouvelle ligne dans le suivi, marquée
    // dans la colonne "ampoule" (jamais fusionnée avec une ligne de test).
    state.rows.push({ code: { ...guess }, cells: { bulb: success } });
    renderHistory();
    renderStatus();

    const banner = el("#solved-banner");
    if (success) {
      state.solved = true;
      delete banner.dataset.transient;
      state.solveSeconds = Math.round((Date.now() - state.startedAt) / 1000);
      banner.className = "solved-banner solved-banner--win";
      banner.innerHTML = buildSolvedBannerHTML();
      revealAllActiveCards();
    } else {
      // Ce message est transitoire : il disparaît dès qu'un nouveau test est
      // effectué ou que le code proposé est modifié (voir dismissTransientBanner).
      banner.dataset.transient = "true";
      banner.className = "solved-banner solved-banner--lose";
      banner.innerHTML = `❌ Ce n'est pas le bon code. Continue à tester les cartes pour affiner ta déduction.`;
    }
    banner.classList.remove("hidden");
    updateCardButtonsState();
    saveState();
  }

  // Ouvre une popin de confirmation avant de soumettre le code proposé comme
  // réponse finale, pour éviter qu'un simple mis-clic ne grille une tentative.
  function openSubmitConfirm() {
    if (state.solved || state.gaveUp) return;
    const code = getProposedCode();
    el("#confirm-code-display").innerHTML = codeDisplayHTML(code);
    openOverlay("confirmsubmit");
  }

  // Fait disparaître le message d'échec de soumission dès qu'un nouveau test
  // est effectué ou que le code proposé change — mais laisse intact le
  // message de "Voir la solution" (qui n'est pas transitoire).
  function dismissTransientBanner() {
    const banner = el("#solved-banner");
    if (banner.dataset.transient === "true") {
      banner.classList.add("hidden");
      delete banner.dataset.transient;
    }
  }

  function giveUp() {
    if (state.solved) return;
    state.gaveUp = true;
    const banner = el("#solved-banner");
    banner.className = "solved-banner solved-banner--lose";
    banner.innerHTML = `Le code secret était ${codeDisplayHTML(state.secret)}.<br>Nouvelle partie quand tu veux !`;
    banner.classList.remove("hidden");
    revealAllActiveCards();
    updateCardButtonsState();
    saveState();
  }

  async function copyPuzzleCode() {
    const code = state.puzzleCode;
    try {
      await navigator.clipboard.writeText(code);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e2) { /* ignore */ }
      document.body.removeChild(ta);
    }
    const confirmEl = el("#copy-confirm");
    confirmEl.classList.remove("hidden");
    clearTimeout(confirmEl._timer);
    confirmEl._timer = setTimeout(() => confirmEl.classList.add("hidden"), 2000);
  }

  // ------------------------------------------------------------------------
  // Sauvegarde locale de la partie en cours (localStorage) : la partie
  // reprend automatiquement telle quelle après fermeture/réouverture ou
  // rechargement de la page ou de l'application.
  // ------------------------------------------------------------------------
  const STORAGE_KEY = "tm-web-savegame-v1";

  function saveState() {
    try {
      const payload = {
        difficulty: state.difficulty,
        duration: state.duration,
        puzzleCode: state.puzzleCode,
        secret: state.secret,
        activeCards: state.activeCards.map((ac) => ({
          familyId: ac.family.id,
          variantIndex: ac.family.variants.indexOf(ac.variant),
          letter: ac.letter,
        })),
        rows: state.rows,
        solved: state.solved,
        gaveUp: state.gaveUp,
        startedAt: state.startedAt,
        solveSeconds: state.solveSeconds,
        notes: state.notes,
        crossedVariants: state.crossedVariants,
        proposedCode: getProposedCode(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      // Stockage indisponible (navigation privée, quota…) : on continue sans
      // persistance, ce n'est pas bloquant pour jouer.
    }
  }

  // Reconstruit une partie sauvegardée à partir de son JSON, en retrouvant
  // les familles/variantes réelles (fonctions de test incluses) depuis
  // cards.js à partir de leurs identifiants. Retourne false si rien à
  // reprendre ou si la sauvegarde est invalide/corrompue.
  function loadSavedState() {
    let saved;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      saved = JSON.parse(raw);
    } catch (e) {
      return false;
    }
    try {
      const activeCards = (saved.activeCards || []).map((sc) => {
        const family = FAMILIES.find((f) => f.id === sc.familyId);
        const variant = family && family.variants[sc.variantIndex];
        if (!family || !variant) throw new Error("Carte sauvegardée introuvable");
        return { family, variant, letter: sc.letter };
      });
      if (!activeCards.length || !saved.secret) throw new Error("Sauvegarde incomplète");

      state.difficulty = saved.difficulty || state.difficulty;
      state.duration = saved.duration || state.duration;
      state.puzzleCode = saved.puzzleCode || "";
      state.secret = saved.secret;
      state.activeCards = activeCards;
      state.rows = Array.isArray(saved.rows) ? saved.rows : [];
      state.solved = !!saved.solved;
      state.gaveUp = !!saved.gaveUp;
      state.startedAt = saved.startedAt || Date.now();
      // Les sauvegardes antérieures à cette fonctionnalité n'ont pas de
      // temps de résolution figé : on le calcule une seule fois ici (au
      // pire), plutôt que de le laisser courir indéfiniment à chaque reprise.
      state.solveSeconds =
        typeof saved.solveSeconds === "number"
          ? saved.solveSeconds
          : state.solved
          ? Math.round((Date.now() - state.startedAt) / 1000)
          : null;
      state.notes = saved.notes || freshNotes();
      state.crossedVariants = saved.crossedVariants && typeof saved.crossedVariants === "object" ? saved.crossedVariants : {};
      updateSolvedViewClass();

      renderPuzzleCode();
      renderCards();
      renderHistory();
      renderStatus();
      renderNotes();

      if (saved.proposedCode) {
        el("#select-b").value = saved.proposedCode.b;
        el("#select-y").value = saved.proposedCode.y;
        el("#select-p").value = saved.proposedCode.p;
      }

      const banner = el("#solved-banner");
      if (state.solved) {
        banner.className = "solved-banner solved-banner--win";
        banner.innerHTML = buildSolvedBannerHTML();
        banner.classList.remove("hidden");
      } else if (state.gaveUp) {
        banner.className = "solved-banner solved-banner--lose";
        banner.innerHTML = `Le code secret était ${codeDisplayHTML(state.secret)}.<br>Nouvelle partie quand tu veux !`;
        banner.classList.remove("hidden");
      } else {
        banner.classList.add("hidden");
        delete banner.dataset.transient;
      }

      updateCardButtonsState();
      return true;
    } catch (e) {
      return false;
    }
  }

  // ------------------------------------------------------------------------
  // Initialisation
  // ------------------------------------------------------------------------
  function init() {
    renderDifficultyPicker();
    renderDurationPicker();

    el("#modal-test-result").addEventListener("click", () => {
      el("#modal-test-result").classList.add("hidden");
    });

    el("#btn-menu").addEventListener("click", () => openOverlay("menu"));
    el("#menu-new-game").addEventListener("click", () => {
      closeAllOverlays();
      openOverlay("newgame");
    });
    el("#menu-help").addEventListener("click", () => {
      closeAllOverlays();
      openOverlay("help");
    });
    // Le bloc-notes s'ouvre directement via son propre bouton (volet latéral),
    // sans passer par le menu principal.
    el("#btn-open-notes").addEventListener("click", () => openOverlay("notes"));
    el("#overlay-backdrop").addEventListener("click", closeAllOverlays);
    elAll("[data-close]").forEach((btn) => btn.addEventListener("click", closeAllOverlays));

    el("#btn-generate-random").addEventListener("click", () => {
      generateRandomPuzzle();
      closeAllOverlays();
    });
    el("#btn-load-code").addEventListener("click", () => {
      if (loadPuzzleFromCode(el("#input-load-code").value)) {
        closeAllOverlays();
        el("#input-load-code").value = "";
      }
    });
    el("#input-load-code").addEventListener("keydown", (e) => {
      if (e.key === "Enter") el("#btn-load-code").click();
    });

    el("#puzzle-code").addEventListener("click", copyPuzzleCode);
    el("#btn-submit-guess").addEventListener("click", openSubmitConfirm);
    el("#btn-cancel-submit").addEventListener("click", closeAllOverlays);
    el("#btn-confirm-submit").addEventListener("click", () => {
      closeAllOverlays();
      submitGuess();
    });
    ["#select-b", "#select-y", "#select-p"].forEach((sel) => {
      el(sel).addEventListener("change", () => {
        dismissTransientBanner();
        updateCardButtonsState();
        saveState();
      });
    });
    el("#menu-give-up").addEventListener("click", () => {
      giveUp();
      closeAllOverlays();
    });

    // Reprend la partie en cours (si elle existe) au lieu d'en générer une
    // nouvelle à chaque ouverture/rechargement de la page ou de l'appli.
    if (!loadSavedState()) {
      generateRandomPuzzle();
    }

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch(() => {});
      });
    }

    // Écran de démarrage (logo en fondu), affiché 3 secondes puis masqué.
    const splash = document.getElementById("splash-screen");
    if (splash) {
      setTimeout(() => {
        splash.classList.add("splash-screen--hide");
        setTimeout(() => splash.remove(), 650);
      }, 3000);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
