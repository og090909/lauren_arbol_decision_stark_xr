import {
  DATASETS,
  buildDecisionTree,
  buildRandomForest,
  predictWithTrace,
  predictForest,
  evaluateAccuracy,
  evaluateForestAccuracy,
  evaluateFeatureSplits,
  denormalizeValue,
  computeEntropy,
  computeFeatureImportances,
  computeConfusionMatrix
} from "./cart-engine.js";
import { STAGES } from "./curriculum.js";
import { StarkAudioEngine } from "./audio-engine.js";
import { StarkHologramScene } from "./xr-scene.js";

// ============================================================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================================

const state = {
  booted: false,
  stageIdx: 0,
  datasetId: "exoplanets",
  criterion: "gini", // "gini" | "entropy"
  maxDepth: 4,
  minSamplesSplit: 2,
  includeNoise: false,
  showPlanes: true,
  forestMode: false,

  // Stage 2: Simulador Gini
  purityMixRatio: 0.5,

  // Stage 3: Escáner CART
  laserAxis: 1,
  laserManual: false,
  laserManualNorm: 0.0,
  laserScanData: { candidates: [], best: null },

  // Stage 5: Sonda en vivo
  probeValues: [...DATASETS.exoplanets.defaultProbe],
  lastProbeResult: null,
  lastForestResult: null,

  // UI & Layout
  layoutMode: "dual", // "dual" | "cube" | "tree"
  cameraPreset: "general",
  autoRotate: false,
  hudVisible: true,
  leftCollapsed: false,
  rightCollapsed: false,
  audioAutoPlay: true,
  rightCanvasTab: "diag", // "diag" | "code"

  // Modelo entrenado actual
  trainSamples: [],
  testSamples: [],
  tree: null,
  forest: null,
  trainAcc: 0,
  testAcc: 0,
  selectedNodeId: "N0",
  selectedSample: null
};

const audio = new StarkAudioEngine();
let scene3d = null;
let autoProbeTimeout = null;
let lastLaserTickPing = 0;

// ============================================================================
// UTILIDADES DOM Y TOAST
// ============================================================================

const $ = (id) => document.getElementById(id);

let toastTimer = null;
function showToast(msg) {
  const el = $("stark-toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ============================================================================
// MOTOR DE ENTRENAMIENTO Y SINCRONIZACIÓN DE ESCENA 3D
// ============================================================================

function rebuildModelAndScene() {
  const ds = DATASETS[state.datasetId];
  state.trainSamples = state.includeNoise ? ds.trainWithNoise : ds.trainClean;
  state.testSamples = ds.test;

  state.tree = buildDecisionTree(ds, state.trainSamples, {
    criterion: state.criterion,
    maxDepth: state.maxDepth,
    minSamplesSplit: state.minSamplesSplit
  });

  if (state.forestMode) {
    state.forest = buildRandomForest(ds, state.trainSamples, 5, Math.min(4, state.maxDepth), state.criterion);
    state.trainAcc = evaluateForestAccuracy(state.forest, state.trainSamples, ds.classes.length);
    state.testAcc = evaluateForestAccuracy(state.forest, state.testSamples, ds.classes.length);
  } else {
    state.forest = null;
    state.trainAcc = evaluateAccuracy(state.tree, state.trainSamples);
    state.testAcc = evaluateAccuracy(state.tree, state.testSamples);
  }

  if (!state.tree.nodes.some((n) => n.id === state.selectedNodeId)) {
    state.selectedNodeId = "N0";
  }

  state.laserScanData = evaluateFeatureSplits(
    state.trainSamples,
    state.laserAxis,
    ds.classes.length,
    state.criterion
  );

  const stage = STAGES[state.stageIdx];
  const depthLimit =
    state.stageIdx < 8 && stage.sceneConfig.showTreeDepthLimit !== undefined && state.stageIdx !== 6
      ? stage.sceneConfig.showTreeDepthLimit
      : state.maxDepth;

  scene3d.renderModel({
    dataset: ds,
    samples: state.trainSamples,
    tree: state.tree,
    forest: state.forest,
    forestMode: state.forestMode,
    showPlanes: state.showPlanes,
    depthLimit,
    selectedNodeId: state.selectedNodeId
  });

  scene3d.setPurityDemo(state.stageIdx === 2, state.purityMixRatio);

  const laserActive = state.stageIdx === 3;
  scene3d.setLaserSweep(
    laserActive,
    state.laserAxis,
    state.laserScanData.candidates,
    state.laserScanData.best,
    state.laserManual ? state.laserManualNorm : null
  );

  renderMetricsHUD();
  renderInspectorHUD();
  renderCanvasDiagAndCode();
  drawGainChart();
  syncXRSlate();
}

function syncXRSlate() {
  if (!scene3d) return;
  const stage = STAGES[state.stageIdx];
  const node = state.tree?.nodes.find((n) => n.id === state.selectedNodeId) || state.tree?.root;
  const ds = DATASETS[state.datasetId];
  let nodeHint = "Apunta con el láser a un Nodo del Árbol o Esfera del Cubo";
  if (node) {
    if (node.isLeaf) {
      nodeHint = `Nodo ${node.id} (HOJA): ${ds.classes[node.majorityClass].name} · Gini=${node.gini.toFixed(3)} · N=${node.n}`;
    } else {
      const f = ds.features[node.featureIdx];
      nodeHint = `Nodo ${node.id}: ¿${f.short} ≤ ${node.threshold}${f.unit}? · Gini=${node.gini.toFixed(3)} · N=${node.n}`;
    }
  }
  scene3d.updateXRSlate({
    stageNum: stage.id,
    title: stage.title,
    badge: stage.badge,
    accent: stage.accent,
    summary: stage.plainSummary,
    formula: stage.formulaDisplay,
    metricsText: `Train: ${state.trainAcc.toFixed(0)}% | Test: ${state.testAcc.toFixed(0)}% | Depth: ${state.maxDepth}`,
    nodeHint
  });
}

// ============================================================================
// NAVEGACIÓN DE ETAPAS ("DE 0 A MAESTRO")
// ============================================================================

function goToStage(idx, shouldPlayAudio = true) {
  const clamped = Math.max(0, Math.min(STAGES.length - 1, idx));
  state.stageIdx = clamped;
  const stage = STAGES[clamped];

  clearTimeout(autoProbeTimeout);
  scene3d?.stopProbeAnim();

  state.showPlanes = stage.sceneConfig.showPlanes;
  state.forestMode = stage.sceneConfig.forestMode;
  state.includeNoise = stage.sceneConfig.includeNoise;

  if (clamped === 6) {
    state.maxDepth = 6;
  } else if (clamped === 3) {
    state.maxDepth = 1;
    state.laserAxis = 1;
    state.laserManual = false;
  } else if (clamped === 4 || clamped === 5 || clamped === 7 || clamped === 8) {
    state.maxDepth = 4;
  } else if (clamped < 3) {
    state.maxDepth = 4;
  }

  if (clamped < 7 && state.datasetId !== "exoplanets") {
    state.datasetId = "exoplanets";
    state.probeValues = [...DATASETS.exoplanets.defaultProbe];
  }

  state.selectedNodeId = "N0";
  state.selectedSample = null;
  state.lastProbeResult = null;
  state.lastForestResult = null;

  renderStageSelector();
  renderLeftStageContent();
  rebuildModelAndScene();

  if (stage.sceneConfig.cameraPreset) {
    setActiveCameraPreset(stage.sceneConfig.cameraPreset);
  }

  $("caption-pill").textContent = stage.narrationText;
  updateDockControls();

  if (shouldPlayAudio) {
    audio.playStageNarration(stage.audioFile, state.booted && state.audioAutoPlay);
  }

  if (stage.sceneConfig.autoProbe) {
    autoProbeTimeout = setTimeout(() => {
      triggerProbeLaunch();
    }, 400);
  }
}

function setActiveCameraPreset(preset) {
  state.cameraPreset = preset;
  document.querySelectorAll("[data-cam]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.cam === preset);
  });
  scene3d?.setCameraPreset(preset);
}

// ============================================================================
// RENDERIZADO DE LA INTERFAZ CHATGPT SPATIAL
// ============================================================================

function renderStageSelector() {
  const container = $("stage-selector-grid");
  container.innerHTML = STAGES.map((st) => {
    const active = st.id === state.stageIdx ? "active" : "";
    return `
      <button class="stage-pill ${active}" data-stage="${st.id}" title="${st.title}">
        <span class="stage-pill-num font-mono-tech">ETAPA ${st.code}</span>
        <span class="stage-pill-label">${st.shortTitle}</span>
      </button>
    `;
  }).join("");

  container.querySelectorAll(".stage-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.playNodeSelect();
      goToStage(Number(btn.dataset.stage));
    });
  });
}

