/**
 * STARK ML LAB · MK-CART Engine
 * Implementación matemática real de Árboles de Decisión (CART: Gini & Entropía),
 * evaluación de cortes candidatos para el escáner 3D, trazado de inferencia y Random Forest.
 */

function makeSeededRng(seed = 2026) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function normalizeValue(val, min, max) {
  if (max === min) return 0;
  return ((val - min) / (max - min)) * 2 - 1;
}

export function denormalizeValue(norm, min, max) {
  return min + ((norm + 1) / 2) * (max - min);
}

function buildDatasetSamples(rawRows, features, isNoiseFlags = []) {
  return rawRows.map((row, idx) => {
    const values = [row[0], row[1], row[2]];
    const norm = values.map((v, fi) => normalizeValue(v, features[fi].min, features[fi].max));
    return {
      id: idx + 1,
      values,
      norm,
      label: row[3],
      isNoise: Boolean(isNoiseFlags[idx])
    };
  });
}

// ============================================================================
// 3 DATASETS CURADOS EN 3D (CON DIVISIONES REALES TRAIN/TEST + RUIDO OPCIONAL)
// ============================================================================

function createExoplanetDataset() {
  const features = [
    { key: "temp", label: "Temperatura", short: "Temp", unit: "°C", min: -30, max: 70 },
    { key: "o2", label: "Oxígeno", short: "O₂", unit: "%", min: 0, max: 36 },
    { key: "grav", label: "Gravedad", short: "Grav", unit: "G", min: 0.3, max: 2.2 }
  ];
  const classes = [
    { id: 0, name: "Habitable", colorHex: 0x00f0ff, cssColor: "#00f0ff", bgRgba: "rgba(0, 240, 255, 0.18)" },
    { id: 1, name: "Hostil", colorHex: 0xfb7185, cssColor: "#fb7185", bgRgba: "rgba(251, 113, 133, 0.18)" }
  ];

  // Regla subyacente clara: Temp [4..34] °C, Oxígeno [15..32] %, Gravedad [0.55..1.55] G => Habitable (0)
  const rng = makeSeededRng(4201);
  const trainRows = [];
  const trainNoise = [];
  const testRows = [];

  const sampleBalanced = (targetRows, count, allowNoiseFlags = null) => {
    for (let i = 0; i < count; i++) {
      const wantHabitable = i % 2 === 0;
      let t, o, g, label;
      if (wantHabitable) {
        t = +(7 + rng() * 24).toFixed(1);       // 7 .. 31 °C
        o = +(17 + rng() * 13).toFixed(1);      // 17 .. 30 %
        g = +(0.65 + rng() * 0.78).toFixed(2);  // 0.65 .. 1.43 G
        label = 0;
      } else {
        const mode = Math.floor(i / 2) % 4;
        if (mode === 0) {
          // Demasiado caliente
          t = +(39 + rng() * 27).toFixed(1);
          o = +(10 + rng() * 22).toFixed(1);
          g = +(0.6 + rng() * 1.1).toFixed(2);
        } else if (mode === 1) {
          // Congelado
          t = +(-27 + rng() * 26).toFixed(1);
          o = +(8 + rng() * 22).toFixed(1);
          g = +(0.6 + rng() * 1.0).toFixed(2);
        } else if (mode === 2) {
          // Sin oxígeno (asfixiante)
          t = +(8 + rng() * 24).toFixed(1);
          o = +(1.5 + rng() * 11).toFixed(1);
          g = +(0.6 + rng() * 1.0).toFixed(2);
        } else {
          // Gravedad aplastante
          t = +(10 + rng() * 22).toFixed(1);
          o = +(17 + rng() * 11).toFixed(1);
          g = +(1.65 + rng() * 0.5).toFixed(2);
        }
        label = 1;
      }
      targetRows.push([t, o, g, label]);
      if (allowNoiseFlags) allowNoiseFlags.push(false);
    }
  };

  sampleBalanced(trainRows, 42, trainNoise);
  sampleBalanced(testRows, 20, null);
  // Test extra en zonas saludables donde las anomalías ruidosas inducen Overfitting si max_depth >= 5
  testRows.push([20.2, 23.4, 1.0, 0], [21.6, 25.1, 1.04, 0], [15.4, 21.2, 0.93, 0], [51.0, 7.0, 1.8, 1]);

  // 6 anomalías ruidosas en el set de entrenamiento (etiquetas invertidas por fallos de sensor)
  // Estas solo se activan cuando el usuario explora Overfitting (Etapa 6) o activa ruido en Sandbox.
  const noiseAnomalies = [
    [19.5, 23.0, 0.98, 1], // Parece totalmente habitable pero etiqueta corrupta -> Hostil
    [22.0, 25.5, 1.05, 1],
    [15.0, 21.0, 0.92, 1],
    [52.0, 6.0, 1.85, 0],  // Infierno tóxico marcado erróneamente como Habitable
    [-18.0, 5.5, 0.45, 0],
    [24.0, 7.5, 1.12, 0]
  ];
  const noiseStartIdx = trainRows.length;
  noiseAnomalies.forEach((r) => {
    trainRows.push(r);
    trainNoise.push(true);
  });

  const allTrainClean = buildDatasetSamples(trainRows.slice(0, noiseStartIdx), features, trainNoise.slice(0, noiseStartIdx));
  const allTrainWithNoise = buildDatasetSamples(trainRows, features, trainNoise);
  const testSamples = buildDatasetSamples(testRows, features);

  return {
    id: "exoplanets",
    name: "Misión Exoplanetas",
    shortName: "Exoplanetas",
    subtitle: "Desde 0 · Clasificación Binaria (2 Clases)",
    description: "Sensores orbitales analizan Temperatura, Oxígeno y Gravedad para decidir si un planeta es Habitable o Hostil.",
    features,
    classes,
    trainClean: allTrainClean,
    trainWithNoise: allTrainWithNoise,
    test: testSamples,
    defaultProbe: [21.0, 22.0, 1.0]
  };
}

