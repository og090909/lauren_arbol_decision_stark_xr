import * as THREE from "../vendor/three.module.js";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { normalizeValue } from "./cart-engine.js";

/**
 * STARK ML LAB · Motor Holográfico 3D & WebXR (Meta Quest 3 Ready)
 * Soporta:
 *  - Modo Navegador 2D/3D (OrbitControls + Raycasting puntero)
 *  - Modo WebXR Passthrough MR (`immersive-ar`) con consola espacial 3D
 *  - Modo WebXR Holodeck VR (`immersive-vr`) con rejilla táctica Stark
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

function createTextSprite(lines, opts = {}) {
  const {
    width = 360,
    height = 112,
    borderColor = "#00f0ff",
    bgColor = "rgba(4, 12, 28, 0.92)",
    titleColor = "#ffffff",
    subColor = "#cbd5e1",
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
  roundRect(ctx, 4, 4, width - 8, height - 8, 14);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  // Esquinas Stark
  ctx.fillStyle = borderColor;
  ctx.fillRect(14, 4, 34, 4);
  ctx.fillRect(width - 48, height - 8, 34, 4);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (lines.length === 1) {
    ctx.font = "700 24px 'JetBrains Mono', monospace";
    ctx.fillStyle = titleColor;
    ctx.fillText(lines[0], width / 2, height / 2, width - 20);
  } else {
    ctx.font = "800 22px 'Orbitron', 'Inter', sans-serif";
    ctx.fillStyle = titleColor;
    ctx.fillText(lines[0], width / 2, height * 0.34, width - 20);

    ctx.font = "700 19px 'JetBrains Mono', monospace";
    ctx.fillStyle = subColor;
    ctx.fillText(lines[1], width / 2, height * 0.71, width - 20);
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
    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.05, 80);
    this.camera.position.set(0, 0.35, 5.15);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType("local-floor");

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 9.5;
    this.controls.target.set(0, -0.14, 0);

    // Luces Holográficas
    const ambient = new THREE.AmbientLight(0xbbeeff, 0.85);
    this.scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0x00f0ff, 1.3);
    keyLight.position.set(2.5, 4.0, 3.5);
    this.scene.add(keyLight);
    const rimLight = new THREE.PointLight(0xa855f7, 1.1, 14);
    rimLight.position.set(-3.0, -1.5, -2.5);
    this.scene.add(rimLight);

    // Entorno Holodeck VR / Desktop (oculto automáticamente en Passthrough AR)
    this.holodeckEnv = new THREE.Group();
    this._buildHolodeckEnv();
    this.scene.add(this.holodeckEnv);

    // Pivot principal del Holograma (Cubo + Árbol + Bosque + Sondas)
    this.hologramRoot = new THREE.Group();
    this.scene.add(this.hologramRoot);

    this.dataCubeGroup = new THREE.Group();
    this.pointsGroup = new THREE.Group();
    this.planesGroup = new THREE.Group();
    this.selectionBoxGroup = new THREE.Group();
    this.laserGroup = new THREE.Group();
    this.dataCubeGroup.add(this.pointsGroup, this.planesGroup, this.selectionBoxGroup, this.laserGroup);

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

    // Consola Espacial 3D exclusiva para inmersión WebXR (Meta Quest 3)
    this.xrConsoleGroup = new THREE.Group();
    this.xrConsoleGroup.visible = false;
    this.xrButtons = [];
    this.xrSlateCanvas = null;
    this.xrSlateTexture = null;
    this._buildXRConsole();
    this.scene.add(this.xrConsoleGroup);

    // Controladores WebXR + Punteros láser
    this.xrControllers = [];
    this.squeezingControllers = new Set();
    this.lastSqueezePos = new Map();
    this._setupXRControllers();

    // Estado interno de render / animaciones
    this.layoutMode = "dual"; // "dual" | "cube" | "tree"
    this.autoRotate = false;
    this.isXR = false;
    this.forestMode = false;
    this.xrMode = null; // "immersive-ar" | "immersive-vr"
    this.voiceEnergy = 0;

    this.dataset = null;
    this.tree = null;
    this.selectedNodeId = null;
    this.nodePositions = new Map();
    this.nodeMeshes = new Map();
    this.branchPackets = [];
    this.interactiveTargets = [];

    // Escáner láser animado (Etapa 3)
    this.laserSweepActive = false;
    this.laserAxis = 0;
    this.laserCandidates = [];
    this.laserBest = null;
    this.laserManualNorm = null;
    this.laserPhase = 0;
    this.laserMesh = null;
    this.laserSprite = null;

    // Simulador de Pureza Gini (Etapa 2)
    this.purityDemoActive = false;
    this.purityMixRatio = 0.5;
    this.purityReactorCore = null;
    this.purityOrbitRingA = null;
    this.purityOrbitRingB = null;

    // Animación de Sonda de Inferencia
    this.probeAnim = null;

    // Raycaster Desktop / Quest
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._pointerDownPos = { x: 0, y: 0 };
    this._hoveredXRBtn = null;

    this._bindDesktopPointerEvents();
    window.addEventListener("resize", () => this.onResize());

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._animate());
  }

  _buildHolodeckEnv() {
    // Rejilla Polar Stark en el suelo
    const polar = new THREE.PolarGridHelper(6.5, 16, 8, 64, 0x0ea5e9, 0x0f2744);
    polar.position.y = -1.35;
    polar.material.transparent = true;
    polar.material.opacity = 0.38;
    this.holodeckEnv.add(polar);

    // Anillo Reactor base
    const ringGeo = new THREE.RingGeometry(1.85, 1.92, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -1.34;
    this.holodeckEnv.add(ring);

    // Nube de motas espaciales sutiles
    const moteCount = 140;
    const pos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      const r = 2.6 + (i % 7) * 0.65;
      const theta = i * 2.39996;
      const y = -1.0 + ((i * 19) % 100) * 0.036;
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * r;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.03,
      transparent: true,
      opacity: 0.45
    });
    this.ambientMotes = new THREE.Points(moteGeo, moteMat);
    this.holodeckEnv.add(this.ambientMotes);
  }

  // =========================================================================
  // CONSOLA ESPACIAL 3D PARA MODO INMERSIVO WEBXR (META QUEST 3)
  // =========================================================================

  _buildXRConsole() {
    this.xrConsoleGroup.position.set(0, 0.94, -0.84);
    this.xrConsoleGroup.rotation.x = -0.34;

    // Marco base de cristal oscuro
    const chassisGeo = new THREE.BoxGeometry(1.16, 0.56, 0.018);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x040b19,
      roughness: 0.25,
      metalness: 0.5,
      transparent: true,
      opacity: 0.88
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    this.xrConsoleGroup.add(chassis);

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(chassisGeo),
      new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75 })
    );
    this.xrConsoleGroup.add(edges);

    // Pizarra dinámica superior (Briefing + Fórmulas + Métricas)
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

    // Fila inferior de 8 Botones Táctiles Raycastables en 3D
    const btnDefs = [
      { id: "prev", label: "◀ ANT", color: 0x0ea5e9 },
      { id: "next", label: "SIG ▶", color: 0x00f0ff },
      { id: "audio", label: "🔊 VOZ", color: 0xa855f7 },
      { id: "probe", label: "🚀 SONDA", color: 0x10b981 },
      { id: "depthDown", label: "PROF -", color: 0xf59e0b },
      { id: "depthUp", label: "PROF +", color: 0xf59e0b },
      { id: "dataset", label: "DATASET", color: 0x38bdf8 },
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
          color: 0x08162e,
          emissive: b.color,
          emissiveIntensity: 0.22,
          roughness: 0.3
        })
      );
      btnMesh.position.set(x, y, 0.016);
      btnMesh.userData = { xrButtonId: b.id, baseColor: b.color };

      const btnEdge = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(0.124, 0.092, 0.024)),
        new THREE.LineBasicMaterial({ color: b.color })
      );
      btnMesh.add(btnEdge);

      // Etiqueta Canvas del botón
      const c = document.createElement("canvas");
      c.width = 180;
      c.height = 96;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 28px 'Orbitron', 'Inter', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, 90, 48);
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
    roundRect(ctx, 4, 4, w - 8, h - 8, 20);
    ctx.fillStyle = "rgba(4, 10, 24, 0.94)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = info.accent || "#00f0ff";
    ctx.stroke();

    // Cabecera
    ctx.fillStyle = info.accent || "#00f0ff";
    ctx.font = "700 22px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${info.badge || "STARK ML LAB"}  ·  ETAPA ${info.stageNum}/8`, 28, 38);

    ctx.textAlign = "right";
    ctx.fillStyle = "#10b981";
    ctx.fillText(info.metricsText || "", w - 28, 38);

    // Título
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 30px 'Orbitron', 'Inter', sans-serif";
    ctx.fillText(info.title || "", 28, 82);

    // Resumen en líneas
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "500 23px 'Inter', sans-serif";
    const words = (info.summary || "").split(" ");
    let line = "";
    let y = 128;
    for (const word of words) {
      const testLine = line + word + " ";
      if (ctx.measureText(testLine).width > w - 60 && line) {
        ctx.fillText(line.trim(), 28, y);
        line = word + " ";
        y += 32;
        if (y > 235) break;
      } else {
        line = testLine;
      }
    }
    if (line && y <= 235) ctx.fillText(line.trim(), 28, y);

    // Caja de Fórmula / Nodo Seleccionado
    roundRect(ctx, 24, 256, w - 48, 82, 12);
    ctx.fillStyle = "rgba(14, 165, 233, 0.14)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
    ctx.stroke();

    ctx.fillStyle = "#38bdf8";
    ctx.font = "700 21px 'JetBrains Mono', monospace";
    ctx.fillText(info.formula || "", 40, 290);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "600 19px 'JetBrains Mono', monospace";
    ctx.fillText(info.nodeHint || "Apunta con el láser a cualquier nodo del Árbol o esfera del Cubo", 40, 322);

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

      // Rayo láser Stark
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -4.5)
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.72
      });
      const laser = new THREE.Line(lineGeo, lineMat);
      laser.name = "xrLaser";
      controller.add(laser);

      // Anillo emisor en la mano/controlador
      const gauntlet = new THREE.Mesh(
        new THREE.TorusGeometry(0.032, 0.005, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      );
      controller.add(gauntlet);

      // Retícula en la punta
      const reticle = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 12, 12),
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

    const sessionInit =
      mode === "immersive-ar"
        ? { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"] }
        : { optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"] };

    const session = await navigator.xr.requestSession(mode, sessionInit);
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
    // En Passthrough MR (immersive-ar), ocultamos rejilla de fondo para ver tu habitación real
    this.holodeckEnv.visible = mode !== "immersive-ar";

    // Posicionar el holograma cómodamente frente al usuario a escala de mesa Stark
    this.hologramRoot.position.set(0, 1.38, -1.68);
    this.hologramRoot.scale.set(0.62, 0.62, 0.62);
    this.hologramRoot.rotation.set(0, 0, 0);
  }

  async exitXR() {
    const session = this.renderer.xr.getSession();
    if (session) await session.end();
  }

  // =========================================================================
  // CONSTRUCCIÓN DEL HOLOGRAMA: CUBO DE DATOS + PLANOS CART + ÁRBOL 3D VIVO
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
    // Reconstruir marco, ejes y puntos del Cubo 3D
    if (this._cubeFrameBuiltFor !== dataset.id) {
      this._cubeFrameBuiltFor = dataset.id;
      // Eliminar solo marco/ejes previos
      const keep = [this.pointsGroup, this.planesGroup, this.selectionBoxGroup, this.laserGroup];
      this.dataCubeGroup.children
        .filter((c) => !keep.includes(c))
        .forEach((c) => {
          this.dataCubeGroup.remove(c);
          disposeObject3D(c);
        });

      const size = 1.48;
      const boxGeo = new THREE.BoxGeometry(size, size, size);
      const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(boxGeo),
        new THREE.LineBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.45 })
      );
      this.dataCubeGroup.add(wire);

      // Rejilla sutil inferior del cubo
      const floorGrid = new THREE.GridHelper(size, 6, 0x00f0ff, 0x0f2744);
      floorGrid.position.y = -size / 2;
      floorGrid.material.transparent = true;
      floorGrid.material.opacity = 0.25;
      this.dataCubeGroup.add(floorGrid);

      // Etiquetas de los 3 ejes
      const f = dataset.features;
      const xLabel = createTextSprite([`X: ${f[0].label} (${f[0].unit})`], {
        width: 420,
        height: 76,
        borderColor: "#38bdf8",
        scaleX: 0.56,
        scaleY: 0.1
      });
      xLabel.position.set(0, -size / 2 - 0.13, size / 2 + 0.04);
      this.dataCubeGroup.add(xLabel);

      const yLabel = createTextSprite([`Y: ${f[1].label} (${f[1].unit})`], {
        width: 420,
        height: 76,
        borderColor: "#10b981",
        scaleX: 0.56,
        scaleY: 0.1
      });
      yLabel.position.set(-size / 2 + 0.24, size / 2 + 0.11, size / 2 + 0.02);
      this.dataCubeGroup.add(yLabel);

      const zLabel = createTextSprite([`Z: ${f[2].label} (${f[2].unit})`], {
        width: 420,
        height: 76,
        borderColor: "#a855f7",
        scaleX: 0.56,
        scaleY: 0.1
      });
      zLabel.position.set(size / 2 + 0.18, -size / 2 - 0.08, 0);
      this.dataCubeGroup.add(zLabel);
    }
  }

  updatePoints(samples, dataset) {
    clearGroup(this.pointsGroup);
    const half = 0.72;
    const sphereGeo = new THREE.SphereGeometry(0.036, 16, 16);
    const noiseRingGeo = new THREE.TorusGeometry(0.06, 0.008, 8, 24);

    samples.forEach((s) => {
      const cls = dataset.classes[s.label];
      const mat = new THREE.MeshStandardMaterial({
        color: cls.colorHex,
        emissive: cls.colorHex,
        emissiveIntensity: s.isNoise ? 0.95 : 0.55,
        roughness: 0.25,
        metalness: 0.15
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.position.set(s.norm[0] * half, s.norm[1] * half, s.norm[2] * half);
      mesh.userData = { type: "sample", sample: s };

      if (s.isNoise) {
        const ring = new THREE.Mesh(
          noiseRingGeo,
          new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
        );
        ring.rotation.x = Math.PI / 3;
        mesh.add(ring);
      }

      this.pointsGroup.add(mesh);
      this.interactiveTargets.push(mesh);
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

      const depthColors = [0x00f0ff, 0x10b981, 0xf59e0b, 0xa855f7, 0xf43f5e, 0x38bdf8];
      const color = depthColors[node.depth % depthColors.length];

      let planeGeo;
      const pos = new THREE.Vector3(cx, cy, cz);
      const rot = new THREE.Euler(0, 0, 0);

      if (fIdx === 0) {
        // Corte perpendicular a X
        planeGeo = new THREE.PlaneGeometry(wZ, wY);
        pos.x = node.normThreshold * half;
        rot.y = Math.PI / 2;
      } else if (fIdx === 1) {
        // Corte perpendicular a Y
        planeGeo = new THREE.PlaneGeometry(wX, wZ);
        pos.y = node.normThreshold * half;
        rot.x = Math.PI / 2;
      } else {
        // Corte perpendicular a Z
        planeGeo = new THREE.PlaneGeometry(wX, wY);
        pos.z = node.normThreshold * half;
      }

      const planeMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: Math.max(0.11, 0.25 - node.depth * 0.03),
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.position.copy(pos);
      planeMesh.rotation.copy(rot);
      planeMesh.userData = { nodeId: node.id };

      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(planeGeo),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.72 })
      );
      planeMesh.add(border);

      this.planesGroup.add(planeMesh);
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
        const z = Math.sin(t * Math.PI) * 0.18;
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

    this.nodePositions = this._computeTreePositions(tree, depthLimit);

    const visibleNodes = tree.nodes.filter((n) => n.depth <= depthLimit);
    const compact = visibleNodes.length > 15;

    visibleNodes.forEach((node) => {
      const pos = this.nodePositions.get(node.id);
      if (!pos) return;
      const treatAsLeaf = node.isLeaf || node.depth >= depthLimit;
      const majCls = dataset.classes[node.majorityClass];

      const nodeRoot = new THREE.Group();
      nodeRoot.position.copy(pos);

      // Geometría del Núcleo
      const radius = node.depth === 0 ? 0.115 : treatAsLeaf ? (compact ? 0.062 : 0.082) : compact ? 0.068 : 0.088;
      const coreGeo = treatAsLeaf
        ? new THREE.OctahedronGeometry(radius, 0)
        : new THREE.IcosahedronGeometry(radius, 1);

      const coreColor = treatAsLeaf ? majCls.colorHex : 0x0ea5e9;
      const coreMat = new THREE.MeshStandardMaterial({
        color: coreColor,
        emissive: coreColor,
        emissiveIntensity: treatAsLeaf ? 0.72 : 0.48,
        roughness: 0.2,
        metalness: 0.35
      });

      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.userData = { type: "node", nodeId: node.id, node };
      nodeRoot.add(coreMesh);
      this.nodeMeshes.set(node.id, coreMesh);
      this.interactiveTargets.push(coreMesh);

      // Anillo de Pureza 3D proporcional (muestra la mezcla exacta de clases alrededor del nodo)
      let startAngle = 0;
      const ringRadius = radius * 1.48;
      dataset.classes.forEach((cls, cIdx) => {
        const frac = node.n > 0 ? node.counts[cIdx] / node.n : 0;
        if (frac <= 0.01) return;
        const arc = frac * Math.PI * 2;
        const arcGeo = new THREE.TorusGeometry(ringRadius, 0.012, 8, Math.max(8, Math.round(frac * 32)), arc * 0.94);
        const arcMat = new THREE.MeshBasicMaterial({ color: cls.colorHex });
        const arcMesh = new THREE.Mesh(arcGeo, arcMat);
        arcMesh.rotation.z = startAngle;
        nodeRoot.add(arcMesh);
        startAngle += arc;
      });

      // Etiqueta Holográfica (mostrada limpiamente para nodos clave o árboles manejables)
      if (!compact || node.depth <= 2 || node.id === this.selectedNodeId) {
        const feat = !treatAsLeaf ? dataset.features[node.featureIdx] : null;
        const line1 = treatAsLeaf
          ? `${majCls.name.toUpperCase()} (${Math.round(node.confidence * 100)}%)`
          : `${feat.short} ≤ ${node.threshold}${feat.unit}`;
        const line2 = treatAsLeaf
          ? `Gini ${node.gini.toFixed(2)} · N=${node.n}`
          : `Gini ${node.gini.toFixed(2)} · N=${node.n}`;

        const label = createTextSprite([line1, line2], {
          width: 340,
          height: 102,
          borderColor: treatAsLeaf ? majCls.cssColor : "#38bdf8",
          scaleX: compact ? 0.32 : 0.39,
          scaleY: compact ? 0.098 : 0.118
        });
        label.position.set(0, radius + (compact ? 0.095 : 0.12), 0.04);
        nodeRoot.add(label);
      }

      this.treeNodesGroup.add(nodeRoot);

      // Ramas hacia hijos
      if (!treatAsLeaf && node.left && node.right) {
        [
          { child: node.left, isLeft: true, color: 0x00f0ff },
          { child: node.right, isLeft: false, color: 0xfb7185 }
        ].forEach(({ child, isLeft, color }) => {
          const childPos = this.nodePositions.get(child.id);
          if (!childPos) return;
          const mid = pos.clone().lerp(childPos, 0.5);
          mid.y += 0.06;
          mid.z += 0.08;
          const curve = new THREE.QuadraticBezierCurve3(pos.clone(), mid, childPos.clone());
          const tubeGeo = new THREE.TubeGeometry(curve, 18, compact ? 0.008 : 0.011, 8, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.65
          });
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          this.treeBranchesGroup.add(tube);

          // Paquete de energía viajando por la sinapsis
          const packet = new THREE.Mesh(
            new THREE.SphereGeometry(compact ? 0.014 : 0.019, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
          );
          this.treeBranchesGroup.add(packet);
          this.branchPackets.push({
            mesh: packet,
            curve,
            offset: Math.random(),
            speed: 0.36 + Math.random() * 0.14
          });

          // Mini etiqueta SÍ / NO en las ramas superiores
          if (node.depth <= 1) {
            const tag = createTextSprite([isLeft ? "SÍ ≤" : "NO >"], {
              width: 140,
              height: 54,
              borderColor: isLeft ? "#00f0ff" : "#fb7185",
              scaleX: 0.14,
              scaleY: 0.055
            });
            tag.position.copy(curve.getPoint(0.42));
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

    // Núcleo Central de Votación Mayoritaria
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.16, 2),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.6,
        wireframe: false,
        roughness: 0.2
      })
    );
    core.position.set(0, -0.35, 0.2);
    this.forestGroup.add(core);

    const coreLabel = createTextSprite(["VOTO DEL BOSQUE", `${numTrees} Árboles en Paralelo`], {
      width: 360,
      height: 98,
      borderColor: "#f59e0b",
      scaleX: 0.44,
      scaleY: 0.12
    });
    coreLabel.position.set(0, -0.62, 0.24);
    this.forestGroup.add(coreLabel);

    forest.forEach((t, idx) => {
      const angle = ((idx / (numTrees - 1)) - 0.5) * Math.PI * 0.92;
      const tx = Math.sin(angle) * radius;
      const tz = Math.cos(angle) * 0.45 - 0.25;
      const ty = 0.28;

      const miniTree = new THREE.Group();
      miniTree.position.set(tx, ty, tz);
      miniTree.scale.set(0.32, 0.32, 0.32);

      const posMap = this._computeTreePositions(t, 2);
      t.nodes.filter((n) => n.depth <= 2).forEach((n) => {
        const p = posMap.get(n.id);
        if (!p) return;
        const cHex = n.isLeaf ? dataset.classes[n.majorityClass].colorHex : 0x0ea5e9;
        const orb = new THREE.Mesh(
          new THREE.OctahedronGeometry(n.depth === 0 ? 0.12 : 0.085, 0),
          new THREE.MeshStandardMaterial({ color: cHex, emissive: cHex, emissiveIntensity: 0.65 })
        );
        orb.position.copy(p);
        miniTree.add(orb);

        if (!n.isLeaf && n.depth < 2) {
          [n.left, n.right].forEach((ch, ci) => {
            const cp = posMap.get(ch.id);
            if (!cp) return;
            const lg = new THREE.BufferGeometry().setFromPoints([p, cp]);
            const lm = new THREE.LineBasicMaterial({ color: ci === 0 ? 0x00f0ff : 0xfb7185 });
            miniTree.add(new THREE.Line(lg, lm));
          });
        }
      });

      const title = createTextSprite([`Árbol #${idx + 1}`, `Nodos: ${t.nodeCount}`], {
        width: 240,
        height: 82,
        borderColor: "#38bdf8",
        scaleX: 0.72,
        scaleY: 0.24
      });
      title.position.set(0, 1.12, 0);
      miniTree.add(title);

      // Rayo de voto hacia el núcleo central
      const beamGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(tx, ty - 0.1, tz),
        new THREE.Vector3(0, -0.35, 0.2)
      ]);
      const beam = new THREE.Line(
        beamGeo,
        new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55 })
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

    // Resaltar escala del nodo seleccionado en el Árbol
    this.nodeMeshes.forEach((mesh, id) => {
      const active = id === nodeId;
      mesh.scale.setScalar(active ? 1.38 : 1.0);
    });

    // Dibujar la caja 3D exacta que corresponde a ese nodo dentro del Cubo de Datos
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
      new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.95 })
    );
    boxWire.position.set(cx, cy, cz);

    const boxFill = new THREE.Mesh(
      boxGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.08,
        depthWrite: false
      })
    );
    boxFill.position.set(cx, cy, cz);
    this.selectionBoxGroup.add(boxWire, boxFill);

    // Conector sináptico en modo dual entre el nodo del árbol y la cámara del cubo
    if (this.layoutMode === "dual" && this.treeGroup.visible) {
      const nodeLocalPos = this.nodePositions.get(nodeId);
      if (nodeLocalPos) {
        const pCube = new THREE.Vector3(cx, cy, cz).add(this.dataCubeGroup.position);
        const pTree = nodeLocalPos.clone().add(this.treeGroup.position);
        const mid = pCube.clone().lerp(pTree, 0.5);
        mid.y += 0.42;
        mid.z += 0.25;
        const curve = new THREE.QuadraticBezierCurve3(pCube, mid, pTree);
        const pts = curve.getPoints(28);
        const tether = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineDashedMaterial({
            color: 0xfacc15,
            dashSize: 0.08,
            gapSize: 0.04,
            transparent: true,
            opacity: 0.75
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

    const geo = new THREE.PlaneGeometry(1.56, 1.56);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.3,
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
    const coreColor = gini > 0.35 ? 0xa855f7 : gini > 0.12 ? 0x38bdf8 : 0x00f0ff;

    this.purityReactorCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.28, 2),
      new THREE.MeshStandardMaterial({
        color: coreColor,
        emissive: coreColor,
        emissiveIntensity: 0.7,
        wireframe: gini > 0.35
      })
    );
    grp.add(this.purityReactorCore);

    this.purityOrbitRingA = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.018, 12, 48, Math.max(0.1, mixRatio * Math.PI * 2)),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    grp.add(this.purityOrbitRingA);

    this.purityOrbitRingB = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.018, 12, 48, Math.max(0.1, (1 - mixRatio) * Math.PI * 2)),
      new THREE.MeshBasicMaterial({ color: 0xfb7185 })
    );
    this.purityOrbitRingB.rotation.z = mixRatio * Math.PI * 2;
    grp.add(this.purityOrbitRingB);

    const lbl = createTextSprite(
      [`Gini = ${gini.toFixed(3)}`, `${Math.round(mixRatio * 100)}% Cian / ${Math.round((1 - mixRatio) * 100)}% Coral`],
      {
        width: 420,
        height: 108,
        borderColor: gini > 0.35 ? "#a855f7" : "#00f0ff",
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

    // Marcador de destino dentro del Cubo de Datos
    const cubeBeacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    cubeBeacon.position.copy(cubePos);
    const cubeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.095, 0.012, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    cubeBeacon.add(cubeRing);
    this.dataCubeGroup.add(cubeBeacon);

    // Sonda viajando por el Árbol 3D
    const treeProbe = new THREE.Mesh(
      new THREE.SphereGeometry(0.068, 20, 20),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x00f0ff,
        emissiveIntensity: 1.0
      })
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.012, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    treeProbe.add(halo);
    this.treeGroup.add(treeProbe);

    // Guardamos referencias en probeGroup de forma indirecta para limpiar luego
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
      pauseTimer: 0.45,
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
  // CONTROL DE DISEÑO Y CÁMARA
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
      this.dataCubeGroup.position.set(-1.02, 0.14, 0);
      this.treeGroup.position.set(1.02, 0.1, 0);
      this.forestGroup.position.set(1.02, 0.14, 0);
      this.purityReactorGroup.position.set(1.02, 0.1, 0);
    } else if (this.layoutMode === "cube") {
      this.dataCubeGroup.visible = true;
      this.treeGroup.visible = false;
      this.forestGroup.visible = false;
      this.purityReactorGroup.visible = false;
      this.dataCubeGroup.position.set(0, 0.02, 0);
    } else if (this.layoutMode === "tree") {
      this.dataCubeGroup.visible = false;
      this.treeGroup.visible = !this.forestMode && !this.purityDemoActive;
      this.forestGroup.visible = this.forestMode && !this.purityDemoActive;
      this.purityReactorGroup.visible = this.purityDemoActive;
      this.treeGroup.position.set(0, 0.0, 0);
      this.forestGroup.position.set(0, 0.05, 0);
      this.purityReactorGroup.position.set(0, 0, 0);
    }
    this.highlightSelection(this.selectedNodeId);
  }

  setAutoRotate(val) {
    this.autoRotate = val;
  }

  resetCamera() {
    this.camera.position.set(0, 0.35, 5.15);
    this.controls.target.set(0, -0.14, 0);
    this.hologramRoot.rotation.set(0, 0, 0);
    this.controls.update();
  }

  // =========================================================================
  // RAYCASTING DESKTOP + QUEST
  // =========================================================================

  _bindDesktopPointerEvents() {
    this.canvas.addEventListener("pointerdown", (e) => {
      this._pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    this.canvas.addEventListener("pointerup", (e) => {
      const dx = e.clientX - this._pointerDownPos.x;
      const dy = e.clientY - this._pointerDownPos.y;
      if (Math.hypot(dx, dy) > 8) return; // Fue arrastre orbital, no clic

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
  // BUCLE DE ANIMACIÓN 60–90 FPS
  // =========================================================================

  _animate() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.elapsedTime;

    if (!this.isXR) {
      this.controls.update();
    } else {
      // Hover visual sobre botones de la consola 3D en Quest
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
          ctrl.userData.reticle.position.z = objHits.length > 0 ? -objHits[0].distance : -1.5;
        }

        // Grip para rotar cómodamente el holograma con la mano/controlador
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
        b.material.emissiveIntensity = b === hoveredBtn ? 0.72 : 0.22;
        b.scale.setScalar(b === hoveredBtn ? 1.07 : 1.0);
      });
    }

    if (this.autoRotate) {
      this.hologramRoot.rotation.y += dt * 0.22;
    }

    // Flotación suave de motas ambientales
    if (this.ambientMotes) {
      this.ambientMotes.rotation.y = elapsed * 0.03;
    }

    // Flujo de paquetes sinápticos en las ramas del árbol
    for (const pkt of this.branchPackets) {
      pkt.offset = (pkt.offset + dt * pkt.speed) % 1;
      pkt.mesh.position.copy(pkt.curve.getPoint(pkt.offset));
    }

    // Pulso de la voz J.A.R.V.I.S. sobre los nodos del árbol
    if (this.voiceEnergy > 0.02) {
      const rootMesh = this.nodeMeshes.get("N0");
      if (rootMesh) {
        rootMesh.material.emissiveIntensity = 0.48 + this.voiceEnergy * 0.85;
      }
    }

    // Animación de Pureza Gini (Etapa 2)
    if (this.purityDemoActive && this.purityReactorCore) {
      const chaos = 1 - Math.abs(this.purityMixRatio - 0.5) * 2;
      this.purityReactorCore.rotation.y += dt * (0.7 + chaos * 2.2);
      this.purityReactorCore.rotation.x += dt * (0.4 + chaos * 1.4);
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
        this.laserPhase = (this.laserPhase + dt * 0.28) % 1;
        // Pausar suavemente sobre el mejor corte al final del barrido
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

      // Emitir progreso de escaneo al HUD para actualizar el gráfico en tiempo real
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
        p.segT += dt * 1.35;
        if (p.segT >= 1) {
          p.segIdx++;
          p.segT = 0;
          p.pauseTimer = 0.42;
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
