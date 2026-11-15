import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { normalizeValue } from "./cart-engine.js";

/**
 * OpenAI / ChatGPT Spatial ML Lab · Motor 3D & WebXR para Meta Quest 3
 * Incluye:
 *  - Materiales físicos (clearcoat, anillos giroscópicos, esferas con aura y líneas de cota 3D)
 *  - Animación orgánica de crecimiento del árbol (bloom por niveles) y ramas Cubic-Bézier
 *  - Transiciones suaves de cámara y layout con amortiguación exponencial (spring damping)
 *  - Orbe fluido 3D estilo ChatGPT Advanced Voice Mode reactivo al espectro de voz
 *  - Soporte completo WebXR Passthrough MR (`immersive-ar`) y Holodeck VR (`immersive-vr`)
 */

function disposeObject3D(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    disposeObject3D(child);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/**
 * Etiqueta flotante 3D con estética ChatGPT Dark Spatial Pill (2x Retina DPI)
 */
function createTextSprite(lines, opts = {}) {
  const {
    width = 360,
    height = 112,
    borderColor = "#10a37f",
    bgColor = "rgba(20, 20, 24, 0.94)",
    titleColor = "#f4f4f6",
    subColor = "#a1a1aa",
    scaleX = 0.42,
    scaleY = 0.13
  } = opts;

  const dpr = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, width, height);
  roundRect(ctx, 4, 4, width - 8, height - 8, 22);
  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.stroke();

  // Píldora de acento superior estilo OpenAI
  roundRect(ctx, width / 2 - 26, 4, 52, 4, 2);
  ctx.fillStyle = borderColor;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (lines.length === 1) {
    ctx.font = "700 27px 'Inter', -apple-system, sans-serif";
    ctx.fillStyle = titleColor;
    ctx.fillText(lines[0], width / 2, height * 0.54, width - 22);
  } else {
    ctx.font = "700 26px 'Inter', -apple-system, sans-serif";
    ctx.fillStyle = titleColor;
    ctx.fillText(lines[0], width / 2, height * 0.37, width - 20);

    ctx.font = "600 21px 'JetBrains Mono', monospace";
    ctx.fillStyle = subColor;
    ctx.fillText(lines[1], width / 2, height * 0.73, width - 20);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scaleX, scaleY, 1);
  return sprite;
}