function renderLeftStageContent() {
  const stage = STAGES[state.stageIdx];
  const ds = DATASETS[state.datasetId];

  $("stage-badge-kicker").textContent = stage.badge;
  $("stage-title-text").textContent = stage.title;
  $("stage-plain-text").textContent = stage.plainSummary;
  $("stage-formula-text").textContent = stage.formulaDisplay;
  $("stage-challenge-text").textContent = stage.challengePrompt;

  const ctrlBox = $("stage-controls-container");

  if (state.stageIdx === 0 || state.stageIdx === 1) {
    ctrlBox.innerHTML = `
      <div class="stark-card">
        <div class="card-kicker">Clases en la Cámara 3D (${ds.name})</div>
        <div style="display:flex; flex-direction:column; gap:7px; font-size:12.5px;">
          ${ds.classes
            .map(
              (c) => `
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="display:flex; align-items:center; gap:8px;">
                <span style="width:10px; height:10px; border-radius:50%; background:${c.cssColor}; box-shadow:0 0 10px ${c.cssColor};"></span>
                <strong>${c.name}</strong>
              </span>
              <span class="font-mono-tech" style="color:#8e8e93; font-size:11px;">y = ${c.id}</span>
            </div>`
            )
            .join("")}
        </div>
        <button id="btn-quick-next-1" class="action-btn" style="margin-top:11px;">
          Continuar a Etapa ${state.stageIdx + 1} →
        </button>
      </div>
    `;
    $("btn-quick-next-1")?.addEventListener("click", () => {
      audio.playNodeSelect();
      goToStage(state.stageIdx + 1);
    });
  } else if (state.stageIdx === 2) {
    const p1 = state.purityMixRatio;
    const p2 = 1 - p1;
    const gini = 1 - (p1 * p1 + p2 * p2);
    const ent = computeEntropy([p1 * 100, p2 * 100], 100);
    ctrlBox.innerHTML = `
      <div class="stark-card">
        <div class="card-kicker">Simulador de Pureza Gini</div>
        <div class="control-row">
          <div class="control-label-row">
            <span>Proporción Esmeralda vs Coral</span>
            <strong class="font-mono-tech" id="lbl-purity-pct">${Math.round(p1 * 100)}% / ${Math.round(p2 * 100)}%</strong>
          </div>
          <input id="slider-purity" type="range" min="0" max="100" value="${Math.round(p1 * 100)}" />
        </div>
        <div class="formula-box font-mono-tech" id="lbl-purity-math">
          Gini = 1 − (${p1.toFixed(2)}² + ${p2.toFixed(2)}²) = <strong>${gini.toFixed(3)}</strong><br/>
          Entropía = <strong>${ent.toFixed(3)} bits</strong>
        </div>
      </div>
    `;
    $("slider-purity")?.addEventListener("input", (e) => {
      const val = Number(e.target.value) / 100;
      state.purityMixRatio = val;
      const q1 = val;
      const q2 = 1 - q1;
      const g = 1 - (q1 * q1 + q2 * q2);
      const en = computeEntropy([q1 * 100, q2 * 100], 100);
      $("lbl-purity-pct").textContent = `${Math.round(q1 * 100)}% / ${Math.round(q2 * 100)}%`;
      $("lbl-purity-math").innerHTML = `Gini = 1 − (${q1.toFixed(2)}² + ${q2.toFixed(2)}²) = <strong>${g.toFixed(3)}</strong><br/>Entropía = <strong>${en.toFixed(3)} bits</strong>`;
      scene3d.setPurityDemo(true, val);
    });
  } else if (state.stageIdx === 3) {
    ctrlBox.innerHTML = `
      <div class="stark-card">
        <div class="card-kicker">Escáner de Corte CART (Eje Activo)</div>
        <div class="seg-group">
          ${ds.features
            .map(
              (f, idx) => `
            <button class="seg-btn ${state.laserAxis === idx ? "active" : ""}" data-axis="${idx}">
              ${f.short}
            </button>`
            )
            .join("")}
        </div>
        <div class="seg-group-2" style="margin-top:8px;">
          <button id="btn-laser-auto" class="seg-btn ${!state.laserManual ? "active" : ""}">🤖 Auto CART</button>
          <button id="btn-laser-manual" class="seg-btn ${state.laserManual ? "active" : ""}">✋ Láser Manual</button>
        </div>
        <div class="control-row" id="manual-laser-row" style="display:${state.laserManual ? "flex" : "none"};">
          <div class="control-label-row">
            <span>Posición del Plano</span>
            <strong class="font-mono-tech" id="lbl-manual-thr">--</strong>
          </div>
          <input id="slider-manual-laser" type="range" min="-95" max="95" value="${Math.round(state.laserManualNorm * 100)}" />
        </div>
        <div class="formula-box font-mono-tech" id="lbl-laser-readout">Evaluando puntos de corte...</div>
      </div>
    `;
    ctrlBox.querySelectorAll("[data-axis]").forEach((btn) => {
      btn.addEventListener("click", () => {
        audio.playNodeSelect();
        state.laserAxis = Number(btn.dataset.axis);
        renderLeftStageContent();
        rebuildModelAndScene();
      });
    });
    $("btn-laser-auto")?.addEventListener("click", () => {
      audio.playNodeSelect();
      state.laserManual = false;
      renderLeftStageContent();
      rebuildModelAndScene();
    });
    $("btn-laser-manual")?.addEventListener("click", () => {
      audio.playNodeSelect();
      state.laserManual = true;
      renderLeftStageContent();
      rebuildModelAndScene();
    });
    $("slider-manual-laser")?.addEventListener("input", (e) => {
      state.laserManualNorm = Number(e.target.value) / 100;
      scene3d.setLaserSweep(
        true,
        state.laserAxis,
        state.laserScanData.candidates,
        state.laserScanData.best,
        state.laserManualNorm
      );
      updateLaserReadout(state.laserManualNorm, true);
    });
  } else if (state.stageIdx === 4) {
    ctrlBox.innerHTML = `
      <div class="stark-card">
        <div class="card-kicker">Explorar Sub-regiones 3D</div>
        <p class="card-body" style="margin-bottom:8px;">
          Toca cualquier nodo en 3D o usa estos accesos directos para iluminar su caja ortogonal en el Cubo:
        </p>
        <div class="seg-group">
          <button class="seg-btn" data-jump-node="N0">Raíz N0</button>
          <button class="seg-btn" data-jump-node="N0L">Rama SÍ</button>
          <button class="seg-btn" data-jump-node="N0R">Rama NO</button>
        </div>
      </div>
    `;
    ctrlBox.querySelectorAll("[data-jump-node]").forEach((b) => {
      b.addEventListener("click", () => {
        const target = state.tree.nodes.find((n) => n.id === b.dataset.jumpNode);
        if (target) {
          audio.playNodeSelect();
          state.selectedNodeId = target.id;
          scene3d.highlightSelection(target.id);
          renderInspectorHUD();
          syncXRSlate();
        }
      });
    });
  } else if (state.stageIdx === 5 || state.stageIdx === 7 || state.stageIdx === 8) {
    const f = ds.features;
    const isSandbox = state.stageIdx === 8;
    const isForest = state.stageIdx === 7;
    ctrlBox.innerHTML = `
      ${isSandbox ? renderSandboxControlsHTML(ds) : ""}
      <div class="stark-card">
        <div class="card-kicker">${isForest ? "Simulador de Votación (Bosque)" : "Lanzador de Sonda de Inferencia"}</div>
        ${f
          .map(
            (feat, idx) => `
          <div class="control-row">
            <div class="control-label-row">
              <span>${feat.label}</span>
              <strong class="font-mono-tech" id="lbl-probe-${idx}">${state.probeValues[idx]} ${feat.unit}</strong>
            </div>
            <input id="slider-probe-${idx}" type="range" min="${feat.min}" max="${feat.max}" step="${(feat.max - feat.min) / 100}" value="${state.probeValues[idx]}" />
          </div>`
          )
          .join("")}
        <div class="seg-group-2" style="margin-top:10px;">
          <button id="btn-launch-probe" class="action-btn">🚀 Lanzar Sonda</button>
          <button id="btn-rand-probe" class="seg-btn">🎲 Muestra Azar</button>
        </div>
        <div id="probe-trace-box" class="formula-box font-mono-tech" style="margin-top:8px;">
          Ajusta las variables y lanza la sonda por el árbol 3D.
        </div>
      </div>
    `;
    if (isSandbox) bindSandboxControlEvents();
    f.forEach((feat, idx) => {
      $(`slider-probe-${idx}`)?.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        state.probeValues[idx] = Math.abs(feat.max - feat.min) > 20 ? Math.round(v) : +v.toFixed(2);
        $(`lbl-probe-${idx}`).textContent = `${state.probeValues[idx]} ${feat.unit}`;
      });
    });
    $("btn-launch-probe")?.addEventListener("click", () => triggerProbeLaunch());
    $("btn-rand-probe")?.addEventListener("click", () => {
      f.forEach((feat, idx) => {
        const r = feat.min + Math.random() * (feat.max - feat.min);
        state.probeValues[idx] = Math.abs(feat.max - feat.min) > 20 ? Math.round(r) : +r.toFixed(2);
        $(`slider-probe-${idx}`).value = state.probeValues[idx];
        $(`lbl-probe-${idx}`).textContent = `${state.probeValues[idx]} ${feat.unit}`;
      });
      triggerProbeLaunch();
    });
  } else if (state.stageIdx === 6) {
    ctrlBox.innerHTML = `
      <div class="stark-card">
        <div class="card-kicker">Regularización y Poda (max_depth)</div>
        <div class="control-row">
          <div class="control-label-row">
            <span>Profundidad Máxima (max_depth)</span>
            <strong class="font-mono-tech" id="lbl-depth-6">${state.maxDepth}</strong>
          </div>
          <input id="slider-depth-6" type="range" min="1" max="6" step="1" value="${state.maxDepth}" />
        </div>
        <div class="seg-group-2" style="margin-top:8px;">
          <button id="btn-depth-sweet" class="seg-btn">✅ Ideal (Depth=4)</button>
          <button id="btn-depth-overfit" class="seg-btn">⚠️ Overfit (Depth=6)</button>
        </div>
        <div class="formula-box font-mono-tech" style="margin-top:8px;">
          Anillos ámbar giratorios = 6 sensores con ruido.<br/>
          Compara Entrenamiento vs Prueba en el panel derecho.
        </div>
      </div>
    `;
    $("slider-depth-6")?.addEventListener("input", (e) => {
      state.maxDepth = Number(e.target.value);
      $("lbl-depth-6").textContent = state.maxDepth;
      rebuildModelAndScene();
      if (state.maxDepth >= 5) audio.playOverfitAlert();
      else audio.playNodeSelect();
    });
    $("btn-depth-sweet")?.addEventListener("click", () => {
      state.maxDepth = 4;
      $("slider-depth-6").value = 4;
      $("lbl-depth-6").textContent = "4";
      audio.playLeafChime(true);
      rebuildModelAndScene();
    });
    $("btn-depth-overfit")?.addEventListener("click", () => {
      state.maxDepth = 6;
      $("slider-depth-6").value = 6;
      $("lbl-depth-6").textContent = "6";
      audio.playOverfitAlert();
      rebuildModelAndScene();
    });
  }
}

