// ============================================================================
// Turing Machine — Web Edition
// Définition des 48 cartes de vérification officielles (familles 01 à 48),
// transcrites depuis les visuels réels du jeu (un fichier image par carte
// dans assets/cards/). Chaque carte physique propose 2 à 9 "variantes"
// (les alternatives imprimées en bas de la carte) ; lors de la création
// d'une énigme, UNE seule variante est choisie comme critère actif pour
// cette carte (exactement comme la position du curseur sur la carte
// physique). Tester un code contre une carte revient donc à évaluer cette
// variante précise (vrai/faux).
//
// Un code secret est composé de 3 valeurs (1 à 5) :
//   b = Bleu (triangle)   y = Jaune (carré)   p = Violet (cercle)
// ============================================================================

(function (global) {
  "use strict";

  const COLORS = ["b", "y", "p"];
  const COLOR_LABELS = { b: "Bleu", y: "Jaune", p: "Violet" };
  const COLOR_LABELS_LOWER = { b: "bleu", y: "jaune", p: "violet" };
  const OTHER_COLORS = { b: ["y", "p"], y: ["b", "p"], p: ["b", "y"] };
  const PAIRS = [
    ["b", "y"],
    ["b", "p"],
    ["y", "p"],
  ];
  const VALUES = [1, 2, 3, 4, 5];

  function allCodes() {
    const codes = [];
    for (const b of VALUES) for (const y of VALUES) for (const p of VALUES) codes.push({ b, y, p });
    return codes;
  }
  function codeEquals(c1, c2) {
    return c1.b === c2.b && c1.y === c2.y && c1.p === c2.p;
  }
  function codeKey(c) {
    return `${c.b}${c.y}${c.p}`;
  }

  const isEven = (v) => v % 2 === 0;
  const countIf = (arr, pred) => arr.filter(pred).length;
  const countValue = (code, v) => countIf([code.b, code.y, code.p], (x) => x === v);
  const relLabel = (cmp) => (cmp === "<" ? "inférieur à" : cmp === "=" ? "égal à" : "supérieur à");
  const cmpTest = (cmp) => {
    if (cmp === "<") return (a, b) => a < b;
    if (cmp === "=") return (a, b) => a === b;
    return (a, b) => a > b;
  };
  const countWord = (n) => ["zéro", "un", "deux", "trois"][n];

  // ---------------------------------------------------------------------
  // Générateurs de variantes réutilisables
  // ---------------------------------------------------------------------

  // Une seule couleur fixée, comparée à un seuil N, pour une liste de comparateurs
  function singleColorVsThreshold(color, threshold, comparators) {
    return comparators.map((cmp) => ({
      key: `${color}${cmp}${threshold}`,
      label: `${COLOR_LABELS[color]} est ${relLabel(cmp)} ${threshold}`,
      test: (c) => cmpTest(cmp)(c[color], threshold),
    }));
  }

  // Choix de la couleur (3 variantes), comparée à un seuil N fixe, pour une liste de comparateurs
  function colorChoiceVsThreshold(threshold, comparators) {
    const out = [];
    for (const color of COLORS) {
      for (const cmp of comparators) {
        out.push({
          key: `${color}${cmp}${threshold}`,
          label: `${COLOR_LABELS[color]} est ${relLabel(cmp)} ${threshold}`,
          test: (c) => cmpTest(cmp)(c[color], threshold),
        });
      }
    }
    return out;
  }

  // Comparaison entre deux couleurs fixées
  function pairComparators(colorA, colorB, comparators) {
    return comparators.map((cmp) => ({
      key: `${colorA}${cmp}${colorB}`,
      label: `${COLOR_LABELS[colorA]} est ${relLabel(cmp)} ${COLOR_LABELS_LOWER[colorB]}`,
      test: (c) => cmpTest(cmp)(c[colorA], c[colorB]),
    }));
  }

  // Une couleur fixée comparée à CHACUNE des deux autres couleurs (choix + comparateur)
  function fixedColorVsOthers(fixedColor, comparators) {
    const out = [];
    for (const other of OTHER_COLORS[fixedColor]) {
      for (const cmp of comparators) {
        out.push({
          key: `${fixedColor}${cmp}${other}`,
          label: `${COLOR_LABELS[fixedColor]} est ${relLabel(cmp)} ${COLOR_LABELS_LOWER[other]}`,
          test: (c) => cmpTest(cmp)(c[fixedColor], c[other]),
        });
      }
    }
    return out;
  }

  // Toutes les paires de couleurs, tous comparateurs (carte universelle)
  function allPairsVsComparators(comparators) {
    const out = [];
    for (const [a, b] of PAIRS) {
      for (const cmp of comparators) {
        out.push({
          key: `${a}${cmp}${b}`,
          label: `${COLOR_LABELS[a]} est ${relLabel(cmp)} ${COLOR_LABELS_LOWER[b]}`,
          test: (c) => cmpTest(cmp)(c[a], c[b]),
        });
      }
    }
    return out;
  }

  function parityVariants(color) {
    return [
      { key: `${color}-even`, label: `${COLOR_LABELS[color]} est pair`, test: (c) => isEven(c[color]) },
      { key: `${color}-odd`, label: `${COLOR_LABELS[color]} est impair`, test: (c) => !isEven(c[color]) },
    ];
  }

  function colorChoiceParity() {
    const out = [];
    for (const color of COLORS) out.push(...parityVariants(color));
    return out;
  }

  // Nombre d'occurrences d'une valeur précise dans le code (0 à 3)
  function countValueVariants(value) {
    return [0, 1, 2, 3].map((n) => ({
      key: `count${value}-${n}`,
      label: `Il y a exactement ${countWord(n)} valeur${n >= 2 ? "s" : ""} égale${n >= 2 ? "s" : ""} à ${value} dans le code`,
      test: (c) => countValue(c, value) === n,
    }));
  }

  // Nombre de valeurs paires dans le code (0 à 3)
  function countEvenVariants() {
    return [0, 1, 2, 3].map((n) => ({
      key: `countEven-${n}`,
      label: `Il y a exactement ${countWord(n)} valeur${n >= 2 ? "s" : ""} paire${n >= 2 ? "s" : ""} dans le code`,
      test: (c) => countIf([c.b, c.y, c.p], isEven) === n,
    }));
  }

  // Couleur strictement minimale / strictement maximale
  function extremeStrict(kind) {
    return COLORS.map((color) => {
      const [o1, o2] = OTHER_COLORS[color];
      const test =
        kind === "min"
          ? (c) => c[color] < c[o1] && c[color] < c[o2]
          : (c) => c[color] > c[o1] && c[color] > c[o2];
      return {
        key: `${color}-strict-${kind}`,
        label: `${COLOR_LABELS[color]} est strictement le plus ${kind === "min" ? "petit" : "grand"}`,
        test,
      };
    });
  }

  // Couleur minimale / maximale au sens large (égalité admise)
  function extremeNonStrict(kind) {
    return COLORS.map((color) => {
      const [o1, o2] = OTHER_COLORS[color];
      const test =
        kind === "min"
          ? (c) => c[color] <= c[o1] && c[color] <= c[o2]
          : (c) => c[color] >= c[o1] && c[color] >= c[o2];
      return {
        key: `${color}-nonstrict-${kind}`,
        label: `${COLOR_LABELS[color]} est le plus ${kind === "min" ? "petit" : "grand"} (ou à égalité)`,
        test,
      };
    });
  }

  // Somme de deux couleurs précises = cible
  function pairSumEquals(target) {
    return PAIRS.map(([a, b]) => ({
      key: `${a}+${b}=${target}`,
      label: `La somme de ${COLOR_LABELS_LOWER[a]} et ${COLOR_LABELS_LOWER[b]} est égale à ${target}`,
      test: (c) => c[a] + c[b] === target,
    }));
  }

  // ---------------------------------------------------------------------
  // Les 48 familles de cartes
  // ---------------------------------------------------------------------
  const FAMILIES = [
    { id: "01", image: "TM_GameCards_FR-01", summary: "La valeur Bleu comparée à 1", variants: singleColorVsThreshold("b", 1, ["=", ">"]) },
    { id: "02", image: "TM_GameCards_FR-02", summary: "La valeur Bleu comparée à 3", variants: singleColorVsThreshold("b", 3, ["<", "=", ">"]) },
    { id: "03", image: "TM_GameCards_FR-03", summary: "La valeur Jaune comparée à 3", variants: singleColorVsThreshold("y", 3, ["<", "=", ">"]) },
    { id: "04", image: "TM_GameCards_FR-04", summary: "La valeur Jaune comparée à 4", variants: singleColorVsThreshold("y", 4, ["<", "=", ">"]) },
    { id: "05", image: "TM_GameCards_FR-05", summary: "La valeur Bleu est paire ou impaire", variants: parityVariants("b") },
    { id: "06", image: "TM_GameCards_FR-06", summary: "La valeur Jaune est paire ou impaire", variants: parityVariants("y") },
    { id: "07", image: "TM_GameCards_FR-07", summary: "La valeur Violet est paire ou impaire", variants: parityVariants("p") },
    { id: "08", image: "TM_GameCards_FR-08", summary: "Le nombre de 1 dans le code", variants: countValueVariants(1) },
    { id: "09", image: "TM_GameCards_FR-09", summary: "Le nombre de 3 dans le code", variants: countValueVariants(3) },
    { id: "10", image: "TM_GameCards_FR-10", summary: "Le nombre de 4 dans le code", variants: countValueVariants(4) },
    { id: "11", image: "TM_GameCards_FR-11", summary: "Bleu comparé à Jaune", variants: pairComparators("b", "y", ["<", "=", ">"]) },
    { id: "12", image: "TM_GameCards_FR-12", summary: "Bleu comparé à Violet", variants: pairComparators("b", "p", ["<", "=", ">"]) },
    { id: "13", image: "TM_GameCards_FR-13", summary: "Jaune comparé à Violet", variants: pairComparators("y", "p", ["<", "=", ">"]) },
    { id: "14", image: "TM_GameCards_FR-14", summary: "Quelle couleur a une valeur strictement plus petite que les autres", variants: extremeStrict("min") },
    { id: "15", image: "TM_GameCards_FR-15", summary: "Quelle couleur a une valeur strictement plus grande que les autres", variants: extremeStrict("max") },
    {
      id: "16",
      image: "TM_GameCards_FR-16",
      summary: "Le nombre de valeurs paires comparé au nombre de valeurs impaires",
      variants: [
        { key: "more-even", label: "Il y a plus de valeurs paires que de valeurs impaires", test: (c) => countIf([c.b, c.y, c.p], isEven) > countIf([c.b, c.y, c.p], (v) => !isEven(v)) },
        { key: "more-odd", label: "Il y a plus de valeurs impaires que de valeurs paires", test: (c) => countIf([c.b, c.y, c.p], (v) => !isEven(v)) > countIf([c.b, c.y, c.p], isEven) },
      ],
    },
    { id: "17", image: "TM_GameCards_FR-17", summary: "Combien il y a de valeurs paires dans le code", variants: countEvenVariants() },
    {
      id: "18",
      image: "TM_GameCards_FR-18",
      summary: "La somme de toutes les valeurs est paire ou impaire",
      variants: [
        { key: "sum-even", label: "La somme des 3 valeurs est paire", test: (c) => isEven(c.b + c.y + c.p) },
        { key: "sum-odd", label: "La somme des 3 valeurs est impaire", test: (c) => !isEven(c.b + c.y + c.p) },
      ],
    },
    {
      id: "19",
      image: "TM_GameCards_FR-19",
      summary: "La somme de Bleu et Jaune comparée à 6",
      variants: ["<", "=", ">"].map((cmp) => ({
        key: `by${cmp}6`,
        label: `La somme de bleu et jaune est ${relLabel(cmp)} 6`,
        test: (c) => cmpTest(cmp)(c.b + c.y, 6),
      })),
    },
    {
      id: "20",
      image: "TM_GameCards_FR-20",
      summary: "Si une valeur se répète dans le code",
      variants: [
        { key: "triple", label: "Une valeur est présente en triple (les 3 valeurs sont identiques)", test: (c) => c.b === c.y && c.y === c.p },
        { key: "double", label: "Une valeur est présente en double (exactement 2 valeurs identiques)", test: (c) => {
            const same = c.b === c.y && c.y === c.p;
            const pair = c.b === c.y || c.y === c.p || c.b === c.p;
            return pair && !same;
          } },
        { key: "none", label: "Aucune répétition (les 3 valeurs sont différentes)", test: (c) => c.b !== c.y && c.y !== c.p && c.b !== c.p },
      ],
    },
    {
      id: "21",
      image: "TM_GameCards_FR-21",
      summary: "S'il y a une valeur présente exactement 2 fois (jumeaux)",
      variants: [
        { key: "twins", label: "Il y a des jumeaux (exactement 2 valeurs identiques)", test: (c) => {
            const same3 = c.b === c.y && c.y === c.p;
            const pair = c.b === c.y || c.y === c.p || c.b === c.p;
            return pair && !same3;
          } },
        { key: "no-twins", label: "Pas de jumeaux (0 ou 3 valeurs identiques)", test: (c) => {
            const same3 = c.b === c.y && c.y === c.p;
            const pair = c.b === c.y || c.y === c.p || c.b === c.p;
            return same3 || !pair;
          } },
      ],
    },
    {
      id: "22",
      image: "TM_GameCards_FR-22",
      summary: "Si les 3 valeurs (Bleu, Jaune, Violet dans cet ordre) sont en séquence croissante, décroissante, ou aucun des deux",
      variants: [
        { key: "asc", label: "Bleu < Jaune < Violet (séquence croissante)", test: (c) => c.b < c.y && c.y < c.p },
        { key: "desc", label: "Bleu > Jaune > Violet (séquence décroissante)", test: (c) => c.b > c.y && c.y > c.p },
        { key: "none", label: "Ni croissante ni décroissante", test: (c) => !(c.b < c.y && c.y < c.p) && !(c.b > c.y && c.y > c.p) },
      ],
    },
    {
      id: "23",
      image: "TM_GameCards_FR-23",
      summary: "La somme de toutes les valeurs comparée à 6",
      variants: ["<", "=", ">"].map((cmp) => ({
        key: `sum${cmp}6`,
        label: `La somme des 3 valeurs est ${relLabel(cmp)} 6`,
        test: (c) => cmpTest(cmp)(c.b + c.y + c.p, 6),
      })),
    },
    {
      id: "24",
      image: "TM_GameCards_FR-24",
      summary: "S'il y a une séquence de valeurs consécutives croissantes (Bleu→Jaune→Violet)",
      variants: (() => {
        const run3 = (c) => c.y === c.b + 1 && c.p === c.y + 1;
        const run2 = (c) => !run3(c) && (c.y === c.b + 1 || c.p === c.y + 1);
        return [
          { key: "run3", label: "3 valeurs consécutives croissantes (ex. 2-3-4)", test: run3 },
          { key: "run2", label: "2 valeurs consécutives croissantes", test: run2 },
          { key: "run0", label: "Pas de valeurs consécutives croissantes", test: (c) => !run3(c) && !run2(c) },
        ];
      })(),
    },
    {
      id: "25",
      image: "TM_GameCards_FR-25",
      summary: "S'il y a une séquence de valeurs consécutives (croissantes ou décroissantes)",
      variants: (() => {
        const run3 = (c) => (c.y === c.b + 1 && c.p === c.y + 1) || (c.y === c.b - 1 && c.p === c.y - 1);
        const run2 = (c) => !run3(c) && (Math.abs(c.y - c.b) === 1 || Math.abs(c.p - c.y) === 1);
        return [
          { key: "run3", label: "3 valeurs consécutives (croissantes ou décroissantes)", test: run3 },
          { key: "run2", label: "2 valeurs consécutives (croissantes ou décroissantes)", test: run2 },
          { key: "run0", label: "Pas de valeurs consécutives", test: (c) => !run3(c) && !run2(c) },
        ];
      })(),
    },
    { id: "26", image: "TM_GameCards_FR-26", summary: "Qu'une couleur spécifique est inférieure à 3", variants: colorChoiceVsThreshold(3, ["<"]) },
    { id: "27", image: "TM_GameCards_FR-27", summary: "Qu'une couleur spécifique est inférieure à 4", variants: colorChoiceVsThreshold(4, ["<"]) },
    { id: "28", image: "TM_GameCards_FR-28", summary: "Qu'une couleur spécifique est égale à 1", variants: colorChoiceVsThreshold(1, ["="]) },
    { id: "29", image: "TM_GameCards_FR-29", summary: "Qu'une couleur spécifique est égale à 3", variants: colorChoiceVsThreshold(3, ["="]) },
    { id: "30", image: "TM_GameCards_FR-30", summary: "Qu'une couleur spécifique est égale à 4", variants: colorChoiceVsThreshold(4, ["="]) },
    { id: "31", image: "TM_GameCards_FR-31", summary: "Qu'une couleur spécifique est supérieure à 1", variants: colorChoiceVsThreshold(1, [">"]) },
    { id: "32", image: "TM_GameCards_FR-32", summary: "Qu'une couleur spécifique est supérieure à 3", variants: colorChoiceVsThreshold(3, [">"]) },
    { id: "33", image: "TM_GameCards_FR-33", summary: "Qu'une couleur spécifique est paire ou impaire", variants: colorChoiceParity() },
    { id: "34", image: "TM_GameCards_FR-34", summary: "Quelle couleur a la plus petite valeur (ou plus petite à égalité)", variants: extremeNonStrict("min") },
    { id: "35", image: "TM_GameCards_FR-35", summary: "Quelle couleur a la plus grande valeur (ou plus grande à égalité)", variants: extremeNonStrict("max") },
    {
      id: "36",
      image: "TM_GameCards_FR-36",
      summary: "La somme de toutes les valeurs est un multiple de 3, 4 ou 5",
      variants: [3, 4, 5].map((n) => ({
        key: `mult${n}`,
        label: `La somme des 3 valeurs est un multiple de ${n}`,
        test: (c) => (c.b + c.y + c.p) % n === 0,
      })),
    },
    { id: "37", image: "TM_GameCards_FR-37", summary: "La somme de 2 couleurs spécifiques est égale à 4", variants: pairSumEquals(4) },
    { id: "38", image: "TM_GameCards_FR-38", summary: "La somme de 2 couleurs spécifiques est égale à 6", variants: pairSumEquals(6) },
    { id: "39", image: "TM_GameCards_FR-39", summary: "La valeur d'une couleur spécifique comparée à 1", variants: colorChoiceVsThreshold(1, ["=", ">"]) },
    { id: "40", image: "TM_GameCards_FR-40", summary: "La valeur d'une couleur spécifique comparée à 3", variants: colorChoiceVsThreshold(3, ["<", "=", ">"]) },
    { id: "41", image: "TM_GameCards_FR-41", summary: "La valeur d'une couleur spécifique comparée à 4", variants: colorChoiceVsThreshold(4, ["<", "=", ">"]) },
    {
      id: "42",
      image: "TM_GameCards_FR-42",
      summary: "Quelle couleur est strictement la plus petite ou strictement la plus grande",
      variants: [...extremeStrict("min"), ...extremeStrict("max")],
    },
    { id: "43", image: "TM_GameCards_FR-43", summary: "La valeur Bleu comparée à la valeur d'une autre couleur spécifique", variants: fixedColorVsOthers("b", ["<", "=", ">"]) },
    { id: "44", image: "TM_GameCards_FR-44", summary: "La valeur Jaune comparée à la valeur d'une autre couleur spécifique", variants: fixedColorVsOthers("y", ["<", "=", ">"]) },
    { id: "45", image: "TM_GameCards_FR-45", summary: "Combien il y a de 1 OU combien il y a de 3 dans le code", variants: [...countValueVariants(1), ...countValueVariants(3)] },
    { id: "46", image: "TM_GameCards_FR-46", summary: "Combien il y a de 3 OU combien il y a de 4 dans le code", variants: [...countValueVariants(3), ...countValueVariants(4)] },
    { id: "47", image: "TM_GameCards_FR-47", summary: "Combien il y a de 1 OU combien il y a de 4 dans le code", variants: [...countValueVariants(1), ...countValueVariants(4)] },
    { id: "48", image: "TM_GameCards_FR-48", summary: "Une couleur spécifique comparée à une autre couleur spécifique", variants: allPairsVsComparators(["<", "=", ">"]) },
  ];

  global.TuringCards = {
    FAMILIES,
    COLORS,
    COLOR_LABELS,
    VALUES,
    allCodes,
    codeEquals,
    codeKey,
  };
})(window);