function createIrisDataset() {
  const features = [
    { key: "pl", label: "Largo Pétalo", short: "L.Pétalo", unit: "cm", min: 1.0, max: 6.9 },
    { key: "pw", label: "Ancho Pétalo", short: "A.Pétalo", unit: "cm", min: 0.1, max: 2.5 },
    { key: "sl", label: "Largo Sépalo", short: "L.Sépalo", unit: "cm", min: 4.3, max: 7.9 }
  ];
  const classes = [
    { id: 0, name: "Setosa", colorHex: 0x00f0ff, cssColor: "#00f0ff", bgRgba: "rgba(0, 240, 255, 0.18)" },
    { id: 1, name: "Versicolor", colorHex: 0xf59e0b, cssColor: "#f59e0b", bgRgba: "rgba(245, 158, 11, 0.18)" },
    { id: 2, name: "Virginica", colorHex: 0xa855f7, cssColor: "#a855f7", bgRgba: "rgba(168, 85, 247, 0.18)" }
  ];

  // Muestras representativas fieles al clásico dataset Iris de Fisher
  const trainRaw = [
    [1.4, 0.2, 5.1, 0], [1.4, 0.2, 4.9, 0], [1.3, 0.2, 4.7, 0], [1.5, 0.2, 4.6, 0], [1.4, 0.3, 5.0, 0],
    [1.7, 0.4, 5.4, 0], [1.4, 0.3, 4.6, 0], [1.5, 0.2, 5.0, 0], [1.4, 0.2, 4.4, 0], [1.5, 0.1, 4.9, 0],
    [1.5, 0.2, 5.4, 0], [1.6, 0.2, 4.8, 0], [1.3, 0.4, 5.4, 0], [1.5, 0.4, 5.7, 0], [1.2, 0.2, 5.8, 0],
    [4.7, 1.4, 7.0, 1], [4.5, 1.5, 6.4, 1], [4.9, 1.5, 6.9, 1], [4.0, 1.3, 5.5, 1], [4.6, 1.5, 6.5, 1],
    [4.5, 1.3, 5.7, 1], [4.7, 1.6, 6.3, 1], [3.3, 1.0, 4.9, 1], [4.6, 1.3, 6.6, 1], [3.9, 1.4, 5.2, 1],
    [3.5, 1.0, 5.0, 1], [4.2, 1.5, 5.9, 1], [4.0, 1.0, 6.0, 1], [4.7, 1.4, 6.1, 1], [3.6, 1.3, 5.6, 1],
    [6.0, 2.5, 6.3, 2], [5.1, 1.9, 5.8, 2], [5.9, 2.1, 7.1, 2], [5.6, 1.8, 6.3, 2], [5.8, 2.2, 6.5, 2],
    [6.6, 2.1, 7.6, 2], [4.5, 1.7, 4.9, 2], [6.3, 1.8, 7.3, 2], [5.8, 1.8, 6.7, 2], [6.1, 2.5, 7.2, 2],
    [5.1, 2.0, 6.5, 2], [5.3, 1.9, 6.4, 2], [5.5, 2.1, 6.8, 2], [5.0, 2.0, 5.7, 2], [5.1, 2.4, 5.8, 2]
  ];
  const testRaw = [
    [1.6, 0.2, 5.0, 0], [1.9, 0.4, 5.1, 0], [1.4, 0.2, 5.2, 0], [1.6, 0.6, 5.0, 0], [1.5, 0.3, 5.1, 0], [1.3, 0.2, 4.4, 0],
    [4.4, 1.4, 6.7, 1], [4.1, 1.3, 5.6, 1], [4.5, 1.5, 6.0, 1], [4.8, 1.8, 5.9, 1], [4.4, 1.2, 5.5, 1], [4.3, 1.3, 6.2, 1],
    [5.4, 2.1, 6.9, 2], [5.6, 2.4, 6.7, 2], [6.1, 1.9, 7.4, 2], [5.7, 2.3, 6.9, 2], [5.2, 2.3, 6.7, 2], [5.0, 1.9, 6.3, 2]
  ];
  const noiseFlags = new Array(trainRaw.length).fill(false);
  // 3 flores con solapamiento/ruido para ver overfitting si se sube profundidad
  const noisy = [
    [4.9, 1.7, 6.2, 1],
    [5.0, 1.6, 6.0, 2],
    [4.8, 1.4, 6.1, 2]
  ];

  return {
    id: "iris3d",
    name: "Botánica Iris 3D",
    shortName: "Iris (3 Clases)",
    subtitle: "Clásico ML · Clasificación Multiclase (3 Clases)",
    description: "El dataset legendario de Ronald Fisher: distingue 3 especies de flores midiendo pétalos y sépalos en 3D.",
    features,
    classes,
    trainClean: buildDatasetSamples(trainRaw, features, noiseFlags),
    trainWithNoise: buildDatasetSamples([...trainRaw, ...noisy], features, [...noiseFlags, true, true, true]),
    test: buildDatasetSamples(testRaw, features),
    defaultProbe: [4.6, 1.5, 6.1]
  };
}