function renderSandboxControlsHTML() {
  return `
    <div class="stark-card" style="margin-bottom:2px;">
      <div class="card-kicker">Hiperparámetros del Modelo CART</div>
      <div class="seg-group">
        ${Object.values(DATASETS)
          .map(
            (d) => `
          <button class="seg-btn ${state.datasetId === d.id ? "active" : ""}" data-ds="${d.id}">
            ${d.shortName}
          </button>`
          )
          .join("")}
      </div>
      <div class="seg-group-2" style="margin-top:8px;">
        <button class="seg-btn ${state.criterion === "gini" ? "active" : ""}" data-crit="gini">Criterio: Gini</button>
        <button class="seg-btn ${state.criterion === "entropy" ? "active" : ""}" data-crit="entropy">Criterio: Entropía</button>
      </div>
      <div class="control-row">
        <div class="control-label-row">
          <span>Profundidad Máxima (max_depth)</span>
          <strong class="font-mono-tech" id="lbl-sb-depth">${state.maxDepth}</strong>
        </div>
        <input id="slider-sb-depth" type="range" min="1" max="6" step="1" value="${state.maxDepth}" />
      </div>
      <div class="control-row">
        <div class="control-label-row">
          <span>Mín. Muestras p/ Dividir</span>
          <strong class="font-mono-tech" id="lbl-sb-min">${state.minSamplesSplit}</strong>
        </div>
        <input id="slider-sb-min" type="range" min="2" max="12" step="1" value="${state.minSamplesSplit}" />
      </div>
      <div class="seg-group-2" style="margin-top:8px;">
        <button id="btn-sb-noise" class="seg-btn ${state.includeNoise ? "active" : ""}">
          ${state.includeNoise ? "⚠️ Ruido: ON" : "✨ Datos Limpios"}
        </button>
        <button id="btn-sb-forest" class="seg-btn ${state.forestMode ? "active" : ""}">
          ${state.forestMode ? "🌲 Bosque (5)" : "🌳 1 Árbol"}
        </button>
      </div>
    </div>
  `;
}

