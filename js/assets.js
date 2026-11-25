import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();
const MODEL_BASE = new URL('../assets/models/', import.meta.url);

export function loadGLTF(file) {
  if (cache.has(file)) return cache.get(file);
  const promise = new Promise((resolve, reject) => {
    loader.load(new URL(file, MODEL_BASE).href, gltf => resolve(gltf.scene), undefined, reject);
  }).catch(err => {
    cache.delete(file);
    throw err;
  });
  cache.set(file, promise);
  return promise;
}

export async function cloneModel(file) {
  const scene = await loadGLTF(file);
  return scene.clone(true);
}

/** Load a user-imported model from a data URL, auto-oriented and scaled. */
export function loadCustomModel(dataUrl) {
  if (cache.has(dataUrl)) return cache.get(dataUrl).then(scene => scene.clone(true));
  loader.setResourcePath(MODEL_BASE.href); // resolve external textures for bundled test models
  const promise = new Promise((resolve, reject) => {
    loader.load(dataUrl, gltf => resolve(gltf.scene), undefined, reject);
  }).then(scene => {
    // Normalize unknown community models: longest horizontal axis faces forward.
    let box = new THREE.Box3().setFromObject(scene);
    let size = box.getSize(new THREE.Vector3());
    if (size.x > size.z) scene.rotation.y = Math.PI / 2;
    scene.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(scene);
    size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = THREE.MathUtils.clamp(4.2 / Math.max(size.z, 0.1), 0.02, 30);
    scene.scale.setScalar(scale);
    scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    scene.updateMatrixWorld(true);
    return scene;
  }).catch(err => {
    cache.delete(dataUrl);
    throw err;
  }).finally(() => loader.setResourcePath(''));
  cache.set(dataUrl, promise);
  return promise.then(scene => scene.clone(true));
}

// Bounding box of an object, in the coordinate space of `relativeTo`.
export function localBox(object, relativeTo) {
  object.updateWorldMatrix(true, true);
  relativeTo.updateWorldMatrix(true, false);
  const inverse = new THREE.Matrix4().copy(relativeTo.matrixWorld).invert();
  const box = new THREE.Box3().setFromObject(object);
  box.applyMatrix4(inverse);
  return box;
}

export function disposeObject(root) {
  root.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => m.dispose());
    }
  });
}