function createCardioDataset() {
  const features = [
    { key: "bpm", label: "Ritmo Cardíaco", short: "BPM", unit: "bpm", min: 52, max: 148 },
    { key: "sys", label: "Presión Sistólica", short: "Presión", unit: "mmHg", min: 90, max: 190 },
    { key: "chol", label: "Colesterol", short: "Colest.", unit: "mg/dL", min: 140, max: 310 }
  ];
  const classes = [
    { id: 0, name: "Bajo Riesgo", colorHex: 0x10b981, cssColor: "#10b981", bgRgba: "rgba(16, 185, 129, 0.18)" },
    { id: 1, name: "Riesgo Alto", colorHex: 0xf43f5e, cssColor: "#f43f5e", bgRgba: "rgba(244, 63, 94, 0.18)" }
  ];

  const rng = makeSeededRng(8842);
  const trainRows = [];
  const trainNoise = [];
  const testRows = [];

  const gen = (arr, n, nFlags = null) => {
    for (let i = 0; i < n; i++) {
      const high = i % 2 === 1;
      let bpm, sys, chol;
      if (!high) {
        bpm = Math.round(58 + rng() * 30);
        sys = Math.round(98 + rng() * 28);
        chol = Math.round(148 + rng() * 52);
      } else {
        const type = i % 3;
        if (type === 0) {
          bpm = Math.round(102 + rng() * 40);
          sys = Math.round(140 + rng() * 44);
          chol = Math.round(215 + rng() * 82);
        } else if (type === 1) {
          bpm = Math.round(75 + rng() * 35);
          sys = Math.round(148 + rng() * 38);
          chol = Math.round(180 + rng() * 75);
        } else {
          bpm = Math.round(112 + rng() * 32);
          sys = Math.round(115 + rng() * 32);
          chol = Math.round(235 + rng() * 68);
        }
      }
      arr.push([bpm, sys, chol, high ? 1 : 0]);
      if (nFlags) nFlags.push(false);
    }
  };

  gen(trainRows, 44, trainNoise);
  gen(testRows, 18, null);

  const noisy = [
    [68, 112, 168, 1],
    [72, 116, 175, 1],
    [134, 172, 285, 0],
    [128, 164, 260, 0]
  ];

  return {
    id: "cardio",
    name: "Triaje Biomédico",
    shortName: "Triaje Médico",
    subtitle: "Aplicación Real · Detección de Riesgo",
    description: "Predicción clínica de riesgo cardiovascular a partir de frecuencia cardíaca, presión arterial y colesterol.",
    features,
    classes,
    trainClean: buildDatasetSamples(trainRows, features, trainNoise),
    trainWithNoise: buildDatasetSamples([...trainRows, ...noisy], features, [...trainNoise, true, true, true, true]),
    test: buildDatasetSamples(testRows, features),
    defaultProbe: [88, 128, 205]
  };
}