function bindSandboxControlEvents() {
  document.querySelectorAll("[data-ds]").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.playNodeSelect();
      state.datasetId = btn.dataset.ds;
      state.probeValues = [...DATASETS[state.datasetId].defaultProbe];
      state.selectedNodeId = "N0";
      state.selectedSample = null;
      renderLeftStageContent();
      rebuildModelAndScene();
    });
  });

  document.querySelectorAll("[data-crit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.playNodeSelect();
      state.criterion = btn.dataset.crit;
      renderLeftStageContent();
      rebuildModelAndScene();
    });
  });

  $("slider-sb-depth")?.addEventListener("input", (e) => {
    state.maxDepth = Number(e.target.value);
    $("lbl-sb-depth").textContent = state.maxDepth;
    rebuildModelAndScene();
  });

  $("slider-sb-min")?.addEventListener("input", (e) => {
    state.minSamplesSplit = Number(e.target.value);
    $("lbl-sb-min").textContent = state.minSamplesSplit;
    rebuildModelAndScene();
  });

  $("btn-sb-noise")?.addEventListener("click", () => {
    state.includeNoise = !state.includeNoise;
    audio.playNodeSelect();
    renderLeftStageContent();
    rebuildModelAndScene();
  });

  $("btn-sb-forest")?.addEventListener("click", () => {
    state.forestMode = !state.forestMode;
    audio.playNodeSelect();
    renderLeftStageContent();
    rebuildModelAndScene();
  });
}

function renderMetricsHUD() {
  $("m-train-acc").textContent = `${state.trainAcc.toFixed(0)}%`;
  $("m-test-acc").textContent = `${state.testAcc.toFixed(0)}%`;
  $("m-nodes-count").textContent = state.forestMode ? "5 Árboles" : `${state.tree?.nodeCount || 1}`;
  $("m-depth-val").textContent = `${state.tree?.maxActualDepth ?? 0} / ${state.maxDepth}`;

  const overfitGap = state.trainAcc - state.testAcc;
  const alertEl = $("overfit-alert");
  if (overfitGap >= 11 || (state.includeNoise && state.maxDepth >= 5)) {
    alertEl.style.display = "block";
    alertEl.innerHTML = `<strong>⚠️ ALERTA OVERFITTING:</strong> Brecha Entrenamiento (${state.trainAcc.toFixed(0)}%) vs Prueba (${state.testAcc.toFixed(0)}%). El árbol memorizó ruido. Reduce <code>max_depth</code> a 4.`;
  } else {
    alertEl.style.display = "none";
  }
}

