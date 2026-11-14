# STARK ML LAB · Árboles de Decisión 3D & WebXR (Meta Quest 3)

Objeto interactivo 3D y Realidad Mixta (**WebXR**) diseñado para aprender **Árboles de Decisión de Machine Learning desde cero absoluto** hasta Random Forest, con narración guiada por voz en español (`./audio/stage_00.mp3` – `stage_08.mp3`) y motor matemático CART real en el navegador.

## Qué incluye
- **Ruta guiada de 9 etapas (00 a 08):**
  - `00` ¿Qué es Machine Learning? (analogía desde cero)
  - `01` Anatomía del dato en 3D (Features `X` y Etiquetas `y`)
  - `02` Impureza Gini y Entropía interactivas (Laboratorio de Pureza)
  - `03` Escáner Láser CART (automático y manual + curva de ganancia en vivo)
  - `04` Crecimiento recursivo con planos 3D acotados por sub-región
  - `05` Lanzador de Sondas de Inferencia en vivo sobre el árbol y el cubo 3D
  - `06` Overfitting (sobreajuste con datos ruidosos) y control de poda (`max_depth`)
  - `07` Random Forest (5 árboles votando en paralelo)
  - `08` Sandbox Libre (Exoplanetas, Flores Iris 3 Clases, Triaje Médico, Gini vs Entropía)
- **Compatible con Meta Quest 3 (solo navegador):**
  - Funciona en ventana curva del **Meta Quest Browser**.
  - Incluye modos inmersivos **Passthrough MR (`immersive-ar`)** y **Holodeck VR (`immersive-vr`)** con consola espacial 3D raycastable, punteros láser y agarre con *Grip* para rotar el holograma.

## Cómo subir a GitHub Pages
1. Crea un repositorio nuevo en GitHub (por ejemplo `arbol-decision-stark-xr`).
2. Sube **todo el contenido** de esta carpeta (`index.html`, `css/`, `js/`, `audio/`, `vendor/`, `icon.svg`, `manifest.json`, `sw.js`).
3. Ve a **Settings → Pages → Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` / `/ (root)`
4. Abre la URL `https://<tu-usuario>.github.io/<tu-repo>/` directamente desde el **Meta Quest Browser** en tus Meta Quest 3.