export const DATASETS = {
  exoplanets: createExoplanetDataset(),
  iris3d: createIrisDataset(),
  cardio: createCardioDataset()
};

// ============================================================================
// MATEMÁTICA CART: IMPUREZA GINI, ENTROPÍA Y BÚSQUEDA DE CORTES
// ============================================================================

export function countClasses(samples, numClasses) {
  const counts = new Array(numClasses).fill(0);
  for (let i = 0; i < samples.length; i++) {
    counts[samples[i].label]++;
  }
  return counts;
}

export function computeGini(counts, total) {
  if (!total) return 0;
  let sumSq = 0;
  for (let i = 0; i < counts.length; i++) {
    const p = counts[i] / total;
    sumSq += p * p;
  }
  return Math.max(0, 1 - sumSq);
}

export function computeEntropy(counts, total) {
  if (!total) return 0;
  let ent = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) {
      const p = counts[i] / total;
      ent -= p * Math.log2(p);
    }
  }
  return Math.max(0, ent);
}

export function computeImpurity(counts, total, criterion = "gini") {
  return criterion === "entropy" ? computeEntropy(counts, total) : computeGini(counts, total);
}

/**
 * Evalúa TODOS los umbrales candidatos para una característica en un conjunto de muestras.
 * Se usa tanto para entrenar CART como para animar el Escáner Láser 3D y graficar la curva de ganancia.
 */
export function evaluateFeatureSplits(samples, featureIdx, numClasses, criterion = "gini") {
  const n = samples.length;
  if (n < 2) return { candidates: [], best: null };

  const parentCounts = countClasses(samples, numClasses);
  const parentImpurity = computeImpurity(parentCounts, n, criterion);

  const uniqueVals = Array.from(new Set(samples.map((s) => s.values[featureIdx]))).sort((a, b) => a - b);
  if (uniqueVals.length < 2) return { candidates: [], best: null };

  const candidates = [];
  let best = null;

  for (let i = 0; i < uniqueVals.length - 1; i++) {
    const threshold = +((uniqueVals[i] + uniqueVals[i + 1]) / 2).toFixed(3);
    const leftCounts = new Array(numClasses).fill(0);
    const rightCounts = new Array(numClasses).fill(0);
    let nLeft = 0;
    let nRight = 0;

    for (let j = 0; j < n; j++) {
      const s = samples[j];
      if (s.values[featureIdx] <= threshold) {
        leftCounts[s.label]++;
        nLeft++;
      } else {
        rightCounts[s.label]++;
        nRight++;
      }
    }

    if (nLeft === 0 || nRight === 0) continue;

    const leftImpurity = computeImpurity(leftCounts, nLeft, criterion);
    const rightImpurity = computeImpurity(rightCounts, nRight, criterion);
    const weightedImpurity = (nLeft / n) * leftImpurity + (nRight / n) * rightImpurity;
    const gain = Math.max(0, parentImpurity - weightedImpurity);

    const cand = {
      featureIdx,
      threshold,
      gain,
      parentImpurity,
      weightedImpurity,
      leftImpurity,
      rightImpurity,
      leftCounts,
      rightCounts,
      nLeft,
      nRight
    };
    candidates.push(cand);
    if (!best || cand.gain > best.gain) {
      best = cand;
    }
  }

  return { candidates, best };
}