function renderInspectorHUD() {
  const ds = DATASETS[state.datasetId];
  const container = $("node-inspector-body");

  if (state.selectedSample) {
    const s = state.selectedSample;
    const cls = ds.classes[s.label];
    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span class="badge-pill badge-cyan font-mono-tech">ESFERA #${s.id}</span>
        <button id="btn-back-to-node" class="seg-btn" style="min-height:26px; padding:2px 8px;">Ver Nodo Raíz</button>
      </div>
      <h3 class="card-title" style="color:${cls.cssColor}">Etiqueta Real: ${cls.name} ${s.isNoise ? "⚠️ (Ruido)" : ""}</h3>
      <div class="formula-box font-mono-tech">
        ${ds.features
          .map((f, i) => `${f.label}: <strong>${s.values[i]} ${f.unit}</strong>`)
          .join("<br/>")}
      </div>
      <p class="card-body" style="margin-top:8px;">
        Observa en el Cubo 3D las 3 líneas punteadas proyectadas hacia los ejes X, Y, Z.
      </p>
    `;
    $("btn-back-to-node")?.addEventListener("click", () => {
      state.selectedSample = null;
      renderInspectorHUD();
    });
    return;
  }

  const node = state.tree?.nodes.find((n) => n.id === state.selectedNodeId) || state.tree?.root;
  if (!node) return;

  const maj = ds.classes[node.majorityClass];
  const feat = !node.isLeaf ? ds.features[node.featureIdx] : null;
  const barSegs = ds.classes
    .map((c, idx) => {
      const pct = node.n > 0 ? (node.counts[idx] / node.n) * 100 : 0;
      return `<div style="width:${pct}%; background:${c.cssColor}; height:100%;" title="${c.name}: ${node.counts[idx]}"></div>`;
    })
    .join("");

  const probsTerms = ds.classes
    .map((c, idx) => (node.n > 0 ? (node.counts[idx] / node.n).toFixed(2) : "0.00") + "²")
    .join(" + ");

  const stopLabel = {
    pure: "Pureza Total (Gini = 0)",
    max_depth: "Límite max_depth alcanzado",
    min_samples: "Muestras < min_samples_split",
    no_gain: "Sin ganancia adicional"
  }[node.stopReason] || "";

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:6px;">
      <span class="badge-pill badge-cyan font-mono-tech">NODO ${node.id} · NIVEL ${node.depth}</span>
      <button id="btn-speak-node" class="seg-btn" style="min-height:26px; padding:2px 9px;">🗣️ Explicar Nodo</button>
    </div>
    <h3 class="card-title">
      ${
        node.isLeaf
          ? `Hoja Final → <span style="color:${maj.cssColor}">${maj.name} (${Math.round(node.confidence * 100)}%)</span>`
          : `Pregunta: ¿${feat.label} ≤ ${node.threshold} ${feat.unit}?`
      }
    </h3>
    <div class="purity-bar-track">${barSegs}</div>
    <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:11.5px; margin-bottom:6px;">
      ${ds.classes
        .map(
          (c, i) => `
        <span style="color:${c.cssColor}; font-weight:600;">
          ● ${c.name}: ${node.counts[i]} (${node.n ? Math.round((node.counts[i] / node.n) * 100) : 0}%)
        </span>`
        )
        .join("")}
    </div>
    <div class="formula-box font-mono-tech">
      Muestras N = ${node.n}<br/>
      Gini = 1 − (${probsTerms}) = <strong>${node.gini.toFixed(3)}</strong><br/>
      Entropía = <strong>${node.entropy.toFixed(3)} bits</strong><br/>
      ${
        node.isLeaf
          ? `Parada: ${stopLabel}`
          : `Ganancia del Corte (Δ): <strong style="color:#34d399;">+${node.gain.toFixed(3)}</strong>`
      }
    </div>
  `;

  $("btn-speak-node")?.addEventListener("click", () => {
    const text = node.isLeaf
      ? `Nodo hoja ${node.id} con ${node.n} muestras. Predicción ${maj.name} con ${Math.round(node.confidence * 100)} por ciento de confianza e impureza Gini ${node.gini.toFixed(2)}.`
      : `Nodo de decisión ${node.id}. Pregunta: si ${feat.label} es menor o igual a ${node.threshold} ${feat.unit}. Impureza Gini actual ${node.gini.toFixed(2)} con ganancia de ${node.gain.toFixed(3)}.`;
    if (!audio.speakDynamic(text)) {
      audio.playNodeSelect();
      showToast("Usa el botón de Voz IA del dock inferior para la narración principal.");
    }
  });
}

// ============================================================================
// DIAGNÓSTICO AVANZADO (IMPORTANCIA + MATRIZ DE CONFUSIÓN) & CÓDIGO PYTHON
// ============================================================================

function renderCanvasDiagAndCode() {
  const ds = DATASETS[state.datasetId];
  const diagPane = $("canvas-diag-pane");
  const codePane = $("canvas-code-pane");
  if (!diagPane || !codePane) return;

  // 1. Importancia de variables + Matriz de confusión en Test
  const importances = computeFeatureImportances(state.tree, ds.features.length);
  const cm = computeConfusionMatrix(
    state.forestMode ? state.forest : state.tree,
    state.testSamples,
    ds.classes.length,
    state.forestMode
  );

  const fiHtml = ds.features
    .map((f, idx) => {
      const pct = Math.round(importances[idx] * 100);
      return `
        <div class="fi-row">
          <div style="display:flex; justify-content:space-between; font-size:11px;">
            <span>${f.label}</span>
            <strong class="font-mono-tech" style="color:#34d399;">${pct}%</strong>
          </div>
          <div class="fi-track">
            <div class="fi-fill" style="width:${pct}%;"></div>
          </div>
        </div>
      `;
    })
    .join("");

  const cmRowsHtml = ds.classes
    .map((rowCls, rIdx) => {
      const cells = ds.classes
        .map((colCls, cIdx) => {
          const val = cm[rIdx]?.[cIdx] ?? 0;
          const isDiag = rIdx === cIdx;
          const bg = isDiag
            ? val > 0
              ? "rgba(16, 163, 127, 0.25)"
              : "rgba(255,255,255,0.03)"
            : val > 0
              ? "rgba(244, 63, 94, 0.22)"
              : "rgba(255,255,255,0.03)";
          return `<td class="cm-cell font-mono-tech" style="background:${bg};" title="Real: ${rowCls.name} → Predicho: ${colCls.name}">${val}</td>`;
        })
        .join("");
      return `<tr><td style="font-size:10.5px; color:${rowCls.cssColor}; font-weight:600; padding-right:4px;">${rowCls.name.slice(0, 7)}</td>${cells}</tr>`;
    })
    .join("");

  const cmHeadCols = ds.classes
    .map((c) => `<th style="font-size:10px; color:${c.cssColor}; font-weight:600;">${c.name.slice(0, 6)}</th>`)
    .join("");

  diagPane.innerHTML = `
    <div style="font-size:11px; font-weight:600; color:#ececec; margin-bottom:4px;">Importancia de Variables (Gini Gain)</div>
    <div id="feature-importance-bars">${fiHtml}</div>
    <div style="font-size:11px; font-weight:600; color:#ececec; margin:10px 0 3px;">Matriz de Confusión (Set de Prueba)</div>
    <div id="confusion-matrix-wrap">
      <table class="cm-table">
        <thead>
          <tr><th style="font-size:9.5px; color:#8e8e93; text-align:left;">Real \\ Pred</th>${cmHeadCols}</tr>
        </thead>
        <tbody>${cmRowsHtml}</tbody>
      </table>
    </div>
  `;

  // 2. Código Python scikit-learn generado en tiempo real
  const pyCode = state.forestMode
    ? `from sklearn.ensemble import RandomForestClassifier\n\nmodel = RandomForestClassifier(\n    n_estimators=5,\n    criterion="${state.criterion}",\n    max_depth=${state.maxDepth},\n    min_samples_split=${state.minSamplesSplit},\n    random_state=42\n)\nmodel.fit(X_train, y_train)\nprint(f"Test Acc: {model.score(X_test, y_test):.1%}")`
    : `from sklearn.tree import DecisionTreeClassifier\n\nclf = DecisionTreeClassifier(\n    criterion="${state.criterion}",\n    max_depth=${state.maxDepth},\n    min_samples_split=${state.minSamplesSplit},\n    random_state=42\n)\nclf.fit(X_train, y_train)\nprint(f"Test Acc: {clf.score(X_test, y_test):.1%}")`;

  codePane.innerHTML = `
    <div class="gpt-code-card">
      <div class="gpt-code-header font-mono-tech">
        <span>python · scikit-learn</span>
        <button id="btn-copy-py" class="gpt-copy-btn">📋 Copiar código</button>
      </div>
      <pre id="python-code-snippet" class="gpt-code-pre font-mono-tech">${pyCode}</pre>
    </div>
  `;

  $("btn-copy-py")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(pyCode).catch(() => {});
    showToast("Código Python scikit-learn copiado al portapapeles");
  });
}