export class StarkHologramScene {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 80);
    this.camera.position.set(0, 0.35, 5.15);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType("local-floor");

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.minDistance = 1.3;
    this.controls.maxDistance = 9.5;
    this.controls.target.set(0, -0.12, 0);

    // Suavizado de cámara por objetivos (se desactiva al arrastrar manualmente)
    this.cameraGoalPos = null;
    this.targetGoalPos = null;
    this.controls.addEventListener("start", () => {
      this.cameraGoalPos = null;
      this.targetGoalPos = null;
    });

    // Iluminación espacial de estudio (OpenAI Emerald + Soft Indigo + Warm Rim)
    const ambient = new THREE.AmbientLight(0xe2e8f0, 0.95);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
    keyLight.position.set(3.2, 4.8, 4.0);
    this.scene.add(keyLight);

    const emeraldLight = new THREE.PointLight(0x10a37f, 1.6, 12);
    emeraldLight.position.set(-2.5, 2.2, 2.5);
    this.scene.add(emeraldLight);

    const violetLight = new THREE.PointLight(0x8b5cf6, 1.3, 12);
    violetLight.position.set(2.8, -1.5, -2.5);
    this.scene.add(violetLight);

    // Entorno espacial minimalista (se oculta en Passthrough AR)
    this.holodeckEnv = new THREE.Group();
    this._buildHolodeckEnv();
    this.scene.add(this.holodeckEnv);

    // Pivot principal del Holograma
    this.hologramRoot = new THREE.Group();
    this.scene.add(this.hologramRoot);

    // Orbe de Voz 3D estilo ChatGPT Advanced Voice Mode
    this.voiceOrbGroup = new THREE.Group();
    this._buildVoiceOrb3D();
    this.hologramRoot.add(this.voiceOrbGroup);

    this.dataCubeGroup = new THREE.Group();
    this.pointsGroup = new THREE.Group();
    this.planesGroup = new THREE.Group();
    this.selectionBoxGroup = new THREE.Group();
    this.laserGroup = new THREE.Group();
    this.hoverRulerGroup = new THREE.Group();
    this.dataCubeGroup.add(
      this.pointsGroup,
      this.planesGroup,
      this.selectionBoxGroup,
      this.laserGroup,
      this.hoverRulerGroup
    );

    this.treeGroup = new THREE.Group();
    this.treeNodesGroup = new THREE.Group();
    this.treeBranchesGroup = new THREE.Group();
    this.treeGroup.add(this.treeBranchesGroup, this.treeNodesGroup);

    this.forestGroup = new THREE.Group();
    this.tetherGroup = new THREE.Group();
    this.probeGroup = new THREE.Group();
    this.purityReactorGroup = new THREE.Group();

    this.hologramRoot.add(
      this.dataCubeGroup,
      this.treeGroup,
      this.forestGroup,
      this.tetherGroup,
      this.probeGroup,
      this.purityReactorGroup
    );

    // Objetivos de interpolación suave de grupos (Layout Morphing)
    this.cubeGoalPos = new THREE.Vector3(-1.02, 0.14, 0);
    this.treeGoalPos = new THREE.Vector3(1.02, 0.1, 0);
    this.dataCubeGroup.position.copy(this.cubeGoalPos);
    this.treeGroup.position.copy(this.treeGoalPos);

    // Consola Espacial 3D para WebXR (Meta Quest 3)
    this.xrConsoleGroup = new THREE.Group();
    this.xrConsoleGroup.visible = false;
    this.xrButtons = [];
    this.xrSlateCanvas = null;
    this.xrSlateTexture = null;
    this._buildXRConsole();
    this.scene.add(this.xrConsoleGroup);

    // Controladores WebXR
    this.xrControllers = [];
    this.squeezingControllers = new Set();
    this.lastSqueezePos = new Map();
    this._setupXRControllers();

    // Estado interno
    this.layoutMode = "dual";
    this.autoRotate = false;
    this.isXR = false;
    this.forestMode = false;
    this.xrMode = null;
    this.voiceEnergy = 0;

    this.dataset = null;
    this.tree = null;
    this.selectedNodeId = null;
    this.hoveredObject = null;
    this.nodePositions = new Map();
    this.nodeMeshes = new Map();
    this.animatedNodeGroups = [];
    this.gimbalRings = [];
    this.floatingOrbs = [];
    this.scanlinePlanes = [];
    this.branchPackets = [];
    this.interactiveTargets = [];
    this.treeBirthTime = 0;

    // Escáner láser animado (Etapa 3)
    this.laserSweepActive = false;
    this.laserAxis = 1;
    this.laserCandidates = [];
    this.laserBest = null;
    this.laserManualNorm = null;
    this.laserPhase = 0;
    this.laserMesh = null;

    // Simulador de Pureza Gini (Etapa 2)
    this.purityDemoActive = false;
    this.purityMixRatio = 0.5;
    this.purityReactorCore = null;
    this.purityOrbitRingA = null;
    this.purityOrbitRingB = null;

    // Animación de Sonda
    this.probeAnim = null;

    // Raycaster
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._pointerDownPos = { x: 0, y: 0 };

    this._bindDesktopPointerEvents();
    window.addEventListener("resize", () => this.onResize());

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._animate());
  }

  _buildHolodeckEnv() {
    // Rejilla radial minimalista en grafito y verde esmeralda sutil
    const polar = new THREE.PolarGridHelper(6.8, 12, 6, 64, 0x27272a, 0x18181b);
    polar.position.y = -1.28;
    polar.material.transparent = true;
    polar.material.opacity = 0.45;
    this.holodeckEnv.add(polar);

    const ringGeo = new THREE.RingGeometry(1.9, 1.93, 96);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10a37f,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.28
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.27;
    this.holodeckEnv.add(ring);

    // Partículas atmosféricas flotantes suaves
    const moteCount = 120;
    const pos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      const r = 2.4 + (i % 8) * 0.6;
      const theta = i * 2.39996;
      const y = -0.95 + ((i * 17) % 100) * 0.032;
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * r;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0xa1a1aa,
      size: 0.024,
      transparent: true,
      opacity: 0.35
    });
    this.ambientMotes = new THREE.Points(moteGeo, moteMat);
    this.holodeckEnv.add(this.ambientMotes);
  }

  /**
   * Construye el Orbe 3D viviente estilo ChatGPT Voice Mode en la parte superior central
   */
  _buildVoiceOrb3D() {
    this.voiceOrbGroup.position.set(0, 1.15, -0.2);

    this.voiceOrbCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 32, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0x10a37f,
        emissive: 0x10a37f,
        emissiveIntensity: 0.65,
        roughness: 0.1,
        metalness: 0.1,
        clearcoat: 1.0
      })
    );
    this.voiceOrbGroup.add(this.voiceOrbCore);

    this.voiceOrbShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.18,
        wireframe: true
      })
    );
    this.voiceOrbGroup.add(this.voiceOrbShell);

    this.voiceOrbHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.004, 12, 48),
      new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.45
      })
    );
    this.voiceOrbGroup.add(this.voiceOrbHalo);
  }

  // =========================================================================
  // CONSOLA ESPACIAL 3D PARA MODO INMERSIVO WEBXR (META QUEST 3)
  // =========================================================================

  _buildXRConsole() {
    this.xrConsoleGroup.position.set(0, 0.94, -0.84);
    this.xrConsoleGroup.rotation.x = -0.34;

    const chassisGeo = new THREE.BoxGeometry(1.16, 0.56, 0.018);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x141417,
      roughness: 0.22,
      metalness: 0.4,
      transparent: true,
      opacity: 0.92
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    this.xrConsoleGroup.add(chassis);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(chassisGeo),
      new THREE.LineBasicMaterial({ color: 0x3f3f46, transparent: true, opacity: 0.8 })
    );
    this.xrConsoleGroup.add(edges);

    this.xrSlateCanvas = document.createElement("canvas");
    this.xrSlateCanvas.width = 1024;
    this.xrSlateCanvas.height = 360;
    this.xrSlateTexture = new THREE.CanvasTexture(this.xrSlateCanvas);
    this.xrSlateTexture.colorSpace = THREE.SRGBColorSpace;

    const slateMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 0.36),
      new THREE.MeshBasicMaterial({ map: this.xrSlateTexture, transparent: true })
    );
    slateMesh.position.set(0, 0.08, 0.012);
    this.xrConsoleGroup.add(slateMesh);

    const btnDefs = [
      { id: "prev", label: "◀ ANT", color: 0x52525b },
      { id: "next", label: "SIG ▶", color: 0x10a37f },
      { id: "audio", label: "🔊 VOZ", color: 0x3b82f6 },
      { id: "probe", label: "🚀 SONDA", color: 0x10a37f },
      { id: "depthDown", label: "PROF -", color: 0xf59e0b },
      { id: "depthUp", label: "PROF +", color: 0xf59e0b },
      { id: "dataset", label: "DATASET", color: 0x8b5cf6 },
      { id: "exit", label: "SALIR XR", color: 0xf43f5e }
    ];

    const startX = -0.47;
    const stepX = 0.134;
    btnDefs.forEach((b, idx) => {
      const x = startX + idx * stepX;
      const y = -0.185;
      const btnMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.122, 0.09, 0.022),
        new THREE.MeshStandardMaterial({
          color: 0x1f1f24,
          emissive: b.color,
          emissiveIntensity: 0.24,
          roughness: 0.25
        })
      );
      btnMesh.position.set(x, y, 0.016);
      btnMesh.userData = { xrButtonId: b.id, baseColor: b.color };

      const btnEdge = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(0.124, 0.092, 0.024)),
        new THREE.LineBasicMaterial({ color: b.color })
      );
      btnMesh.add(btnEdge);

      const c = document.createElement("canvas");
      c.width = 220;
      c.height = 110;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 30px 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, 110, 55);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const labelPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(0.116, 0.068),
        new THREE.MeshBasicMaterial({ map: t, transparent: true })
      );
      labelPlane.position.z = 0.013;
      btnMesh.add(labelPlane);

      this.xrConsoleGroup.add(btnMesh);
      this.xrButtons.push(btnMesh);
    });
  }

  updateXRSlate(info) {
    if (!this.xrSlateCanvas || !this.xrSlateTexture) return;
    const ctx = this.xrSlateCanvas.getContext("2d");
    const w = this.xrSlateCanvas.width;
    const h = this.xrSlateCanvas.height;

    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 4, 4, w - 8, h - 8, 24);
    ctx.fillStyle = "rgba(18, 18, 22, 0.96)";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
    ctx.stroke();

    ctx.fillStyle = info.accent || "#10a37f";
    ctx.font = "600 21px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${info.badge || "CHATGPT SPATIAL ML"}  ·  ETAPA ${info.stageNum}/8`, 30, 40);

    ctx.textAlign = "right";
    ctx.fillStyle = "#34d399";
    ctx.fillText(info.metricsText || "", w - 30, 40);

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 30px 'Inter', sans-serif";
    ctx.fillText(info.title || "", 30, 82);

    ctx.fillStyle = "#d4d4d8";
    ctx.font = "400 22px 'Inter', sans-serif";
    const words = (info.summary || "").split(" ");
    let line = "";
    let y = 126;
    for (const word of words) {
      const testLine = line + word + " ";
      if (ctx.measureText(testLine).width > w - 64 && line) {
        ctx.fillText(line.trim(), 30, y);
        line = word + " ";
        y += 31;
        if (y > 232) break;
      } else {
        line = testLine;
      }
    }
    if (line && y <= 232) ctx.fillText(line.trim(), 30, y);

    roundRect(ctx, 26, 254, w - 52, 84, 14);
    ctx.fillStyle = "rgba(16, 163, 127, 0.12)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(16, 163, 127, 0.38)";
    ctx.stroke();

    ctx.fillStyle = "#34d399";
    ctx.font = "600 20px 'JetBrains Mono', monospace";
    ctx.fillText(info.formula || "", 42, 286);

    ctx.fillStyle = "#e4e4e7";
    ctx.font = "500 18px 'JetBrains Mono', monospace";
    ctx.fillText(info.nodeHint || "Apunta con el láser a cualquier nodo del Árbol o esfera del Cubo", 42, 320);

    this.xrSlateTexture.needsUpdate = true;
  }

  // =========================================================================
  // CONTROLADORES WEBXR & INTERACCIÓN EN META QUEST 3
  // =========================================================================

  _setupXRControllers() {
    const tempMatrix = new THREE.Matrix4();

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      controller.userData.index = i;

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -4.5)
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x10a37f,
        transparent: true,
        opacity: 0.78
      });
      const laser = new THREE.Line(lineGeo, lineMat);
      laser.name = "xrLaser";
      controller.add(laser);

      const gauntlet = new THREE.Mesh(
        new THREE.TorusGeometry(0.03, 0.004, 12, 32),
        new THREE.MeshBasicMaterial({ color: 0x34d399 })
      );
      controller.add(gauntlet);

      const reticle = new THREE.Mesh(
        new THREE.SphereGeometry(0.013, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      reticle.position.z = -1.5;
      controller.add(reticle);
      controller.userData.reticle = reticle;

      controller.addEventListener("selectstart", () => {
        tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        this._handleRaycastClick(true);
      });

      controller.addEventListener("squeezestart", () => {
        this.squeezingControllers.add(controller);
        this.lastSqueezePos.set(controller, controller.position.clone());
      });

      controller.addEventListener("squeezeend", () => {
        this.squeezingControllers.delete(controller);
        this.lastSqueezePos.delete(controller);
      });

      this.scene.add(controller);
      this.xrControllers.push(controller);
    }
  }

  async enterXR(mode = "immersive-ar") {
    if (!navigator.xr) {
      throw new Error("WebXR no está disponible en este navegador.");
    }
    const supported = await navigator.xr.isSessionSupported(mode);
    if (!supported) {
      throw new Error(`El modo ${mode} no es compatible en este dispositivo.`);
    }

    const session = await navigator.xr.requestSession(mode, {
      optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"]
    });
    this.xrMode = mode;
    this.isXR = true;

    session.addEventListener("end", () => {
      this.isXR = false;
      this.xrMode = null;
      this.xrConsoleGroup.visible = false;
      this.holodeckEnv.visible = true;
      this.hologramRoot.position.set(0, 0, 0);
      this.hologramRoot.scale.set(1, 1, 1);
      this.hologramRoot.rotation.set(0, 0, 0);
      this.controls.enabled = true;
      this.callbacks.onXRSessionEnd?.();
    });

    await this.renderer.xr.setSession(session);
    this.controls.enabled = false;
    this.xrConsoleGroup.visible = true;
    this.holodeckEnv.visible = mode !== "immersive-ar";

    this.hologramRoot.position.set(0, 1.38, -1.65);
    this.hologramRoot.scale.set(0.62, 0.62, 0.62);
    this.hologramRoot.rotation.set(0, 0, 0);
  }

  async exitXR() {
    const session = this.renderer.xr.getSession();
    if (session) await session.end();
  }

  // =========================================================================
  // CONSTRUCCIÓN DEL HOLOGRAMA: CÁMARA DE CRISTAL 3D + ÁRBOL ORGÁNICO
  // =========================================================================

  renderModel({
    dataset,
    samples,
    tree,
    forest = null,
    forestMode = false,
    showPlanes = true,
    depthLimit = 6,
    selectedNodeId = null
  }) {
    this.dataset = dataset;
    this.tree = tree;
    this.forestMode = forestMode;
    this.selectedNodeId = selectedNodeId;
    this.interactiveTargets = [];
    this.gimbalRings = [];
    this.scanlinePlanes = [];
    this.animatedNodeGroups = [];
    this.treeBirthTime = this.clock ? this.clock.elapsedTime : 0;

    this._buildDataCube(dataset);
    if (samples) {
      this.updatePoints(samples, dataset);
    }
    if (showPlanes && tree && !forestMode) {
      this._buildSplitPlanes(tree, dataset, depthLimit);
    } else {
      clearGroup(this.planesGroup);
    }

    if (forestMode && forest) {
      this.treeGroup.visible = false;
      this.forestGroup.visible = true;
      this._buildForestGroup(forest, dataset);
    } else {
      this.forestGroup.visible = false;
      this.treeGroup.visible = true;
      if (tree) {
        this._buildTreeGroup(tree, dataset, depthLimit);
      }
    }

    this.highlightSelection(selectedNodeId);
    this._applyLayout();
  }

  _buildDataCube(dataset) {
    if (this._cubeFrameBuiltFor !== dataset.id) {
      this._cubeFrameBuiltFor = dataset.id;
      const keep = [
        this.pointsGroup,
        this.planesGroup,
        this.selectionBoxGroup,
        this.laserGroup,
        this.hoverRulerGroup
      ];
      this.dataCubeGroup.children
        .filter((c) => !keep.includes(c))
        .forEach((c) => {
          this.dataCubeGroup.remove(c);
          disposeObject3D(c);
        });

      const size = 1.48;
      const half = size / 2;
      const boxGeo = new THREE.BoxGeometry(size, size, size);

      // Marco de aristas finas estilo Apple Vision / ChatGPT Spatial
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(boxGeo),
        new THREE.LineBasicMaterial({ color: 0x71717a, transparent: true, opacity: 0.52 })
      );
      this.dataCubeGroup.add(wire);

      // 8 Nodos esféricos metálicos en los vértices del cubo para dar profundidad estereoscópica en Quest 3
      const cornerGeo = new THREE.SphereGeometry(0.018, 12, 12);
      const cornerMat = new THREE.MeshStandardMaterial({
        color: 0xe4e4e7,
        emissive: 0x10a37f,
        emissiveIntensity: 0.35,
        roughness: 0.2,
        metalness: 0.6
      });
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const cMesh = new THREE.Mesh(cornerGeo, cornerMat);
            cMesh.position.set(sx * half, sy * half, sz * half);
            this.dataCubeGroup.add(cMesh);
          }
        }
      }

      // Base de cristal ahumado con rejilla de coordenadas
      const floorGrid = new THREE.GridHelper(size, 6, 0x10a37f, 0x27272a);
      floorGrid.position.y = -half;
      floorGrid.material.transparent = true;
      floorGrid.material.opacity = 0.34;
      this.dataCubeGroup.add(floorGrid);

      const f = dataset.features;
      const xLabel = createTextSprite([`X · ${f[0].label} (${f[0].unit})`], {
        width: 420,
        height: 80,
        borderColor: "#10a37f",
        scaleX: 0.68,
        scaleY: 0.13
      });
      xLabel.position.set(0, -half - 0.14, half + 0.04);
      this.dataCubeGroup.add(xLabel);

      const yLabel = createTextSprite([`Y · ${f[1].label} (${f[1].unit})`], {
        width: 420,
        height: 80,
        borderColor: "#3b82f6",
        scaleX: 0.68,
        scaleY: 0.13
      });
      yLabel.position.set(-half + 0.24, half + 0.12, half + 0.02);
      this.dataCubeGroup.add(yLabel);

      const zLabel = createTextSprite([`Z · ${f[2].label} (${f[2].unit})`], {
        width: 420,
        height: 80,
        borderColor: "#8b5cf6",
        scaleX: 0.68,
        scaleY: 0.13
      });
      zLabel.position.set(half + 0.16, -half - 0.08, 0);
      this.dataCubeGroup.add(zLabel);
    }
  }

  updatePoints(samples, dataset) {
    clearGroup(this.pointsGroup);
    clearGroup(this.hoverRulerGroup);
    this.floatingOrbs = [];

    const half = 0.72;
    const sphereGeo = new THREE.SphereGeometry(0.038, 18, 18);
    const auraGeo = new THREE.SphereGeometry(0.056, 12, 12);
    const noiseRingGeo = new THREE.TorusGeometry(0.064, 0.007, 8, 24);
    const noiseRingMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });

    const classMats = dataset.classes.map(
      (cls) =>
        new THREE.MeshStandardMaterial({
          color: cls.colorHex,
          emissive: cls.colorHex,
          emissiveIntensity: 0.5,
          roughness: 0.16,
          metalness: 0.15
        })
    );
    const noiseMats = dataset.classes.map(
      (cls) =>
        new THREE.MeshStandardMaterial({
          color: cls.colorHex,
          emissive: cls.colorHex,
          emissiveIntensity: 0.95,
          roughness: 0.14,
          metalness: 0.2
        })
    );
    const auraMats = dataset.classes.map(
      (cls) =>
        new THREE.MeshBasicMaterial({
          color: cls.colorHex,
          transparent: true,
          opacity: 0.16,
          depthWrite: false
        })
    );

    samples.forEach((s, idx) => {
      const mat = s.isNoise ? noiseMats[s.label] : classMats[s.label];

      const mesh = new THREE.Mesh(sphereGeo, mat);
      const basePos = new THREE.Vector3(s.norm[0] * half, s.norm[1] * half, s.norm[2] * half);
      mesh.position.copy(basePos);
      mesh.userData = { type: "sample", sample: s, basePos };

      // Halo exterior translúcido para volumen óptico en Quest 3
      const aura = new THREE.Mesh(auraGeo, auraMats[s.label]);
      mesh.add(aura);

      if (s.isNoise) {
        const ring = new THREE.Mesh(noiseRingGeo, noiseRingMat);
        ring.rotation.x = Math.PI / 3;
        mesh.add(ring);
        this.gimbalRings.push({ mesh: ring, speedX: 1.8, speedY: 2.4 });
      }

      this.pointsGroup.add(mesh);
      this.interactiveTargets.push(mesh);
      this.floatingOrbs.push({ mesh, basePos, phase: idx * 0.55 });
    });
  }

  /**
   * Proyecta 3 reglas punteadas (X, Y, Z) desde la esfera seleccionada/apuntada hacia las paredes del cubo
   */
  _drawSampleRulers(sample) {
    clearGroup(this.hoverRulerGroup);
    if (!sample) return;
    const half = 0.72;
    const boxHalf = 0.74;
    const px = sample.norm[0] * half;
    const py = sample.norm[1] * half;
    const pz = sample.norm[2] * half;
    const origin = new THREE.Vector3(px, py, pz);

    const targets = [
      { to: new THREE.Vector3(px, -boxHalf, pz), color: 0x3b82f6 },
      { to: new THREE.Vector3(-boxHalf, py, pz), color: 0x10a37f },
      { to: new THREE.Vector3(px, py, -boxHalf), color: 0x8b5cf6 }
    ];

    targets.forEach(({ to, color }) => {
      const geo = new THREE.BufferGeometry().setFromPoints([origin, to]);
      const line = new THREE.Line(
        geo,
        new THREE.LineDashedMaterial({
          color,
          dashSize: 0.04,
          gapSize: 0.025,
          transparent: true,
          opacity: 0.85
        })
      );
      line.computeLineDistances();
      this.hoverRulerGroup.add(line);

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.015, 10, 10),
        new THREE.MeshBasicMaterial({ color })
      );
      dot.position.copy(to);
      this.hoverRulerGroup.add(dot);
    });
  }

  _buildSplitPlanes(tree, dataset, depthLimit) {
    clearGroup(this.planesGroup);
    const half = 0.73;

    tree.nodes.forEach((node) => {
      if (node.isLeaf || node.depth >= depthLimit) return;

      const fIdx = node.featureIdx;
      const b = node.normBounds;
      const wX = Math.max(0.04, ((b[0].max - b[0].min) / 2) * (half * 2));
      const wY = Math.max(0.04, ((b[1].max - b[1].min) / 2) * (half * 2));
      const wZ = Math.max(0.04, ((b[2].max - b[2].min) / 2) * (half * 2));

      const cx = ((b[0].min + b[0].max) / 2) * half;
      const cy = ((b[1].min + b[1].max) / 2) * half;
      const cz = ((b[2].min + b[2].max) / 2) * half;

      const depthColors = [0x10a37f, 0x3b82f6, 0xf59e0b, 0x8b5cf6, 0xf43f5e, 0x06b6d4];
      const color = depthColors[node.depth % depthColors.length];

      let planeGeo;
      const pos = new THREE.Vector3(cx, cy, cz);
      const rot = new THREE.Euler(0, 0, 0);

      if (fIdx === 0) {
        planeGeo = new THREE.PlaneGeometry(wZ, wY);
        pos.x = node.normThreshold * half;
        rot.y = Math.PI / 2;
      } else if (fIdx === 1) {
        planeGeo = new THREE.PlaneGeometry(wX, wZ);
        pos.y = node.normThreshold * half;
        rot.x = Math.PI / 2;
      } else {
        planeGeo = new THREE.PlaneGeometry(wX, wY);
        pos.z = node.normThreshold * half;
      }

      const baseOpacity = Math.max(0.1, 0.22 - node.depth * 0.028);
      const planeMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: baseOpacity,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.position.copy(pos);
      planeMesh.rotation.copy(rot);
      planeMesh.userData = { nodeId: node.id };

      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(planeGeo),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78 })
      );
      planeMesh.add(border);

      this.planesGroup.add(planeMesh);
      this.scanlinePlanes.push({ mesh: planeMesh, baseOpacity, depth: node.depth });
    });
  }

  _computeTreePositions(tree, depthLimit) {
    const positions = new Map();
    const visibleLeaves = [];

    function collectVisible(node) {
      if (!node) return;
      if (node.isLeaf || node.depth >= depthLimit) {
        visibleLeaves.push(node);
        return;
      }
      collectVisible(node.left);
      collectVisible(node.right);
    }
    collectVisible(tree.root);

    const totalLeafSlots = Math.max(1, visibleLeaves.length);
    const widthSpan = Math.min(1.65, Math.max(0.92, totalLeafSlots * 0.28));
    const maxDepthVis = Math.max(1, Math.min(depthLimit, tree.maxActualDepth));
    const levelHeight = Math.min(0.44, 1.42 / maxDepthVis);
    const topY = 0.92;

    let leafIdx = 0;
    function assignPos(node) {
      if (!node) return null;
      const y = topY - node.depth * levelHeight;
      if (node.isLeaf || node.depth >= depthLimit) {
        const t = totalLeafSlots === 1 ? 0.5 : leafIdx / (totalLeafSlots - 1);
        const x = (t - 0.5) * widthSpan;
        const z = Math.sin(t * Math.PI) * 0.16;
        leafIdx++;
        const vec = new THREE.Vector3(x, y, z);
        positions.set(node.id, vec);
        return vec;
      }
      const pL = assignPos(node.left);
      const pR = assignPos(node.right);
      const x = (pL.x + pR.x) / 2;
      const z = (pL.z + pR.z) / 2 + 0.04;
      const vec = new THREE.Vector3(x, y, z);
      positions.set(node.id, vec);
      return vec;
    }

    assignPos(tree.root);
    return positions;
  }

  _buildTreeGroup(tree, dataset, depthLimit) {
    clearGroup(this.treeNodesGroup);
    clearGroup(this.treeBranchesGroup);
    this.nodeMeshes.clear();
    this.branchPackets = [];
    this.animatedNodeGroups = [];

    this.nodePositions = this._computeTreePositions(tree, depthLimit);

    // Mapa de padres para animar el crecimiento desde la posición del nodo padre
    const parentPosMap = new Map();
    tree.nodes.forEach((n) => {
      const p = this.nodePositions.get(n.id);
      if (!p) return;
      if (n.left) parentPosMap.set(n.left.id, p);
      if (n.right) parentPosMap.set(n.right.id, p);
    });

    const visibleNodes = tree.nodes.filter((n) => n.depth <= depthLimit);
    const compact = visibleNodes.length > 15;

    visibleNodes.forEach((node) => {
      const pos = this.nodePositions.get(node.id);
      if (!pos) return;
      const startPos = parentPosMap.get(node.id) || pos;
      const treatAsLeaf = node.isLeaf || node.depth >= depthLimit;
      const majCls = dataset.classes[node.majorityClass];

      const nodeRoot = new THREE.Group();
      nodeRoot.position.copy(startPos);

      const radius = node.depth === 0 ? 0.112 : treatAsLeaf ? (compact ? 0.062 : 0.08) : compact ? 0.068 : 0.086;
      const coreGeo = treatAsLeaf
        ? new THREE.OctahedronGeometry(radius, 0)
        : new THREE.SphereGeometry(radius, 20, 20);

      const coreColor = treatAsLeaf ? majCls.colorHex : 0x3b82f6;
      const coreMat = new THREE.MeshStandardMaterial({
        color: coreColor,
        emissive: coreColor,
        emissiveIntensity: treatAsLeaf ? 0.68 : 0.45,
        roughness: 0.16,
        metalness: 0.2
      });

      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.userData = { type: "node", nodeId: node.id, node };
      nodeRoot.add(coreMesh);
      this.nodeMeshes.set(node.id, coreMesh);
      this.interactiveTargets.push(coreMesh);

      // Anillos giroscópicos orbitales en nodos de decisión (giran más rápido si hay mayor impureza Gini)
      if (!treatAsLeaf) {
        const gimbalGeo = new THREE.TorusGeometry(radius * 1.24, 0.0045, 8, 36);
        const gimbalMat = new THREE.MeshBasicMaterial({
          color: 0x93c5fd,
          transparent: true,
          opacity: 0.48
        });
        const gRing = new THREE.Mesh(gimbalGeo, gimbalMat);
        gRing.rotation.x = Math.PI / 3;
        nodeRoot.add(gRing);
        this.gimbalRings.push({
          mesh: gRing,
          speedX: 0.5 + node.gini * 2.2,
          speedY: 0.8 + node.gini * 2.5
        });
      }

      // Anillo de Pureza 3D proporcional alrededor del nodo
      let startAngle = 0;
      const ringRadius = radius * 1.52;
      dataset.classes.forEach((cls, cIdx) => {
        const frac = node.n > 0 ? node.counts[cIdx] / node.n : 0;
        if (frac <= 0.01) return;
        const arc = frac * Math.PI * 2;
        const arcGeo = new THREE.TorusGeometry(ringRadius, 0.012, 10, Math.max(10, Math.round(frac * 36)), arc * 0.94);
        const arcMat = new THREE.MeshBasicMaterial({ color: cls.colorHex });
        const arcMesh = new THREE.Mesh(arcGeo, arcMat);
        arcMesh.rotation.z = startAngle;
        nodeRoot.add(arcMesh);
        startAngle += arc;
      });

      // Píldora flotante de datos estilo ChatGPT
      if (!compact || node.depth <= 2 || node.id === this.selectedNodeId) {
        const feat = !treatAsLeaf ? dataset.features[node.featureIdx] : null;
        const line1 = treatAsLeaf
          ? `${majCls.name} (${Math.round(node.confidence * 100)}%)`
          : `${feat.short} ≤ ${node.threshold}${feat.unit}`;
        const line2 = `Gini ${node.gini.toFixed(2)} · N=${node.n}`;

        const label = createTextSprite([line1, line2], {
          width: 340,
          height: 104,
          borderColor: treatAsLeaf ? majCls.cssColor : "#3b82f6",
          scaleX: compact ? 0.38 : 0.48,
          scaleY: compact ? 0.116 : 0.146
        });
        label.position.set(0, radius + (compact ? 0.105 : 0.135), 0.04);
        nodeRoot.add(label);
      }

      this.treeNodesGroup.add(nodeRoot);
      this.animatedNodeGroups.push({
        group: nodeRoot,
        startPos: startPos.clone(),
        targetPos: pos.clone(),
        depth: node.depth
      });

      // Ramas arquitectónicas Cubic-Bézier hacia los hijos
      if (!treatAsLeaf && node.left && node.right) {
        [
          { child: node.left, isLeft: true, color: 0x10b981 },
          { child: node.right, isLeft: false, color: 0xf43f5e }
        ].forEach(({ child, isLeft, color }) => {
          const childPos = this.nodePositions.get(child.id);
          if (!childPos) return;
          const dy = Math.abs(pos.y - childPos.y);
          const c1 = new THREE.Vector3(pos.x, pos.y - dy * 0.45, pos.z + 0.04);
          const c2 = new THREE.Vector3(childPos.x, childPos.y + dy * 0.45, childPos.z + 0.04);
          const curve = new THREE.CubicBezierCurve3(pos.clone(), c1, c2, childPos.clone());

          const tubeGeo = new THREE.TubeGeometry(curve, 18, compact ? 0.0075 : 0.0105, 8, false);
          const tubeMat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.35,
            transparent: true,
            opacity: 0.72,
            roughness: 0.22
          });
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          this.treeBranchesGroup.add(tube);

          // 2 Pulsos sinápticos desfasados por cada rama para flujo continuo
          for (let pIdx = 0; pIdx < 2; pIdx++) {
            const packet = new THREE.Mesh(
              new THREE.SphereGeometry(compact ? 0.013 : 0.017, 10, 10),
              new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            this.treeBranchesGroup.add(packet);
            this.branchPackets.push({
              mesh: packet,
              curve,
              offset: (pIdx * 0.5 + Math.random() * 0.2) % 1,
              speed: 0.34 + (node.depth % 3) * 0.06
            });
          }

          if (node.depth <= 1) {
            const tag = createTextSprite([isLeft ? "SÍ ≤" : "NO >"], {
              width: 140,
              height: 54,
              borderColor: isLeft ? "#10b981" : "#f43f5e",
              scaleX: 0.14,
              scaleY: 0.055
            });
            tag.position.copy(curve.getPoint(0.44));
            tag.position.z += 0.04;
            this.treeBranchesGroup.add(tag);
          }
        });
      }
    });
  }

  _buildForestGroup(forest, dataset) {
    clearGroup(this.forestGroup);
    const numTrees = forest.length;
    const radius = 0.74;

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.15, 3),
      new THREE.MeshPhysicalMaterial({
        color: 0x10a37f,
        emissive: 0x10a37f,
        emissiveIntensity: 0.65,
        roughness: 0.15,
        clearcoat: 1.0
      })
    );
    core.position.set(0, -0.35, 0.2);
    this.forestGroup.add(core);

    const coreRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.006, 10, 48),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.6 })
    );
    coreRing.position.copy(core.position);
    this.forestGroup.add(coreRing);
    this.gimbalRings.push({ mesh: coreRing, speedX: 1.1, speedY: 1.4 });

    const coreLabel = createTextSprite(["CONSENSO DEL BOSQUE", `${numTrees} Árboles en Paralelo`], {
      width: 360,
      height: 98,
      borderColor: "#10a37f",
      scaleX: 0.44,
      scaleY: 0.12
    });
    coreLabel.position.set(0, -0.62, 0.24);
    this.forestGroup.add(coreLabel);

    forest.forEach((t, idx) => {
      const angle = ((idx / (numTrees - 1)) - 0.5) * Math.PI * 0.92;
      const tx = Math.sin(angle) * radius;
      const tz = Math.cos(angle) * 0.42 - 0.22;
      const ty = 0.28;

      const miniTree = new THREE.Group();
      miniTree.position.set(tx, ty, tz);
      miniTree.scale.set(0.32, 0.32, 0.32);

      const posMap = this._computeTreePositions(t, 2);
      t.nodes.filter((n) => n.depth <= 2).forEach((n) => {
        const p = posMap.get(n.id);
        if (!p) return;
        const cHex = n.isLeaf ? dataset.classes[n.majorityClass].colorHex : 0x3b82f6;
        const orb = new THREE.Mesh(
          new THREE.SphereGeometry(n.depth === 0 ? 0.12 : 0.085, 16, 16),
          new THREE.MeshStandardMaterial({ color: cHex, emissive: cHex, emissiveIntensity: 0.65 })
        );
        orb.position.copy(p);
        miniTree.add(orb);

        if (!n.isLeaf && n.depth < 2) {
          [n.left, n.right].forEach((ch, ci) => {
            const cp = posMap.get(ch.id);
            if (!cp) return;
            const lg = new THREE.BufferGeometry().setFromPoints([p, cp]);
            const lm = new THREE.LineBasicMaterial({ color: ci === 0 ? 0x10b981 : 0xf43f5e });
            miniTree.add(new THREE.Line(lg, lm));
          });
        }
      });

      const title = createTextSprite([`Árbol #${idx + 1}`, `Nodos: ${t.nodeCount}`], {
        width: 240,
        height: 82,
        borderColor: "#10a37f",
        scaleX: 0.72,
        scaleY: 0.24
      });
      title.position.set(0, 1.12, 0);
      miniTree.add(title);

      const beamGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(tx, ty - 0.1, tz),
        new THREE.Vector3(0, -0.35, 0.2)
      ]);
      const beam = new THREE.Line(
        beamGeo,
        new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.52 })
      );
      this.forestGroup.add(beam);
      this.forestGroup.add(miniTree);
    });
  }

  // =========================================================================
  // RESALTADO DE REGIÓN 3D + VÍNCULO ÁRBOL ↔ CUBO
  // =========================================================================

  highlightSelection(nodeId) {
    this.selectedNodeId = nodeId;
    clearGroup(this.selectionBoxGroup);
    clearGroup(this.tetherGroup);

    if (!this.tree || !nodeId) return;
    const node = this.tree.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    this.nodeMeshes.forEach((mesh, id) => {
      const active = id === nodeId;
      mesh.scale.setScalar(active ? 1.38 : 1.0);
    });

    const half = 0.73;
    const b = node.normBounds;
    const sx = Math.max(0.05, ((b[0].max - b[0].min) / 2) * (half * 2));
    const sy = Math.max(0.05, ((b[1].max - b[1].min) / 2) * (half * 2));
    const sz = Math.max(0.05, ((b[2].max - b[2].min) / 2) * (half * 2));

    const cx = ((b[0].min + b[0].max) / 2) * half;
    const cy = ((b[1].min + b[1].max) / 2) * half;
    const cz = ((b[2].min + b[2].max) / 2) * half;

    const boxGeo = new THREE.BoxGeometry(sx, sy, sz);
    const boxWire = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.95 })
    );
    boxWire.position.set(cx, cy, cz);

    const boxFill = new THREE.Mesh(
      boxGeo,
      new THREE.MeshBasicMaterial({
        color: 0x10a37f,
        transparent: true,
        opacity: 0.08,
        depthWrite: false
      })
    );
    boxFill.position.set(cx, cy, cz);
    this.selectionBoxGroup.add(boxWire, boxFill);

    if (this.layoutMode === "dual" && this.treeGroup.visible) {
      const nodeLocalPos = this.nodePositions.get(nodeId);
      if (nodeLocalPos) {
        const pCube = new THREE.Vector3(cx, cy, cz).add(this.cubeGoalPos);
        const pTree = nodeLocalPos.clone().add(this.treeGoalPos);
        const mid = pCube.clone().lerp(pTree, 0.5);
        mid.y += 0.42;
        mid.z += 0.25;
        const curve = new THREE.QuadraticBezierCurve3(pCube, mid, pTree);
        const pts = curve.getPoints(32);
        const tether = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineDashedMaterial({
            color: 0x34d399,
            dashSize: 0.07,
            gapSize: 0.035,
            transparent: true,
            opacity: 0.8
          })
        );
        tether.computeLineDistances();
        this.tetherGroup.add(tether);
      }
    }
  }

  // =========================================================================
  // ESCÁNER LÁSER CART 3D (ETAPA 3 & SANDBOX)
  // =========================================================================

  setLaserSweep(active, axisIdx = 0, candidates = [], best = null, manualNorm = null) {
    this.laserSweepActive = active;
    this.laserAxis = axisIdx;
    this.laserCandidates = candidates;
    this.laserBest = best;
    this.laserManualNorm = manualNorm;

    clearGroup(this.laserGroup);
    if (!active || !this.dataset) return;

    const geo = new THREE.PlaneGeometry(1.54, 1.54);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x10a37f,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.laserMesh = new THREE.Mesh(geo, mat);
    const border = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x34d399 })
    );
    this.laserMesh.add(border);

    if (axisIdx === 0) this.laserMesh.rotation.y = Math.PI / 2;
    else if (axisIdx === 1) this.laserMesh.rotation.x = Math.PI / 2;

    this.laserGroup.add(this.laserMesh);
  }

  // =========================================================================
  // SIMULADOR VISUAL DE PUREZA GINI (ETAPA 2)
  // =========================================================================

  setPurityDemo(active, mixRatio = 0.5) {
    this.purityDemoActive = active;
    this.purityMixRatio = mixRatio;
    clearGroup(this.purityReactorGroup);
    this._applyLayout();
    if (!active) return;

    const grp = new THREE.Group();
    grp.position.set(0, 0.25, 0);

    const gini = 1 - (mixRatio * mixRatio + (1 - mixRatio) * (1 - mixRatio));
    const coreColor = gini > 0.35 ? 0x8b5cf6 : gini > 0.12 ? 0x3b82f6 : 0x10a37f;

    this.purityReactorCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 3),
      new THREE.MeshPhysicalMaterial({
        color: coreColor,
        emissive: coreColor,
        emissiveIntensity: 0.65,
        roughness: 0.15,
        clearcoat: 1.0,
        wireframe: gini > 0.35
      })
    );
    grp.add(this.purityReactorCore);

    this.purityOrbitRingA = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.018, 14, 52, Math.max(0.08, mixRatio * Math.PI * 2)),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    grp.add(this.purityOrbitRingA);

    this.purityOrbitRingB = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.018, 14, 52, Math.max(0.08, (1 - mixRatio) * Math.PI * 2)),
      new THREE.MeshBasicMaterial({ color: 0xf43f5e })
    );
    this.purityOrbitRingB.rotation.z = mixRatio * Math.PI * 2;
    grp.add(this.purityOrbitRingB);

    const lbl = createTextSprite(
      [
        `Gini = ${gini.toFixed(3)}`,
        `${Math.round(mixRatio * 100)}% Esmeralda · ${Math.round((1 - mixRatio) * 100)}% Coral`
      ],
      {
        width: 420,
        height: 108,
        borderColor: gini > 0.35 ? "#8b5cf6" : "#10a37f",
        scaleX: 0.64,
        scaleY: 0.165
      }
    );
    lbl.position.set(0, 0.64, 0);
    grp.add(lbl);

    this.purityReactorGroup.add(grp);
    this._applyLayout();
  }

  // =========================================================================
  // ANIMACIÓN DE SONDA DE INFERENCIA EN VIVO (ETAPA 5 & SANDBOX)
  // =========================================================================

  launchProbe(probeValues, predictionResult, onStepCallback) {
    this.stopProbeAnim();
    clearGroup(this.probeGroup);
    if (!this.dataset || !predictionResult) return;

    const norm = probeValues.map((v, idx) =>
      normalizeValue(v, this.dataset.features[idx].min, this.dataset.features[idx].max)
    );
    const half = 0.72;
    const cubePos = new THREE.Vector3(norm[0] * half, norm[1] * half, norm[2] * half);

    const cubeBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.056, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    cubeBeacon.position.copy(cubePos);
    const cubeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.098, 0.011, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0x34d399 })
    );
    cubeBeacon.add(cubeRing);
    this.dataCubeGroup.add(cubeBeacon);

    const treeProbe = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 24, 24),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0x10a37f,
        emissiveIntensity: 1.0,
        clearcoat: 1.0
      })
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.112, 0.011, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0x34d399 })
    );
    treeProbe.add(halo);
    this.treeGroup.add(treeProbe);

    const pathIds = predictionResult.pathNodeIds;
    const waypoints = pathIds.map((id) => this.nodePositions.get(id)).filter(Boolean);

    if (waypoints.length === 0) {
      this.dataCubeGroup.remove(cubeBeacon);
      this.treeGroup.remove(treeProbe);
      return;
    }

    treeProbe.position.copy(waypoints[0]);

    this.probeAnim = {
      treeProbe,
      cubeBeacon,
      cubeRing,
      waypoints,
      pathIds,
      trace: predictionResult.trace,
      prediction: predictionResult.prediction,
      confidence: predictionResult.confidence,
      segIdx: 0,
      segT: 0,
      pauseTimer: 0.24,
      done: false,
      onStepCallback,
      lastNotifiedStep: -1
    };
  }

  stopProbeAnim() {
    if (this.probeAnim) {
      this.dataCubeGroup.remove(this.probeAnim.cubeBeacon);
      this.treeGroup.remove(this.probeAnim.treeProbe);
      disposeObject3D(this.probeAnim.cubeBeacon);
      disposeObject3D(this.probeAnim.treeProbe);
      this.probeAnim = null;
    }
  }

  // =========================================================================
  // CONTROL DE DISEÑO Y PRESETS DE CÁMARA FLUIDOS
  // =========================================================================

  setLayoutMode(mode) {
    this.layoutMode = mode;
    this._applyLayout();
  }

  _applyLayout() {
    if (this.layoutMode === "dual") {
      this.dataCubeGroup.visible = true;
      this.treeGroup.visible = !this.forestMode && !this.purityDemoActive;
      this.forestGroup.visible = this.forestMode && !this.purityDemoActive;
      this.purityReactorGroup.visible = this.purityDemoActive;
      this.cubeGoalPos.set(-1.02, 0.14, 0);
      this.treeGoalPos.set(1.02, 0.1, 0);
      this.forestGroup.position.set(1.02, 0.14, 0);
      this.purityReactorGroup.position.set(1.02, 0.1, 0);
    } else if (this.layoutMode === "cube") {
      this.dataCubeGroup.visible = true;
      this.treeGroup.visible = false;
      this.forestGroup.visible = false;
      this.purityReactorGroup.visible = false;
      this.cubeGoalPos.set(0, 0.08, 0);
    } else if (this.layoutMode === "tree") {
      this.dataCubeGroup.visible = false;
      this.treeGroup.visible = !this.forestMode && !this.purityDemoActive;
      this.forestGroup.visible = this.forestMode && !this.purityDemoActive;
      this.purityReactorGroup.visible = this.purityDemoActive;
      this.treeGoalPos.set(0, 0.06, 0);
      this.forestGroup.position.set(0, 0.08, 0);
      this.purityReactorGroup.position.set(0, 0.06, 0);
    }
    this.highlightSelection(this.selectedNodeId);
  }

  setCameraPreset(preset = "general") {
    if (this.isXR) return;
    if (preset === "general") {
      this.cameraGoalPos = new THREE.Vector3(0, 0.35, 5.15);
      this.targetGoalPos = new THREE.Vector3(0, -0.12, 0);
    } else if (preset === "closeup_cube") {
      const cx = this.layoutMode === "dual" ? -1.02 : 0;
      this.cameraGoalPos = new THREE.Vector3(cx + 0.35, 0.45, 3.25);
      this.targetGoalPos = new THREE.Vector3(cx, 0.1, 0);
    } else if (preset === "closeup_tree") {
      const tx = this.layoutMode === "dual" ? 1.02 : 0;
      this.cameraGoalPos = new THREE.Vector3(tx, 0.25, 3.35);
      this.targetGoalPos = new THREE.Vector3(tx, 0.05, 0);
    } else if (preset === "isometric") {
      this.cameraGoalPos = new THREE.Vector3(2.25, 1.55, 4.45);
      this.targetGoalPos = new THREE.Vector3(0, -0.05, 0);
    } else if (preset === "top_down") {
      this.cameraGoalPos = new THREE.Vector3(0, 3.9, 1.65);
      this.targetGoalPos = new THREE.Vector3(0, -0.05, 0);
    }
  }

  setAutoRotate(val) {
    this.autoRotate = val;
  }

  resetCamera() {
    this.hologramRoot.rotation.set(0, 0, 0);
    this.setCameraPreset("general");
  }

  // =========================================================================
  // RAYCASTING DESKTOP + QUEST (CON HOVER INTERACTIVO Y REGLAS 3D)
  // =========================================================================

  _bindDesktopPointerEvents() {
    this.canvas.addEventListener("pointerdown", (e) => {
      this._pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    this.canvas.addEventListener("pointermove", (e) => {
      if (this.isXR) return;
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);

      const hits = this.raycaster.intersectObjects(this.interactiveTargets, false);
      if (hits.length > 0) {
        const hitObj = hits[0].object;
        if (this.hoveredObject !== hitObj) {
          this.hoveredObject = hitObj;
          this.canvas.style.cursor = "pointer";
          if (hitObj.userData.type === "sample") {
            this._drawSampleRulers(hitObj.userData.sample);
          } else {
            clearGroup(this.hoverRulerGroup);
          }
        }
        this.callbacks.onHoverObject?.(hitObj.userData, e.clientX, e.clientY);
      } else if (this.hoveredObject) {
        this.hoveredObject = null;
        this.canvas.style.cursor = "grab";
        clearGroup(this.hoverRulerGroup);
        this.callbacks.onHoverObject?.(null, 0, 0);
      }
    });

    this.canvas.addEventListener("pointerup", (e) => {
      const dx = e.clientX - this._pointerDownPos.x;
      const dy = e.clientY - this._pointerDownPos.y;
      if (Math.hypot(dx, dy) > 8) return;

      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      this._handleRaycastClick(false);
    });
  }

  _handleRaycastClick(isXRClick) {
    if (isXRClick) {
      const btnHits = this.raycaster.intersectObjects(this.xrButtons, false);
      if (btnHits.length > 0) {
        const btnId = btnHits[0].object.userData.xrButtonId;
        this.callbacks.onXRButtonClick?.(btnId);
        return;
      }
    }

    const hits = this.raycaster.intersectObjects(this.interactiveTargets, false);
    if (hits.length > 0) {
      const data = hits[0].object.userData;
      if (data.type === "node") {
        this.highlightSelection(data.nodeId);
        this.callbacks.onNodeSelected?.(data.node);
      } else if (data.type === "sample") {
        this._drawSampleRulers(data.sample);
        this.callbacks.onSampleSelected?.(data.sample);
      }
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  setVoiceEnergy(energy) {
    this.voiceEnergy = energy;
  }

  // =========================================================================
  // BUCLE DE ANIMACIÓN 60–90 FPS (FÍSICA AMORTIGUADA Y DETALLES QUEST 3)
  // =========================================================================

  _animate() {
    const dt = Math.min(0.15, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;
    const damp = 1 - Math.exp(-6.5 * dt);

    // Transiciones suaves de posición para el Cubo y el Árbol
    this.dataCubeGroup.position.lerp(this.cubeGoalPos, damp);
    this.treeGroup.position.lerp(this.treeGoalPos, damp);

    // Crecimiento orgánico de los nodos del árbol al reconstruirse
    const sinceBirth = elapsed - this.treeBirthTime;
    if (sinceBirth < 1.5) {
      for (const item of this.animatedNodeGroups) {
        const delay = item.depth * 0.09;
        const rawT = Math.max(0, Math.min(1, (sinceBirth - delay) / 0.45));
        const eased = easeOutBack(rawT);
        item.group.position.lerpVectors(item.startPos, item.targetPos, Math.min(1, rawT * 1.15));
        item.group.scale.setScalar(Math.max(0.01, eased));
      }
    }

    if (!this.isXR) {
      if (this.cameraGoalPos && this.targetGoalPos) {
        this.camera.position.lerp(this.cameraGoalPos, damp);
        this.controls.target.lerp(this.targetGoalPos, damp);
        if (
          this.camera.position.distanceTo(this.cameraGoalPos) < 0.015 &&
          this.controls.target.distanceTo(this.targetGoalPos) < 0.015
        ) {
          this.cameraGoalPos = null;
          this.targetGoalPos = null;
        }
      }
      this.controls.update();
    } else {
      const tempMatrix = new THREE.Matrix4();
      let hoveredBtn = null;
      this.xrControllers.forEach((ctrl) => {
        tempMatrix.identity().extractRotation(ctrl.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        const btnHits = this.raycaster.intersectObjects(this.xrButtons, false);
        if (btnHits.length > 0) {
          hoveredBtn = btnHits[0].object;
          ctrl.userData.reticle.position.z = -btnHits[0].distance;
        } else {
          const objHits = this.raycaster.intersectObjects(this.interactiveTargets, false);
          if (objHits.length > 0) {
            ctrl.userData.reticle.position.z = -objHits[0].distance;
            const d = objHits[0].object.userData;
            if (d.type === "sample") this._drawSampleRulers(d.sample);
          } else {
            ctrl.userData.reticle.position.z = -1.5;
          }
        }

        if (this.squeezingControllers.has(ctrl)) {
          const prev = this.lastSqueezePos.get(ctrl);
          if (prev) {
            const deltaX = ctrl.position.x - prev.x;
            const deltaY = ctrl.position.y - prev.y;
            this.hologramRoot.rotation.y += deltaX * 2.6;
            this.hologramRoot.position.y = Math.max(0.85, Math.min(2.0, this.hologramRoot.position.y + deltaY * 0.9));
            prev.copy(ctrl.position);
          }
        }
      });

      this.xrButtons.forEach((b) => {
        b.material.emissiveIntensity = b === hoveredBtn ? 0.78 : 0.24;
        b.scale.setScalar(b === hoveredBtn ? 1.08 : 1.0);
      });
    }

    if (this.autoRotate) {
      this.hologramRoot.rotation.y += dt * 0.22;
    }

    if (this.ambientMotes) {
      this.ambientMotes.rotation.y = elapsed * 0.025;
    }

    // Levitación orgánica sutil de las esferas de datos
    for (const orb of this.floatingOrbs) {
      const isHovered = this.hoveredObject === orb.mesh;
      orb.mesh.position.y = orb.basePos.y + Math.sin(elapsed * 2.1 + orb.phase) * 0.008;
      const targetScale = isHovered ? 1.35 : 1.0;
      orb.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.18);
    }

    // Rotación de anillos giroscópicos en nodos y marcadores de ruido
    for (const g of this.gimbalRings) {
      g.mesh.rotation.x += dt * g.speedX;
      g.mesh.rotation.y += dt * g.speedY;
    }

    // Pulso respiratorio en los planos de corte CART
    for (const sp of this.scanlinePlanes) {
      sp.mesh.material.opacity = sp.baseOpacity + Math.sin(elapsed * 2.4 + sp.depth) * 0.035;
    }

    // Flujo de paquetes sinápticos en las ramas Cubic-Bézier
    for (const pkt of this.branchPackets) {
      pkt.offset = (pkt.offset + dt * pkt.speed) % 1;
      pkt.mesh.position.copy(pkt.curve.getPoint(pkt.offset));
    }

    // Animación del Orbe 3D de Voz estilo ChatGPT Voice Mode
    if (this.voiceOrbCore) {
      const e = this.voiceEnergy;
      const pulse = 1 + e * 0.42 + Math.sin(elapsed * 3.2) * 0.04;
      this.voiceOrbCore.scale.setScalar(pulse);
      this.voiceOrbCore.material.emissiveIntensity = 0.55 + e * 0.9;
      this.voiceOrbShell.scale.setScalar(1 + e * 0.65);
      this.voiceOrbShell.rotation.y += dt * (0.6 + e * 3.0);
      this.voiceOrbShell.rotation.x += dt * 0.4;
      this.voiceOrbHalo.rotation.x = Math.sin(elapsed * 1.8) * 0.65;
      this.voiceOrbHalo.rotation.y += dt * 1.1;
    }

    // Animación de Pureza Gini (Etapa 2)
    if (this.purityDemoActive && this.purityReactorCore) {
      const chaos = 1 - Math.abs(this.purityMixRatio - 0.5) * 2;
      this.purityReactorCore.rotation.y += dt * (0.6 + chaos * 2.4);
      this.purityReactorCore.rotation.x += dt * (0.4 + chaos * 1.6);
      this.purityOrbitRingA.rotation.x = Math.sin(elapsed * 1.5) * 0.35;
      this.purityOrbitRingB.rotation.x = Math.sin(elapsed * 1.5) * 0.35;
    }

    // Animación del Escáner Láser CART (Etapa 3)
    if (this.laserSweepActive && this.laserMesh && this.dataset) {
      const half = 0.72;
      let normPos = 0;
      if (this.laserManualNorm !== null) {
        normPos = this.laserManualNorm;
      } else {
        this.laserPhase = (this.laserPhase + dt * 0.26) % 1;
        const feat = this.dataset.features[this.laserAxis];
        const bestNorm = this.laserBest
          ? normalizeValue(this.laserBest.threshold, feat.min, feat.max)
          : 0;
        if (this.laserPhase < 0.72) {
          normPos = -0.92 + (this.laserPhase / 0.72) * 1.84;
        } else {
          normPos = bestNorm;
        }
      }

      if (this.laserAxis === 0) this.laserMesh.position.set(normPos * half, 0, 0);
      else if (this.laserAxis === 1) this.laserMesh.position.set(0, normPos * half, 0);
      else this.laserMesh.position.set(0, 0, normPos * half);

      this.callbacks.onLaserScanTick?.(normPos);
    }

    // Animación de Sonda viajando por el Árbol (Etapa 5)
    if (this.probeAnim && !this.probeAnim.done) {
      const p = this.probeAnim;
      if (p.lastNotifiedStep !== p.segIdx) {
        p.lastNotifiedStep = p.segIdx;
        p.onStepCallback?.(p.segIdx, p.trace[p.segIdx] || null, p.segIdx >= p.waypoints.length - 1);
      }

      if (p.segIdx >= p.waypoints.length - 1) {
        p.done = true;
        const winCls = this.dataset.classes[p.prediction];
        p.treeProbe.material.emissive.setHex(winCls.colorHex);
        p.cubeBeacon.material.color.setHex(winCls.colorHex);
      } else if (p.pauseTimer > 0) {
        p.pauseTimer -= dt;
        p.cubeRing.rotation.y += dt * 4;
      } else {
        p.segT += dt * 1.95;
        if (p.segT >= 1) {
          p.segIdx++;
          p.segT = 0;
          p.pauseTimer = 0.24;
          p.treeProbe.position.copy(p.waypoints[p.segIdx]);
        } else {
          const a = p.waypoints[p.segIdx];
          const b = p.waypoints[p.segIdx + 1];
          p.treeProbe.position.lerpVectors(a, b, p.segT);
          p.treeProbe.position.y += Math.sin(p.segT * Math.PI) * 0.08;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