export function findBestSplit(samples, numClasses, criterion = "gini", allowedFeatures = null) {
  let globalBest = null;
  const featureIndices = allowedFeatures || [0, 1, 2];
  for (const fIdx of featureIndices) {
    const { best } = evaluateFeatureSplits(samples, fIdx, numClasses, criterion);
    if (best && (!globalBest || best.gain > globalBest.gain)) {
      globalBest = best;
    }
  }
  return globalBest;
}

/**
 * Construye el Árbol de Decisión CART completo, guardando cajas delimitadoras 3D exactas
 * para dibujar hiperplanos acotados dentro de cada sub-región del espacio.
 */
export function buildDecisionTree(dataset, samples, options = {}) {
  const {
    criterion = "gini",
    maxDepth = 3,
    minSamplesSplit = 2,
    allowedFeaturesPerNode = null // opcional para Random Forest
  } = options;

  const numClasses = dataset.classes.length;
  const initialBounds = dataset.features.map((f) => ({ min: f.min, max: f.max }));
  const initialNormBounds = [{ min: -1, max: 1 }, { min: -1, max: 1 }, { min: -1, max: 1 }];

  const allNodes = [];

  function recurse(nodeSamples, depth, nodeId, bounds, normBounds) {
    const n = nodeSamples.length;
    const counts = countClasses(nodeSamples, numClasses);
    const gini = computeGini(counts, n);
    const entropy = computeEntropy(counts, n);
    const impurity = criterion === "entropy" ? entropy : gini;

    let majorityClass = 0;
    for (let c = 1; c < numClasses; c++) {
      if (counts[c] > counts[majorityClass]) majorityClass = c;
    }
    const confidence = n > 0 ? counts[majorityClass] / n : 0;

    let nodeFeatures = [0, 1, 2];
    if (allowedFeaturesPerNode) {
      nodeFeatures = allowedFeaturesPerNode();
    }

    const bestSplit =
      depth < maxDepth && n >= minSamplesSplit && impurity > 1e-9
        ? findBestSplit(nodeSamples, numClasses, criterion, nodeFeatures)
        : null;

    const shouldStop = !bestSplit || bestSplit.gain <= 1e-7;

    const node = {
      id: nodeId,
      depth,
      n,
      counts,
      gini,
      entropy,
      impurity,
      criterion,
      majorityClass,
      confidence,
      sampleIds: nodeSamples.map((s) => s.id),
      bounds: bounds.map((b) => ({ ...b })),
      normBounds: normBounds.map((b) => ({ ...b })),
      isLeaf: shouldStop,
      stopReason: shouldStop
        ? impurity <= 1e-9
          ? "pure"
          : depth >= maxDepth
            ? "max_depth"
            : n < minSamplesSplit
              ? "min_samples"
              : "no_gain"
        : null,
      featureIdx: shouldStop ? null : bestSplit.featureIdx,
      threshold: shouldStop ? null : bestSplit.threshold,
      normThreshold: shouldStop
        ? null
        : normalizeValue(
            bestSplit.threshold,
            dataset.features[bestSplit.featureIdx].min,
            dataset.features[bestSplit.featureIdx].max
          ),
      gain: shouldStop ? 0 : bestSplit.gain,
      left: null,
      right: null
    };

    allNodes.push(node);

    if (!shouldStop) {
      const fIdx = bestSplit.featureIdx;
      const thr = bestSplit.threshold;
      const nThr = node.normThreshold;

      const leftSamples = nodeSamples.filter((s) => s.values[fIdx] <= thr);
      const rightSamples = nodeSamples.filter((s) => s.values[fIdx] > thr);

      const leftBounds = bounds.map((b, idx) => (idx === fIdx ? { min: b.min, max: thr } : { ...b }));
      const rightBounds = bounds.map((b, idx) => (idx === fIdx ? { min: thr, max: b.max } : { ...b }));

      const leftNorm = normBounds.map((b, idx) => (idx === fIdx ? { min: b.min, max: nThr } : { ...b }));
      const rightNorm = normBounds.map((b, idx) => (idx === fIdx ? { min: nThr, max: b.max } : { ...b }));

      node.left = recurse(leftSamples, depth + 1, `${nodeId}L`, leftBounds, leftNorm);
      node.right = recurse(rightSamples, depth + 1, `${nodeId}R`, rightBounds, rightNorm);
    }

    return node;
  }

  const root = recurse(samples, 0, "N0", initialBounds, initialNormBounds);
  const leaves = allNodes.filter((n) => n.isLeaf);
  const maxActualDepth = allNodes.reduce((acc, n) => Math.max(acc, n.depth), 0);

  return {
    root,
    nodes: allNodes,
    leaves,
    nodeCount: allNodes.length,
    leafCount: leaves.length,
    maxActualDepth,
    criterion
  };
}

