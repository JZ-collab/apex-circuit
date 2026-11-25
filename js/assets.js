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
