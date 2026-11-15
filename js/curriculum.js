/**
 * OpenAI / ChatGPT Spatial ML Lab · Currículo Guiado "De 0 a Maestro" (9 Etapas)
 * Cada etapa sincroniza la escena 3D/WebXR, la narración de voz (.mp3),
 * los controles interactivos, el código Python scikit-learn y las fórmulas en vivo.
 */

export const STAGES = [
  {
    id: 0,
    code: "00",
    shortTitle: "¿Qué es ML?",
    title: "00 · ¿Qué es un Árbol de Decisión? (Desde Cero)",
    badge: "CONCEPTO BASE · INTUICIÓN",
    accent: "#10a37f",
    plainSummary:
      "Imagina el juego 'Adivina Quién', pero diseñado automáticamente por una IA. En lugar de programar mil reglas manuales con 'if / else', un Árbol de Decisión examina datos históricos y descubre por sí solo la secuencia exacta de preguntas Sí/No que mejor separa cada categoría.",
    mathConcept: "Aprendizaje supervisado: f(X) → y mediante particiones binarias recursivas del espacio.",
    formulaDisplay: "Datos Históricos (X, y)  ──[Algoritmo CART]──▶  Árbol de Reglas Óptimas",
    challengePrompt:
      "Observa la Cámara de Datos 3D a la izquierda: cada esfera es un exoplaneta explorado (Verde Esmeralda = Habitable, Coral = Hostil). Gira la escena o pasa el cursor sobre las esferas.",
    audioFile: "./audio/stage_00.mp3",
    narrationText:
      "Bienvenido al Laboratorio Espacial de Machine Learning. Empecemos desde cero absoluto. ¿Qué es un árbol de decisión? Imagina el clásico juego de adivinar haciendo preguntas de sí o no. En programación tradicional, tú tendrías que inventar cada regla a mano. En Machine Learning, el algoritmo observa cientos de ejemplos pasados y descubre por sí solo cuáles son las preguntas más inteligentes para separar un grupo de otro. Hoy verás cómo se construye esa inteligencia paso a paso en tres dimensiones.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: false,
      showTreeDepthLimit: 0,
      laserSweep: false,
      forestMode: false,
      includeNoise: false,
      autoProbe: false,
      cameraPreset: "general"
    }
  },
  {
    id: 1,
    code: "01",
    shortTitle: "Datos y Ejes 3D",
    title: "01 · Anatomía del Dato: Features (X) y Etiqueta (y)",
    badge: "ESTRUCTURA · ESPACIO 3D",
    accent: "#3b82f6",
    plainSummary:
      "Cada esfera flotando en la cámara 3D es un registro de entrenamiento. Su posición en los tres ejes (Temperatura, Oxígeno y Gravedad) son sus variables predictoras o 'Features' (X). Su color es la respuesta real o 'Target' (y) que el modelo debe aprender.",
    mathConcept: "Vector de características xᵢ = (x₁, x₂, x₃) ∈ ℝ³  |  Clase objetivo yᵢ ∈ {0, 1, ...}",
    formulaDisplay: "xᵢ = [ Temperatura (°C),  Oxígeno (%),  Gravedad (G) ]   →   yᵢ ∈ {Habitable, Hostil}",
    challengePrompt:
      "Apunta con el láser de tus Meta Quest 3 o haz clic sobre cualquier esfera del cubo para proyectar sus reglas de coordenadas (X, Y, Z) en el espacio 3D.",
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
      autoProbe: false,
      cameraPreset: "closeup_cube"
    }
  },
  {
    id: 2,
    code: "02",
    shortTitle: "Impureza Gini",
    title: "02 · El Termómetro del Orden: Impureza Gini y Entropía",
    badge: "MATEMÁTICA NUCLEAR · PUREZA",
    accent: "#8b5cf6",
    plainSummary:
      "¿Cómo mide la IA si un grupo está mezclado o puro? Usa la Impureza Gini. Si un nodo tiene 50% de cada clase, la incertidumbre es máxima (Gini = 0.500, anillos girando rápido). Si contiene 100% de una sola clase, es un cristal puro (Gini = 0.000). ¡Cada corte busca reducir Gini a cero!",
    mathConcept: "Impureza Gini = probabilidad de clasificar mal un elemento elegido al azar dentro del nodo.",
    formulaDisplay: "Gini(t) = 1 − Σ pᵢ²     |     Entropía(t) = − Σ pᵢ · log₂(pᵢ)",
    challengePrompt:
      "Desliza el control de Proporción en el panel izquierdo y observa cómo la escultura giroscópica 3D se estabiliza cuando alcanza el 100% de pureza.",
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
      autoProbe: false,
      cameraPreset: "general"
    }
  },
  {
    id: 3,
    code: "03",
    shortTitle: "Escáner CART",
    title: "03 · Búsqueda del Corte Óptimo: Algoritmo CART",
    badge: "OPTIMIZACIÓN · GANANCIA DE INFORMACIÓN",
    accent: "#10a37f",
    plainSummary:
      "El algoritmo CART desliza un plano de corte por cada eje (X, Y, Z) probando todos los puntos medios entre muestras. En cada posición calcula la reducción ponderada de impureza (Ganancia ΔI) y bloquea el corte donde la curva alcanza su pico máximo.",
    mathConcept: "ΔI = I(padre) − [ (N_izq / N)·I(izq) + (N_der / N)·I(der) ]",
    formulaDisplay: "Umbral Óptimo θ* = argmax_θ [ Gini(Padre) − Gini_Ponderado(Hijos) ]",
    challengePrompt:
      "Cambia a 'Control Manual' o alterna entre los ejes (Temp, O₂, Grav) mientras observas la curva de Ganancia en el panel derecho.",
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
      autoProbe: false,
      cameraPreset: "general"
    }
  },
  {
    id: 4,
    code: "04",
    shortTitle: "Recursividad",
    title: "04 · Partición Recursiva: Nodos Internos y Hojas",
    badge: "ARQUITECTURA · DIVIDIR Y VENCER",
    accent: "#06b6d4",
    plainSummary:
      "Tras el primer corte, cada sub-cámara 3D que aún contiene mezcla repite el mismo proceso CART dentro de sus propios límites geométricos. Así se tallan cajas ortogonales en el espacio 3D hasta llegar a Nodos Hoja 100% puros (Gini = 0).",
    mathConcept: "Particionamiento ortogonal recursivo del espacio ℝ³ en hiper-rectángulos disjuntos.",
    formulaDisplay: "Raíz (N0) ──▶ Sub-regiones Acotadas (SÍ ≤ θ | NO > θ) ──▶ Hojas Terminales",
    challengePrompt:
      "Selecciona distintos nodos en el Árbol 3D para ver cómo se ilumina su sub-cámara exacta dentro del Cubo y se conectan mediante un filamento espacial.",
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
      autoProbe: false,
      cameraPreset: "general"
    }
  },
  {
    id: 5,
    code: "05",
    shortTitle: "Inferencia Viva",
    title: "05 · Inferencia en Tiempo Real: Clasificando Nuevos Datos",
    badge: "PREDICCIÓN · RECORRIDO DE RAMAS",
    accent: "#10a37f",
    plainSummary:
      "Cuando llega un objeto nunca antes visto, la inferencia es instantánea: una sonda entra por el Nodo Raíz, evalúa la condición de cada compuerta y desciende por los conductos luminosos hasta aterrizar en una Hoja que emite la predicción y su probabilidad.",
    mathConcept: "Complejidad temporal de inferencia: O(profundidad del árbol) comparaciones escalares.",
    formulaDisplay: "x_nuevo ──▶ [¿O₂ ≤ 16.5?] ──▶ [¿Temp ≤ 31°C?] ──▶ ... ──▶ P(y | Hoja)",
    challengePrompt:
      "Modifica los deslizadores de Temperatura, Oxígeno y Gravedad y pulsa 'Lanzar Sonda' para ver el recorrido completo en 3D.",
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
      autoProbe: true,
      cameraPreset: "general"
    }
  },
  {
    id: 6,
    code: "06",
    shortTitle: "Overfitting y Poda",
    title: "06 · El Peligro del Sobreajuste (Overfitting) y la Poda",
    badge: "GENERALIZACIÓN · REGULARIZACIÓN",
    accent: "#f43f5e",
    plainSummary:
      "Si existen datos con ruido (sensores defectuosos marcados con anillos ámbar) y permites que el árbol crezca sin límite (max_depth = 6), creará micro-cajas absurdas para memorizar cada error: tendrá 98% de acierto en Entrenamiento, pero caerá a 67% en datos reales de Prueba (Test).",
    mathConcept: "Compromiso Sesgo-Varianza: limitar max_depth y min_samples_split poda ramas espurias.",
    formulaDisplay: "max_depth = 4 (Generaliza: 88% Test)   vs.   max_depth = 6 (Overfitting: 67% Test)",
    challengePrompt:
      "Compara el botón 'Poda Óptima (Depth=4)' contra 'Sobreajuste (Depth=6)' y observa la Matriz de Confusión en el panel derecho.",
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
      autoProbe: false,
      cameraPreset: "general"
    }
  },
  {
    id: 7,
    code: "07",
    shortTitle: "Random Forest",
    title: "07 · De un Árbol a un Bosque: Random Forest",
    badge: "ENSAMBLES · SABIDURÍA COLECTIVA",
    accent: "#f59e0b",
    plainSummary:
      "Para superar la fragilidad de un único árbol, Random Forest entrena múltiples árboles en paralelo sobre muestras aleatorias (Bootstrap) y subconjuntos de variables. Cada árbol emite un voto hacia el núcleo central y la mayoría decide con mucha mayor estabilidad.",
    mathConcept: "Bagging (Bootstrap Aggregating) + Submuestreo de características reduce la varianza sin aumentar el sesgo.",
    formulaDisplay: "ŷ_Bosque = argmax_c  Σₖ 𝕀( Árbolₖ(x) == c )",
    challengePrompt:
      "Pulsa 'Lanzar Sonda al Bosque' para ver cómo los 5 árboles evalúan el dato en paralelo y proyectan sus haces de votación hacia el núcleo.",
    audioFile: "./audio/stage_07.mp3",
    narrationText:
      "Si un solo árbol puede cometer errores cerca de las fronteras, ¿qué pasa si consultamos a un consejo de cinco árboles distintos? Eso es un Random Forest, o Bosque Aleatorio. Cada árbol entrena con una muestra aleatoria de planetas y distintas combinaciones de ejes. Cuando llega un dato nuevo, los cinco árboles calculan su respuesta en paralelo y emiten su voto hacia el núcleo central. La democracia matemática reduce drásticamente el error.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: true,
      showTreeDepthLimit: 4,
      laserSweep: false,
      forestMode: true,
      includeNoise: true,
      autoProbe: false,
      cameraPreset: "general"
    }
  },
  {
    id: 8,
    code: "08",
    shortTitle: "Sandbox Completo",
    title: "08 · Laboratorio Abierto: Experimentación Total en 3D",
    badge: "SANDBOX · CONTROL COMPLETO",
    accent: "#10a37f",
    plainSummary:
      "Ya conoces todo el flujo de un Árbol de Decisión desde cero. Experimenta libremente cambiando entre los 3 datasets (Exoplanetas, Flores Iris de 3 clases, Triaje Biomédico), alternando Gini vs Entropía, modificando hiperparámetros y copiando el código Python generado en vivo.",
    mathConcept: "Exploración interactiva de hiperparámetros CART y generación automática de código scikit-learn.",
    formulaDisplay: "DecisionTreeClassifier(criterion, max_depth, min_samples_split)",
    challengePrompt:
      "Selecciona el dataset 'Iris (3 Clases)', cambia el criterio a 'Entropía' y revisa el código Python autogenerado en la pestaña 'Código Python' del panel derecho.",
    audioFile: "./audio/stage_08.mp3",
    narrationText:
      "Felicidades. Has recorrido desde cero absoluto la intuición, la impureza Gini, el escaneo de cortes, la recursividad, el peligro del sobreajuste y el poder de los bosques aleatorios. Ahora tienes el control completo del laboratorio espacial. Cambia entre exoplanetas, flores iris de tres clases o triaje médico, ajusta los hiperparámetros en tiempo real y explora cada rama directamente dentro de tus Meta Quest tres.",
    sceneConfig: {
      layoutMode: "dual",
      showPlanes: true,
      showTreeDepthLimit: 4,
      laserSweep: false,
      forestMode: false,
      includeNoise: false,
      autoProbe: false,
      cameraPreset: "general"
    }
  }
];
