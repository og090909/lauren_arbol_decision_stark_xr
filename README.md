# ChatGPT Spatial ML Lab · Árboles de Decisión 3D & WebXR (Meta Quest 3)

Laboratorio espacial interactivo en **3D y Realidad Mixta (WebXR)** con estética inspirada en **ChatGPT / OpenAI Spatial UI** (`#0a0a0c` obsidiana, cristal esmerilado y acentos esmeralda `#10a37f`), diseñado para dominar **Árboles de Decisión (CART)** y **Random Forest** desde cero absoluto hasta producción, con narración por voz en español (`./audio/stage_00.mp3` – `stage_08.mp3`).

## Qué incluye
- **Estética ChatGPT / OpenAI Spatial UI:**
  - Orbe iridiscente **Voice Mode** (en pantalla de inicio y flotando en 3D reactivo a las frecuencias de la voz).
  - Paneles de cristal esmerilado (`backdrop-filter: blur(24px)`) con bordes hairline de `1px` y tipografía ultra limpia para lectura ergonómica en **Meta Quest 3**.
  - **Barra de Preajustes de Cámara 3D** (`General`, `Cubo 3D`, `Árbol 3D`, `Isométrica`, `Cenital`) con físicas amortiguadas.
  - **Pestañas de Diagnóstico ML y Código Python (`scikit-learn`):** Importancia de Variables (*Feature Importance*) en vivo, Matriz de Confusión interactiva y generador de código Python listo para copiar.
- **Detalles 3D y Animaciones para Meta Quest 3:**
  - Crecimiento orgánico del árbol con curvas **Cubic-Bézier** (`CubicBezierCurve3`), anillos giroscópicos dobles en nodos de decisión cuya velocidad refleja la impureza Gini, y floración escalonada (*easeOutBack*).
  - **Reglas de proyección 3D (`X, Y, Z`)** hacia las paredes del cubo al apuntar o tocar cualquier esfera de datos con el ratón o el control láser de Quest 3.
- **Ruta guiada de 9 etapas (`00` a `08`):**
  - `00` ¿Qué es Machine Learning? (analogía desde cero)
  - `01` Anatomía del dato en 3D (Features `X` y Etiquetas `y`)
  - `02` Impureza Gini y Entropía interactivas (Laboratorio de Pureza)
  - `03` Escáner Láser CART (automático y manual + curva de ganancia en vivo)
  - `04` Crecimiento recursivo con planos 3D acotados por sub-región
  - `05` Lanzador de Sondas de Inferencia en vivo sobre el árbol y el cubo 3D
  - `06` Overfitting (sobreajuste con datos ruidosos) y control de poda (`max_depth`)
  - `07` Random Forest (5 árboles votando en paralelo)
  - `08` Sandbox Libre (Exoplanetas, Flores Iris 3 Clases, Triaje Médico, Gini vs Entropía)

## Cómo subir a GitHub Pages
1. Crea un repositorio nuevo en GitHub (por ejemplo `arbol-decision-stark-xr`).
2. Sube **todo el contenido** de esta carpeta (`index.html`, `css/`, `js/`, `audio/`, `vendor/`, `icon.svg`, `manifest.json`, `sw.js`).
3. Ve a **Settings → Pages → Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` / `/ (root)`
4. Abre la URL `https://<tu-usuario>.github.io/<tu-repo>/` directamente desde el **Meta Quest Browser** en tus Meta Quest 3.