// ============================================================================
// GRÁFICO DE GANANCIA EN VIVO + LECTURA LÁSER (ETAPA 3)
// ============================================================================

function drawGainChart(activeNormPos = null) {
  const wrap = $("gain-chart-card");
  const canvas = $("gain-chart");
  if (!wrap || !canvas) return;

  const showChart = state.stageIdx === 3;
  wrap.style.display = showChart ? "block" : "none";
  if (!showChart) return;

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const { candidates, best } = state.laserScanData;
  const ds = DATASETS[state.datasetId];
  const feat = ds.features[state.laserAxis];

  if (!candidates || candidates.length === 0) return;

  const maxGain = Math.max(0.05, ...candidates.map((c) => c.gain));

  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 1;
  for (let y = 20; y < h; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.beginPath();
  candidates.forEach((c, i) => {
    const nx = (c.threshold - feat.min) / (feat.max - feat.min);
    const px = 12 + nx * (w - 24);
    const py = h - 14 - (c.gain / maxGain) * (h - 30);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = "#10a37f";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  if (best) {
    const bx = 12 + ((best.threshold - feat.min) / (feat.max - feat.min)) * (w - 24);
    const by = h - 14 - (best.gain / maxGain) * (h - 30);
    ctx.fillStyle = "#34d399";
    ctx.beginPath();
    ctx.arc(bx, by, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (activeNormPos !== null) {
    const lx = 12 + ((activeNormPos + 1) / 2) * (w - 24);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx, 6);
    ctx.lineTo(lx, h - 6);
    ctx.stroke();
  }
}

function updateLaserReadout(normPos, withPing = false) {
  const ds = DATASETS[state.datasetId];
  const feat = ds.features[state.laserAxis];
  const { candidates, best } = state.laserScanData;
  if (!candidates.length || !best) return;

  const thr = denormalizeValue(normPos, feat.min, feat.max);
  let nearest = candidates[0];
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = Math.abs(c.threshold - thr);
    if (d < bestDist) {
      bestDist = d;
      nearest = c;
    }
  }

  const thrEl = $("lbl-manual-thr");
  if (thrEl) thrEl.textContent = `${thr.toFixed(1)} ${feat.unit}`;

  const readout = $("lbl-laser-readout");
  if (readout) {
    const ratio = best.gain > 0 ? Math.round((nearest.gain / best.gain) * 100) : 0;
    readout.innerHTML =
      `Óptimo CART: <strong>${feat.short} ≤ ${best.threshold}${feat.unit}</strong> (Δ=${best.gain.toFixed(3)})<br/>` +
      `Láser actual: ${thr.toFixed(1)}${feat.unit} → Δ=${nearest.gain.toFixed(3)} (${ratio}% del óptimo)`;
  }

  if (withPing) {
    const now = performance.now();
    if (now - lastLaserTickPing > 95) {
      lastLaserTickPing = now;
      audio.playLaserPing(best.gain > 0 ? nearest.gain / best.gain : 0.3);
    }
  }

  drawGainChart(normPos);
}

// ============================================================================
// LANZADOR DE SONDA DE INFERENCIA EN VIVO
// ============================================================================

function triggerProbeLaunch() {
  const ds = DATASETS[state.datasetId];
  const traceBox = $("probe-trace-box");

  if (state.forestMode && state.forest) {
    const fRes = predictForest(state.forest, state.probeValues, ds.classes.length);
    const winCls = ds.classes[fRes.winner];
    audio.playLeafChime(true);
    if (traceBox) {
      traceBox.innerHTML =
        `<strong>Voto del Bosque (5 Árboles):</strong><br/>` +
        ds.classes.map((c, i) => `${c.name}: ${fRes.votes[i]} votos`).join(" | ") +
        `<br/><strong style="color:${winCls.cssColor}">Veredicto: ${winCls.name.toUpperCase()}</strong>`;
    }
    showToast(`🌲 Bosque votó: ${winCls.name}`);
    return;
  }

  if (!state.tree) return;
  const pred = predictWithTrace(state.tree, state.probeValues);
  state.lastProbeResult = pred;
  const winCls = ds.classes[pred.prediction];

  if (traceBox) traceBox.innerHTML = "🚀 Sonda lanzada desde el Nodo Raíz N0...";

  scene3d.launchProbe(state.probeValues, pred, (stepIdx, stepInfo, isDone) => {
    if (!isDone && stepInfo) {
      audio.playBranchStep(stepInfo.goLeft);
      const f = ds.features[stepInfo.featureIdx];
      state.selectedNodeId = stepInfo.nodeId;
      scene3d.highlightSelection(stepInfo.nodeId);
      renderInspectorHUD();
      if (traceBox) {
        traceBox.innerHTML += `<br/>Paso ${stepIdx + 1}: ${f.short} ${stepInfo.value} ≤ ${stepInfo.threshold} → <strong>${stepInfo.goLeft ? "✓ SÍ" : "✗ NO"}</strong>`;
      }
    } else if (isDone) {
      audio.playLeafChime(pred.leaf.gini < 0.05);
      state.selectedNodeId = pred.leaf.id;
      scene3d.highlightSelection(pred.leaf.id);
      renderInspectorHUD();
      if (traceBox) {
        traceBox.innerHTML += `<br/><strong style="color:${winCls.cssColor}">🎯 VEREDICTO: ${winCls.name.toUpperCase()} (${Math.round(pred.confidence * 100)}%)</strong>`;
      }
      showToast(`🎯 Predicción: ${winCls.name} (${Math.round(pred.confidence * 100)}%)`);
      syncXRSlate();
    }
  });
}

// ============================================================================
// CONTROLES DE DOCK, HEADER Y MODO WEBXR (META QUEST 3)
// ============================================================================

function updateDockControls() {
  const stage = STAGES[state.stageIdx];
  $("dock-stage-label").textContent = `Etapa ${stage.id}/8 · ${stage.shortTitle}`;
  $("btn-prev-stage").disabled = state.stageIdx === 0;
  $("btn-next-stage").disabled = state.stageIdx === STAGES.length - 1;
}

function updateVoiceUI({ isPlaying }) {
  $("btn-dock-play").textContent = isPlaying ? "⏸ Pausar Voz" : "▶ Escuchar Voz";
  $("jarvis-btn-label").textContent = isPlaying ? "Voz Activa" : "Voz en Pausa";
}

function syncHUDVisibility() {
  $("left-panel").classList.toggle("collapsed-left", !state.hudVisible || state.leftCollapsed);
  $("right-panel").classList.toggle("collapsed-right", !state.hudVisible || state.rightCollapsed);
  $("caption-pill").style.opacity = state.hudVisible ? "1" : "0";
  $("camera-preset-bar").style.opacity = state.hudVisible ? "1" : "0";
  $("btn-toggle-hud").classList.toggle("hud-btn-active", state.hudVisible);
}

async function handleEnterXR(mode) {
  audio.unlockContext();
  try {
    await scene3d.enterXR(mode);
    audio.playBootChord();
    syncXRSlate();
  } catch (err) {
    $("modal-quest-guide").classList.remove("hidden");
    showToast(err.message || "Abre esta URL desde el navegador de tus Meta Quest 3.");
  }
}

async function detectXRSupportBadges() {
  if (!navigator.xr) return;
  try {
    const arOk = await navigator.xr.isSessionSupported("immersive-ar");
    const vrOk = await navigator.xr.isSessionSupported("immersive-vr");
    if (arOk) $("btn-enter-ar").title = "Compatible detectado: Iniciar Passthrough MR en Meta Quest 3";
    if (vrOk) $("btn-enter-vr").title = "Compatible detectado: Iniciar Entorno VR";
  } catch (e) {}
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

function init() {
  const canvas = $("xr-canvas");
  const hoverTooltip = $("spatial-hover-tooltip");

  scene3d = new StarkHologramScene(canvas, {
    onNodeSelected: (node) => {
      audio.playNodeSelect();
      state.selectedSample = null;
      state.selectedNodeId = node.id;
      renderInspectorHUD();
      syncXRSlate();
      showToast(`Nodo ${node.id} seleccionado (Gini ${node.gini.toFixed(2)})`);
    },
    onSampleSelected: (sample) => {
      audio.playNodeSelect();
      state.selectedSample = sample;
      renderInspectorHUD();
      const ds = DATASETS[state.datasetId];
      showToast(`Esfera #${sample.id} · ${ds.classes[sample.label].name}`);
    },
    onHoverObject: (data, clientX, clientY) => {
      if (!hoverTooltip) return;
      if (!data) {
        hoverTooltip.classList.remove("visible");
        return;
      }
      const ds = DATASETS[state.datasetId];
      hoverTooltip.style.left = `${clientX}px`;
      hoverTooltip.style.top = `${clientY}px`;
      if (data.type === "sample") {
        const s = data.sample;
        const cls = ds.classes[s.label];
        const coords = ds.features.map((f, i) => `${f.short}: ${s.values[i]}${f.unit}`).join(" · ");
        hoverTooltip.innerHTML = `<strong style="color:${cls.cssColor}">● Esfera #${s.id} (${cls.name})</strong><br/><span class="font-mono-tech" style="font-size:10.5px; color:#b4b4b8;">${coords}</span>`;
      } else if (data.type === "node") {
        const n = data.node;
        const maj = ds.classes[n.majorityClass];
        const desc = n.isLeaf
          ? `Hoja: ${maj.name} (${Math.round(n.confidence * 100)}%)`
          : `¿${ds.features[n.featureIdx].short} ≤ ${n.threshold}${ds.features[n.featureIdx].unit}?`;
        hoverTooltip.innerHTML = `<strong>Nodo ${n.id}</strong> · ${desc}<br/><span class="font-mono-tech" style="font-size:10.5px; color:#34d399;">Gini ${n.gini.toFixed(3)} · Muestras N=${n.n}</span>`;
      }
      hoverTooltip.classList.add("visible");
    },
    onLaserScanTick: (normPos) => {
      if (state.stageIdx === 3 && !state.laserManual) {
        updateLaserReadout(normPos, false);
      }
    },
    onXRButtonClick: (btnId) => {
      audio.playNodeSelect();
      if (btnId === "prev") goToStage(state.stageIdx - 1);
      else if (btnId === "next") goToStage(state.stageIdx + 1);
      else if (btnId === "audio") audio.togglePlayPause();
      else if (btnId === "probe") triggerProbeLaunch();
      else if (btnId === "depthDown") {
        state.maxDepth = Math.max(1, state.maxDepth - 1);
        rebuildModelAndScene();
      } else if (btnId === "depthUp") {
        state.maxDepth = Math.min(6, state.maxDepth + 1);
        rebuildModelAndScene();
      } else if (btnId === "dataset") {
        const ids = Object.keys(DATASETS);
        const nextIdx = (ids.indexOf(state.datasetId) + 1) % ids.length;
        state.datasetId = ids[nextIdx];
        state.probeValues = [...DATASETS[state.datasetId].defaultProbe];
        renderLeftStageContent();
        rebuildModelAndScene();
      } else if (btnId === "exit") {
        scene3d.exitXR();
      }
    },
    onXRSessionEnd: () => {
      showToast("Sesión WebXR finalizada.");
    }
  });

  // Eventos del motor de audio + animador de espectro vocal y Orbe 3D
  audio.onStateChange = (info) => updateVoiceUI(info);
  audio.onProgress = ({ currentTime, duration }) => {
    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
    $("audio-progress-fill").style.width = `${pct}%`;
    $("audio-time-label").textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  };

  const spectrumBars = Array.from(document.querySelectorAll(".voice-bar"));
  function tickSpectrum(nowMs) {
    const t = nowMs * 0.001;
    const bars = audio.getSpectrumBars(spectrumBars.length, t);
    spectrumBars.forEach((bar, i) => {
      bar.style.height = `${Math.round(3 + bars[i] * 12)}px`;
    });
    scene3d.setVoiceEnergy(audio.getVoiceEnergy(t));
    requestAnimationFrame(tickSpectrum);
  }
  requestAnimationFrame(tickSpectrum);

  // Botón Bootloader
  $("btn-boot-start").addEventListener("click", () => {
    state.booted = true;
    $("jarvis-boot-overlay").classList.add("hidden-boot");
    audio.unlockContext();
    audio.playBootChord();
    audio.playStageNarration(STAGES[state.stageIdx].audioFile, true);
    showToast("Experiencia Espacial activa · Voz IA sincronizada");
  });

  // Controles Header
  $("btn-reactor-reset").addEventListener("click", () => {
    audio.playNodeSelect();
    setActiveCameraPreset("general");
    scene3d.resetCamera();
    showToast("Cámara y escena 3D recentradas");
  });

  $("btn-toggle-left").addEventListener("click", () => {
    state.leftCollapsed = !state.leftCollapsed;
    syncHUDVisibility();
  });

  $("btn-toggle-right").addEventListener("click", () => {
    state.rightCollapsed = !state.rightCollapsed;
    syncHUDVisibility();
  });

  $("btn-toggle-hud").addEventListener("click", () => {
    state.hudVisible = !state.hudVisible;
    syncHUDVisibility();
  });

  $("btn-jarvis-header").addEventListener("click", () => audio.togglePlayPause());
  $("btn-dock-play").addEventListener("click", () => audio.togglePlayPause());

  $("btn-toggle-sfx").addEventListener("click", () => {
    const on = audio.toggleSfx();
    $("btn-toggle-sfx").textContent = on ? "🎛️ SFX" : "🔇 MUTE";
    $("btn-toggle-sfx").classList.toggle("hud-btn-active", on);
  });

  $("btn-enter-ar").addEventListener("click", () => handleEnterXR("immersive-ar"));
  $("btn-enter-vr").addEventListener("click", () => handleEnterXR("immersive-vr"));

  $("btn-open-quest-guide").addEventListener("click", () => $("modal-quest-guide").classList.remove("hidden"));
  $("btn-close-quest-guide").addEventListener("click", () => $("modal-quest-guide").classList.add("hidden"));
  $("modal-quest-guide").addEventListener("click", (e) => {
    if (e.target === $("modal-quest-guide")) $("modal-quest-guide").classList.add("hidden");
  });

  // Pestañas del panel derecho (Importancia/Matriz vs Código Python)
  $("tab-btn-diag").addEventListener("click", () => {
    audio.playNodeSelect();
    $("tab-btn-diag").classList.add("active");
    $("tab-btn-code").classList.remove("active");
    $("canvas-diag-pane").style.display = "block";
    $("canvas-code-pane").style.display = "none";
  });
  $("tab-btn-code").addEventListener("click", () => {
    audio.playNodeSelect();
    $("tab-btn-code").classList.add("active");
    $("tab-btn-diag").classList.remove("active");
    $("canvas-code-pane").style.display = "block";
    $("canvas-diag-pane").style.display = "none";
  });

  // Barra superior de ángulos de cámara 3D
  document.querySelectorAll("[data-cam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.playNodeSelect();
      setActiveCameraPreset(btn.dataset.cam);
    });
  });

  // Controles Dock
  $("btn-prev-stage").addEventListener("click", () => {
    audio.playNodeSelect();
    goToStage(state.stageIdx - 1);
  });
  $("btn-next-stage").addEventListener("click", () => {
    audio.playNodeSelect();
    goToStage(state.stageIdx + 1);
  });

  document.querySelectorAll("[data-layout]").forEach((btn) => {
    btn.addEventListener("click", () => {
      audio.playNodeSelect();
      state.layoutMode = btn.dataset.layout;
      document.querySelectorAll("[data-layout]").forEach((b) => b.classList.remove("hud-btn-active"));
      btn.classList.add("hud-btn-active");
      scene3d.setLayoutMode(state.layoutMode);
    });
  });

  $("btn-autorotate").addEventListener("click", () => {
    state.autoRotate = !state.autoRotate;
    scene3d.setAutoRotate(state.autoRotate);
    $("btn-autorotate").classList.toggle("hud-btn-active", state.autoRotate);
  });

  $("btn-reset-cam").addEventListener("click", () => {
    audio.playNodeSelect();
    setActiveCameraPreset("general");
    scene3d.resetCamera();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goToStage(state.stageIdx + 1);
    else if (e.key === "ArrowLeft") goToStage(state.stageIdx - 1);
    else if (e.key.toLowerCase() === "h") {
      state.hudVisible = !state.hudVisible;
      syncHUDVisibility();
    } else if (e.key === " ") {
      e.preventDefault();
      audio.togglePlayPause();
    }
  });

  goToStage(0, false);
  detectXRSupportBadges();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

window.addEventListener("DOMContentLoaded", init);
