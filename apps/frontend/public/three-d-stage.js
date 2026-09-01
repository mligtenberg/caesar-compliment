// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
// Copied omelette starter. Re-running copy_starter_component with this kind overwrites this file with the latest version (page content is unaffected).
/* BEGIN USAGE */
/**
 * <three-d-stage> — 3D object viewer (three.js).
 *
 * The stage owns the whole scene: WebGL renderer, neutral studio lighting
 * with a soft ground shadow, a camera auto-framed to the object's bounds,
 * and resize handling. There is no drag/zoom/pan camera control — the
 * camera is driven programmatically (e.g. click-to-focus in the host
 * script) via `stage._camera` and `stage._controls.target`.
 *
 * three.js loads through the page's import map. Include this EXACT pinned
 * map in <head>, before any module runs — versions and integrity hashes
 * stay together (same map the "3D object" skill mandates):
 *
 *   <script type="importmap">
 *   {
 *     "imports": {
 *       "three": "https://unpkg.com/three@0.184.0/build/three.module.js"
 *     },
 *     "integrity": {
 *       "https://unpkg.com/three@0.184.0/build/three.module.js": "sha384-8FCZ1eVO6it4+pbec2aDtnTrwjWXZLJRC+MAGCIPDgsYnUrl/E0A2YlF8ioMKI/J",
 *       "https://unpkg.com/three@0.184.0/build/three.core.js": "sha384-dw2ooPewaEIrAgl6oFDBmmBWCE9oW9LxRGcfwZ0hLvEprzo202wXl7vCYHRlSnOT"
 *     }
 *   }
 *   </script>
 *
 * Usage:
 *   <style>three-d-stage:not(:defined){visibility:hidden}</style>
 *   <three-d-stage name="rocket"></three-d-stage>
 *   <script src="three-d-stage.js"></script>
 *   <script type="module">
 *     const stage = document.querySelector('three-d-stage');
 *     const { THREE } = await stage.ready;
 *     const model = new THREE.Group();
 *     stage.setObject(model);
 *   </script>
 *
 * Attributes:
 *   background — CSS color behind the scene (default a warm paper tone)
 *
 * Model in real-world meters, centered on the origin, y-up. The stage
 * fills its own box; size it with ordinary CSS (default 100vw/100vh page
 * hero).
 *
 * Default setup: neutral studio lighting (hemisphere + key + fill), a
 * soft ground shadow, and NO environment map — so high metalness has
 * nothing to reflect and renders near-black. Cap metalness around
 * 0.3–0.4 and carry a metal look with a brighter base color. The copied
 * file is yours: adjust the lights, shadow, or background in _boot()
 * when the object needs a different look.
 */
/* END USAGE */