export function predictWithTrace(tree, values) {
  let current = tree.root;
  const trace = [];
  const pathNodeIds = [];

  while (current) {
    pathNodeIds.push(current.id);
    if (current.isLeaf) {
      return {
        prediction: current.majorityClass,
        confidence: current.confidence,
        counts: current.counts,
        leaf: current,
        pathNodeIds,
        trace
      };
    }
    const val = values[current.featureIdx];
    const goLeft = val <= current.threshold;
    trace.push({
      nodeId: current.id,
      featureIdx: current.featureIdx,
      threshold: current.threshold,
      value: val,
      goLeft,
      nextNodeId: goLeft ? current.left.id : current.right.id
    });
    current = goLeft ? current.left : current.right;
  }

  return null;
}

export function evaluateAccuracy(tree, samples) {
  if (!samples || !samples.length) return 0;
  let correct = 0;
  for (let i = 0; i < samples.length; i++) {
    const res = predictWithTrace(tree, samples[i].values);
    if (res && res.prediction === samples[i].label) correct++;
  }
  return (correct / samples.length) * 100;
}

/**
 * Construye un ensamble Random Forest real (5 árboles con Bootstrap + Feature Subsampling)
 * para demostrar en la Etapa 7 cómo un bosque supera a un solo árbol.
 */
export function buildRandomForest(dataset, trainSamples, numTrees = 5, maxDepth = 3, criterion = "gini") {
  const rng = makeSeededRng(7711);
  const trees = [];

  for (let t = 0; t < numTrees; t++) {
    // Bootstrap sample
    const boot = [];
    for (let i = 0; i < trainSamples.length; i++) {
      const idx = Math.floor(rng() * trainSamples.length);
      boot.push(trainSamples[idx]);
    }
    const tree = buildDecisionTree(dataset, boot, {
      criterion,
      maxDepth,
      minSamplesSplit: 2,
      allowedFeaturesPerNode: () => {
        // Submuestreo de 2 de 3 características por división
        const all = [0, 1, 2];
        const drop = Math.floor(rng() * 3);
        return all.filter((f) => f !== drop);
      }
    });
    trees.push(tree);
  }
  return trees;
}

export function predictForest(trees, values, numClasses) {
  const votes = new Array(numClasses).fill(0);
  const perTree = trees.map((tree) => {
    const res = predictWithTrace(tree, values);
    votes[res.prediction]++;
    return res;
  });
  let winner = 0;
  for (let c = 1; c < numClasses; c++) {
    if (votes[c] > votes[winner]) winner = c;
  }
  return { winner, votes, perTree };
}

export function evaluateForestAccuracy(trees, samples, numClasses) {
  if (!samples.length) return 0;
  let correct = 0;
  for (const s of samples) {
    const res = predictForest(trees, s.values, numClasses);
    if (res.winner === s.label) correct++;
  }
  return (correct / samples.length) * 100;
}
