/**
 * STARK ML LAB · Currículo Guiado "De 0 a Maestro" (9 Etapas)
 * Cada etapa sincroniza la escena 3D/WebXR, la narración de voz J.A.R.V.I.S. (.mp3),
 * los controles interactivos del panel izquierdo y las fórmulas matemáticas en vivo.
 */

export const STAGES = [
  {
    id: 0,
    code: "00",
    shortTitle: "¿Qué es ML?",
    title: "Etapa 0 · ¿Qué es un Árbol de Decisión? (Desde Cero)",
    badge: "NIVEL 0 · INTUICIÓN PURA",
    accent: "#00f0ff",
    plainSummary:
      "Imagina el juego 'Adivina Quién', pero diseñado por una computadora. En vez de que tú escribas mil reglas manuales con 'si pasa esto, haz aquello', un Árbol de Decisión aprende automáticamente las mejores preguntas de Sí o No observando ejemplos del pasado.",
    mathConcept: "Regla aprendida automáticamente: f(X) → y mediante particiones binarias recursivas.",
    formulaDisplay: "Datos Pasados (X, y)  ──[Algoritmo CART]──▶  Preguntas Óptimas",
    challengePrompt:
      "Observa el Cubo 3D a la izquierda: cada esfera es un planeta ya explorado (Cian = Habitable, Coral = Hostil). ¡Avanza a la Etapa 1 para descubrir qué representan los 3 ejes!",
    audioFile: "./audio/stage_00.mp3",
    narrationText:
      "Bienvenido al Laboratorio Holográfico Stark. Empecemos desde cero absoluto. ¿Qué es un árbol de decisión en Machine Learning? Imagina el clásico juego de adivinar haciendo preguntas de sí o no. En programación tradicional, tú tendrías que inventar cada regla a mano. En Machine Learning, la máquina observa cientos de ejemplos pasados y descubre por sí sola cuáles son las preguntas más inteligentes para separar un grupo de otro. Hoy explorarás cómo se construye ese cerebro paso a paso.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: false,
      showTreeDepthLimit: 0,
      laserSweep: false,
      forestMode: false,
      includeNoise: false,
      autoProbe: false
    }
  },
  {
    id: 1,
    code: "01",
    shortTitle: "Datos y Ejes",
    title: "Etapa 1 · Anatomía del Dato: Características (X) y Etiqueta (y)",
    badge: "NIVEL 1 · ESTRUCTURA 3D",
    accent: "#38bdf8",
    plainSummary:
      "Cada esfera flotando en el cubo 3D representa un ejemplo real. Su posición en los tres ejes (Temperatura, Oxígeno y Gravedad) son sus Características o 'Features' (X). Su color representa la respuesta correcta o 'Etiqueta' (y) que queremos aprender a predecir.",
    mathConcept: "Vector de entrada xᵢ = (x₁, x₂, x₃) ∈ ℝ³  |  Etiqueta yᵢ ∈ {0, 1}",
    formulaDisplay: "Planeta i = [ Temp (°C),  Oxígeno (%),  Gravedad (G) ]  →  Clase y",
    challengePrompt:
      "Toca o apunta con el láser de tus Meta Quest 3 a cualquier esfera dentro del Cubo 3D para inspeccionar sus coordenadas exactas y su etiqueta real.",
    audioFile: "./audio/stage_01.mp3",
    narrationText:
      "Para que una máquina aprenda, primero debemos traducir el mundo a números. Mira el cubo tridimensional frente a ti. Cada esfera luminosa es un planeta conocido. Su posición a lo ancho mide la temperatura; su altura mide el porcentaje de oxígeno; y su profundidad mide la gravedad. A estas mediciones las llamamos características, o features. El color de la esfera, cian para habitable o coral para hostil, es la etiqueta que queremos predecir. Toca cualquier esfera para inspeccionar sus datos.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: false,
      showTreeDepthLimit: 0,
      laserSweep: false,
      forestMode: false,
      includeNoise: false,
      autoProbe: false
    }
  },
  {
    id: 2,
    code: "02",
    shortTitle: "Impureza Gini",
    title: "Etapa 2 · El Termómetro del Caos: Impureza Gini y Entropía",
    badge: "NIVEL 2 · LA MATEMÁTICA CLAVE",
    accent: "#a855f7",
    plainSummary:
      "¿Cómo sabe el algoritmo si una caja está ordenada o revuelta? Usa una puntuación llamada Impureza Gini. Si en un grupo hay 50% cian y 50% coral, el caos es máximo (Gini = 0.50). Si todos son del mismo color, el grupo es 100% puro (Gini = 0.00). ¡La meta del árbol es bajar el Gini a cero!",
    mathConcept: "Impureza Gini mide la probabilidad de equivocarse si etiquetaras al azar según la mezcla del nodo.",
    formulaDisplay: "Gini = 1 − Σ pᵢ²     (Ej: 50%/50% → 1 − (0.5² + 0.5²) = 0.50)",
    challengePrompt:
      "Mueve el Simulador de Pureza en el panel izquierdo: observa cómo el reactor del Nodo Raíz pasa de caos púrpura (0.50) a cristal puro (0.00).",
    audioFile: "./audio/stage_02.mp3",
    narrationText:
      "Aquí está el secreto matemático de todo árbol de decisión: medir qué tan revueltos están los datos. Imagina una bolsa con canicas azules y rojas. Si la mitad son azules y la mitad rojas, el desorden es total; su impureza Gini es cero punto cinco. Si todas las canicas son del mismo color, la bolsa es totalmente pura y su Gini es cero. El objetivo de cada pregunta en el árbol es dividir una mezcla caótica en subgrupos lo más puros posible.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: false,
      showTreeDepthLimit: 0,
      laserSweep: false,
      forestMode: false,
      includeNoise: false,
      autoProbe: false
    }
  },
  {
    id: 3,
    code: "03",
    shortTitle: "Escáner CART",
    title: "Etapa 3 · Buscando el Corte Perfecto: El Escáner Láser CART",
    badge: "NIVEL 3 · BÚSQUEDA ÓPTIMA",
    accent: "#10b981",
    plainSummary:
      "El algoritmo CART NO adivina preguntas al azar. Barre un plano láser por cada eje probando todos los cortes posibles entre puntos. Para cada corte calcula cuánto baja el Gini promedio (Ganancia de Información) y congela el láser exactamente en el corte ganador.",
    mathConcept: "Ganancia = Gini(padre) − [ (nᵢzq/N)·Gini(izq) + (n_der/N)·Gini(der) ]",
    formulaDisplay: "Mejor Corte = argmax ( Δ Gini ) sobre todas las características y umbrales",
    challengePrompt:
      "¡Desafía al algoritmo! Activa el Modo Láser Manual en el panel izquierdo y desliza el plano cortador 3D para intentar igualar la Ganancia máxima encontrada por CART.",
    audioFile: "./audio/stage_03.mp3",
    narrationText:
      "¿Cómo elige el árbol su primera gran pregunta? Observa el plano láser barriendo el cubo tridimensional. El algoritmo prueba cientos de cortes candidatos a lo largo de la temperatura, el oxígeno y la gravedad. En cada posición mide cuánta impureza logra eliminar al separar los planetas a la izquierda y a la derecha. Cuando encuentra el corte que produce los dos grupos más puros posibles, lo fija como su nodo raíz. También puedes tomar el láser manualmente e intentar vencer al algoritmo.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: true,
      showTreeDepthLimit: 1,
      laserSweep: true,
      forestMode: false,
      includeNoise: false,
      autoProbe: false
    }
  },
  {
    id: 4,
    code: "04",
    shortTitle: "Recursividad",
    title: "Etapa 4 · Crecimiento Recursivo: Nodos Rama y Nodos Hoja",
    badge: "NIVEL 4 · DIVIDIR Y CONQUISTAR",
    accent: "#0ea5e9",
    plainSummary:
      "¡Un solo corte casi nunca basta! Cada nueva cámara 3D que todavía esté mezclada repite exactamente el mismo escaneo CART dentro de su propio espacio, creando cortes perpendiculares. Cuando una cámara queda 100% pura (Gini = 0), cristaliza en un Nodo Hoja final.",
    mathConcept: "Recursión: cada nodo hijo hereda un sub-hipercubo acotado y busca su propio corte óptimo.",
    formulaDisplay: "Nodo Raíz ──▶ Ramas (SÍ / NO) ──▶ Hojas Puras (Gini = 0.00)",
    challengePrompt:
      "Toca los distintos nodos del Árbol 3D para ver cómo iluminan únicamente su caja geométrica correspondiente dentro del Cubo de Datos.",
    audioFile: "./audio/stage_04.mp3",
    narrationText:
      "Un solo corte rara vez resuelve todo el problema. Aquí entra la magia de la recursividad: dividir y conquistar. La cámara izquierda y la cámara derecha vuelven a ejecutar exactamente el mismo escaneo láser, pero solo con los planetas que quedaron dentro de su propio territorio. Así nacen cortes perpendiculares que van encerrando las zonas habitables en cajas tridimensionales cada vez más limpias, hasta que cada rama termina en un cristal puro llamado nodo hoja.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: true,
      showTreeDepthLimit: 4,
      laserSweep: false,
      forestMode: false,
      includeNoise: false,
      autoProbe: false
    }
  },
  {
    id: 5,
    code: "05",
    shortTitle: "Predicción Viva",
    title: "Etapa 5 · Inferencia en Vivo: Prediciendo un Dato Nuevo",
    badge: "NIVEL 5 · MODO PREDICCIÓN",
    accent: "#22d3ee",
    plainSummary:
      "Una vez entrenado el árbol, predecir el futuro es ultrarrápido. Llega un planeta misterioso sin etiqueta; en cada compuerta evaluamos su número contra el umbral ('¿Temp ≤ 31°C?'). El camino termina en una Hoja que emite la predicción y su nivel de confianza.",
    mathConcept: "Complejidad de predicción: O(profundidad) comparaciones simples (¡microsegundos!).",
    formulaDisplay: "Nuevo Dato x*  ──▶  Ruta Raíz → Hoja  ──▶  Clase Mayoritaria & Confianza %",
    challengePrompt:
      "Ajusta la Temperatura, Oxígeno y Gravedad de tu Sonda Espacial y presiona '🚀 Lanzar Sonda' para verla viajar por el árbol 3D y aterrizar en el cubo.",
    audioFile: "./audio/stage_05.mp3",
    narrationText:
      "¡Ahora veamos el árbol entrenado en acción! Cuando descubrimos un nuevo planeta desconocido, lanzamos una sonda de datos desde la cima del árbol. En cada compuerta holográfica, el árbol hace una simple comparación numérica y envía la sonda por la rama izquierda o derecha. En apenas tres pasos llega a una hoja terminal y emite su veredicto con porcentaje de confianza, iluminando exactamente en qué región del cubo cayó.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: true,
      showTreeDepthLimit: 4,
      laserSweep: false,
      forestMode: false,
      includeNoise: false,
      autoProbe: true
    }
  },
  {
    id: 6,
    code: "06",
    shortTitle: "Overfitting",
    title: "Etapa 6 · El Peligro Oculto: Overfitting (Sobreajuste) y Poda",
    badge: "NIVEL 6 · TRAMPA CLÁSICA DE ML",
    accent: "#f43f5e",
    plainSummary:
      "¿Por qué no hacer árboles infinitamente profundos? Agregamos 6 planetas con lecturas falsas (ruido). Si subes max_depth a 6, el árbol memoriza ese ruido cortando micro-cajas absurdas: alcanza 100% en entrenamiento, ¡pero falla con planetas nuevos en el Test real!",
    mathConcept: "Compromiso Sesgo-Varianza: Poda / max_depth evita memorizar ruido y protege la generalización.",
    formulaDisplay: "Depth = 3 → Generaliza (~95% Test)   vs.   Depth = 6 → Memoriza Ruido (Overfit!)",
    challengePrompt:
      "Mueve el deslizador de Profundidad Máxima (max_depth) de 1 a 6 en el panel izquierdo y vigila cómo cae la Precisión de Test aunque la de Entrenamiento suba al 100%.",
    audioFile: "./audio/stage_06.mp3",
    narrationText:
      "Cuidado: un árbol demasiado ambicioso puede volverse tonto. Hemos inyectado seis planetas con sensores defectuosos, marcados con un anillo de alerta. Si dejas que el árbol crezca hasta profundidad seis, empezará a crear microcajas obsesivas solo para aislar esos errores. Logrará cien por ciento de aciertos en entrenamiento, pero su precisión caerá al evaluar planetas nuevos. A esto lo llamamos overfitting o sobreajuste, y lo prevenimos podando el árbol con una profundidad máxima equilibrada.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: true,
      showTreeDepthLimit: 6,
      laserSweep: false,
      forestMode: false,
      includeNoise: true,
      autoProbe: false
    }
  },
  {
    id: 7,
    code: "07",
    shortTitle: "Random Forest",
    title: "Etapa 7 · De un Árbol a un Bosque: Random Forest",
    badge: "NIVEL 7 · ENSAMBLES PRO",
    accent: "#f59e0b",
    plainSummary:
      "Un solo árbol puede ser sensible si cambian algunos datos. La solución brillante del ML moderno es crear un Bosque Aleatorio (Random Forest): entrenamos muchos árboles ligeramente distintos usando muestras y ejes al azar, y todos votan en paralelo para decidir.",
    mathConcept: "Bagging + Submuestreo de Features: reducir varianza promediando árboles descorrelacionados.",
    formulaDisplay: "Predicción Bosque = Voto Mayoritario ( Árbol₁, Árbol₂, ..., Árbol₅ )",
    challengePrompt:
      "Observa los 5 mini-árboles Stark votando alrededor del Núcleo Central. Lanza una Sonda para ver cómo cada árbol vota en tiempo real.",
    audioFile: "./audio/stage_07.mp3",
    narrationText:
      "Si un solo árbol puede cometer errores cerca de las fronteras, ¿qué pasa si consultamos a un consejo de cinco árboles distintos? Eso es un Random Forest, o Bosque Aleatorio. Cada árbol entrena con una muestra aleatoria de planetas y distintas combinaciones de ejes. Cuando llega un dato nuevo, los cinco árboles calculan su respuesta en paralelo y emiten su voto hacia el núcleo central. La democracia matemática reduce drásticamente el error.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: true,
      showTreeDepthLimit: 3,
      laserSweep: false,
      forestMode: true,
      includeNoise: true,
      autoProbe: false
    }
  },
  {
    id: 8,
    code: "08",
    shortTitle: "Sandbox Pro",
    title: "Etapa 8 · Laboratorio Libre Stark: Entrena tu Propio CART",
    badge: "NIVEL 8 · DOMINIO TOTAL",
    accent: "#00f0ff",
    plainSummary:
      "¡Ya dominas los Árboles de Decisión desde cero! Ahora experimenta libremente: cambia entre Exoplanetas, Flores Iris (3 clases) o Triaje Médico; alterna entre Impureza Gini y Entropía; ajusta max_depth y min_samples_split, y observa el algoritmo recalcular todo al instante en 3D.",
    mathConcept: "Motor CART real en tiempo real · 2 y 3 clases · Hiperparámetros en vivo.",
    formulaDisplay: "CART( dataset, criterio ∈ {Gini, Entropía}, max_depth, min_samples_split )",
    challengePrompt:
      "Prueba cambiar al dataset 'Flores Iris (3 Clases)' y activa 'Entropía' para ver cómo un árbol resuelve 3 especies al mismo tiempo.",
    audioFile: "./audio/stage_08.mp3",
    narrationText:
      "Felicidades, comandante. Has recorrido desde cero absoluto la intuición, la impureza Gini, el escaneo de cortes, la recursividad, el peligro del sobreajuste y el poder de los bosques aleatorios. Ahora tienes el control total del laboratorio Stark. Cambia entre exoplanetas, flores iris de tres clases o triaje médico, ajusta los hiperparámetros en tiempo real y explora cada rama directamente dentro de tus Meta Quest tres.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: true,
      showTreeDepthLimit: 3,
      laserSweep: false,
      forestMode: false,
      includeNoise: false,
      autoProbe: false
    }
  }
];