(() => {
  const stylesheet = `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100vh;
      background: var(--stage-bg, #f0eee6);
      overflow: hidden;
    }
    canvas { display: block; outline: none; }
    .note {
      position: absolute;
      top: 96px;
      left: 50%;
      transform: translateX(-50%);
      max-width: 80%;
      text-align: center;
      font: 600 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #224f82;
      background: rgba(241, 246, 250, 0.85);
      padding: 6px 16px;
      border-radius: 999px;
      user-select: none;
    }
    .err {
      position: absolute;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font: 500 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #8a2f20;
      text-align: center;
      white-space: pre-line;
    }
  `;

  class ThreeDStage extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = stylesheet;
      root.appendChild(style);
      this._err = document.createElement('div');
      this._err.className = 'err';
      root.appendChild(this._err);
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = '';
      root.appendChild(note);
      /** Resolves with { THREE } once the scene is live — build the model
       *  in `await stage.ready` so nothing races the library load. */
      this.ready = new Promise((resolve, reject) => {
        this._readyResolve = resolve;
        this._readyReject = reject;
      });
    }

    connectedCallback() {
      if (this._booted) {
        // Re-attached after a removal — resume what disconnected stopped.
        if (this._renderer) {
          this._renderer.setAnimationLoop(this._loop);
          if (this._ro) this._ro.observe(this);
        }
        return;
      }
      this._booted = true;
      this._boot().catch((err) => {
        this._err.style.display = 'flex';
        this._err.textContent =
          'three.js failed to load.\n' +
          'Check that the pinned <script type="importmap"> from the usage ' +
          'notes is in <head> before any module script.\n\n' +
          String(err && err.message ? err.message : err);
        this._readyReject(err);
      });
    }

    async _boot() {
      const bg = this.getAttribute('background');
      if (bg) this.style.setProperty('--stage-bg', bg);
      const THREE = await import('three');
      this._THREE = THREE;
      // preserveDrawingBuffer keeps the last frame readable after
      // compositing (toDataURL / drawImage) — it's what lets the
      // screenshot tools capture the scene instead of a blank canvas.
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      // Full-viewport canvas at devicePixelRatio 2+ means rendering 4x+ the CSS
      // pixel count every frame — the single biggest GPU cost on retina/4K
      // displays. 1.5 keeps things crisp without paying for invisible detail.
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.shadowMap.enabled = false;
      this._renderer = renderer;
      this.shadowRoot.insertBefore(renderer.domElement, this._err);

      const scene = new THREE.Scene();
      this._scene = scene;

      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
      camera.position.set(3, 2.2, 4);
      this._camera = camera;

      // Camera framing target — the scene is navigated programmatically
      // (click-to-focus), not by dragging, so this is just a Vector3.
      this._controls = { target: new THREE.Vector3() };

      // Neutral studio: soft sky/ground wash, a shadow-casting key light,
      // and a dim fill from behind so silhouettes never go black.
      scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.0));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(4, 7, 5);
      this._key = key;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xfff4e6, 0.5);
      fill.position.set(-5, 3, -4);
      scene.add(fill);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.ShadowMaterial({ opacity: 0.18 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this._ground = ground;
      scene.add(ground);

      const fit = () => {
        const w = this.clientWidth || 1;
        const h = this.clientHeight || 1;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      fit();
      this._ro = new ResizeObserver(fit);
      this._loop = () => {
        renderer.render(scene, camera);
      };
      // Detached while three.js was fetching? Stay idle — the
      // connectedCallback resume starts the loop and observer on
      // reattach.
      if (this.isConnected) {
        this._ro.observe(this);
        renderer.setAnimationLoop(this._loop);
      }

      this._readyResolve({ THREE });
    }

    disconnectedCallback() {
      // Stop rendering and observing while detached; connectedCallback
      // resumes both. (The renderer itself is kept — a move within the
      // document must not rebuild the scene.)
      if (this._renderer) this._renderer.setAnimationLoop(null);
      if (this._ro) this._ro.disconnect();
    }

    /** Show (and own) the object. Replaces any previous object, enables
     *  shadows on every mesh, rests it on the ground plane, and frames
     *  the camera to its bounds. */
    setObject(object) {
      const THREE = this._THREE;
      if (!THREE) throw new Error('three-d-stage: not ready — await stage.ready first');
      if (this._object) this._scene.remove(this._object);
      this._object = object;
      object.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      const box = new THREE.Box3().setFromObject(object);
      if (!box.isEmpty()) {
        // Rest the object on the ground without moving its origin.
        this._ground.position.y = box.min.y;
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        const dist =
          (sphere.radius / Math.tan((this._camera.fov * Math.PI) / 360)) * 1.35;
        const dir = new THREE.Vector3(1, 0.55, 1.25).normalize();
        this._camera.position
          .copy(sphere.center)
          .add(dir.multiplyScalar(dist));
        this._camera.near = Math.max(dist / 100, 0.01);
        this._camera.far = dist * 100;
        this._camera.updateProjectionMatrix();
        this._controls.target.copy(sphere.center);
        this._camera.lookAt(this._controls.target);
        const span = sphere.radius * 3;
        this._key.shadow.camera.left = -span;
        this._key.shadow.camera.right = span;
        this._key.shadow.camera.top = span;
        this._key.shadow.camera.bottom = -span;
        this._key.shadow.camera.updateProjectionMatrix();
      }
      this._scene.add(object);
    }
  }

  customElements.define('three-d-stage', ThreeDStage);
})();
