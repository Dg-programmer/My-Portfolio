import * as THREE from './vendor/three.module.min.js';

const fullTurn = Math.PI * 2;
const canvas = document.querySelector('#hero-canvas');
const frame = canvas?.closest('.hero-visual');

if (frame) {
  try {
    mountSculpture(canvas, frame);
  } catch {
    delete canvas.dataset.ready;
  }
}

function ribbonFrame(angle, radius, wave, phase) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const ripple = 3 * angle + phase;
  const distance = radius + 0.058 * Math.cos(ripple);
  const slope = -0.174 * Math.sin(ripple);
  const center = new THREE.Vector3(distance * cosine, distance * sine, wave * Math.sin(2 * angle + phase));
  const tangent = new THREE.Vector3(
    slope * cosine - distance * sine,
    slope * sine + distance * cosine,
    2 * wave * Math.cos(2 * angle + phase),
  ).normalize();
  const across = new THREE.Vector3(cosine, sine, 0);
  across.addScaledVector(tangent, -across.dot(tangent)).normalize();
  across.applyAxisAngle(tangent, 0.49 * Math.cos(2 * angle + phase) + 0.19);
  const normal = new THREE.Vector3().crossVectors(across, tangent);
  return { center, across, normal };
}

function ribbonGeometry(path, width, depth, steps = 192) {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const bevel = Math.min(halfDepth * 0.58, 0.055);
  const profile = [
    [-halfWidth + bevel, halfDepth],
    [halfWidth - bevel, halfDepth],
    [halfWidth, halfDepth - bevel],
    [halfWidth, -halfDepth + bevel],
    [halfWidth - bevel, -halfDepth],
    [-halfWidth + bevel, -halfDepth],
    [-halfWidth, -halfDepth + bevel],
    [-halfWidth, halfDepth - bevel],
  ];
  const materialIndices = [0, 1, 2, 1, 2, 1, 2, 1];
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const geometry = new THREE.BufferGeometry();
  const frames = Array.from({ length: steps + 1 }, (_, step) => path(fullTurn * step / steps));
  const vertex = new THREE.Vector3();
  const surfaceNormal = new THREE.Vector3();

  profile.forEach(([startWidth, startDepth], side) => {
    const [endWidth, endDepth] = profile[(side + 1) % profile.length];
    const startVertex = positions.length / 3;
    const startIndex = indices.length;

    frames.forEach(({ center, across, normal }, step) => {
      surfaceNormal.copy(across).multiplyScalar(startDepth - endDepth)
        .addScaledVector(normal, endWidth - startWidth).normalize();
      vertex.copy(center).addScaledVector(across, startWidth).addScaledVector(normal, startDepth);
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(surfaceNormal.x, surfaceNormal.y, surfaceNormal.z);
      uvs.push(step / steps, side / profile.length);
      vertex.copy(center).addScaledVector(across, endWidth).addScaledVector(normal, endDepth);
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(surfaceNormal.x, surfaceNormal.y, surfaceNormal.z);
      uvs.push(step / steps, (side + 1) / profile.length);
    });

    for (let step = 0; step < steps; step += 1) {
      const start = startVertex + 2 * step;
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    }
    geometry.addGroup(startIndex, indices.length - startIndex, materialIndices[side]);
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function addRibbon(parent, { radius, wave, phase, width, depth, color, markings = false }) {
  const path = angle => ribbonFrame(angle, radius, wave, phase);
  const face = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.86,
    roughness: 0.30,
    clearcoat: 0.32,
    clearcoatRoughness: 0.23,
    anisotropy: 0.33,
    envMapIntensity: 1.45,
  });
  const bevel = new THREE.MeshStandardMaterial({
    color: 0x9abbff,
    metalness: 0.88,
    roughness: 0.21,
    envMapIntensity: 1.50,
  });
  const underside = new THREE.MeshStandardMaterial({
    color: 0x0b2458,
    metalness: 0.81,
    roughness: 0.38,
    envMapIntensity: 1.22,
  });
  parent.add(new THREE.Mesh(ribbonGeometry(path, width, depth), [face, bevel, underside]));

  const railMaterial = new THREE.LineBasicMaterial({ color: 0x97c7ff, transparent: true, opacity: 0.56 });
  const railHeight = depth / 2 + 0.003;
  const rails = markings ? [-width * 0.37, width * 0.37] : [width * 0.32];
  for (const acrossOffset of rails) {
    const points = Array.from({ length: 256 }, (_, step) => {
      const { center, across, normal } = path(fullTurn * step / 256);
      return center.addScaledVector(across, acrossOffset).addScaledVector(normal, railHeight);
    });
    parent.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), railMaterial));
  }

  if (markings) {
    const ticks = [];
    for (let step = 0; step < 96; step += 1) {
      const { center, across, normal } = path(fullTurn * step / 96);
      center.addScaledVector(normal, railHeight);
      const inner = step % 8 === 0 ? -0.19 : -0.255;
      ticks.push(
        center.clone().addScaledVector(across, width * inner),
        center.addScaledVector(across, -width * 0.34),
      );
    }
    parent.add(new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(ticks),
      new THREE.LineBasicMaterial({ color: 0xb6d6ff, transparent: true, opacity: 0.56 }),
    ));
  }
}

function makeEnvironment(renderer) {
  const stage = new THREE.Scene();
  stage.background = new THREE.Color(0x182839);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const cards = [
    { color: 0xe1efff, power: 6, size: [4.6, 6], position: [-3.4, 4.6, 4] },
    { color: 0x326bff, power: 7, size: [1.1, 8.2], position: [5, 0.9, -1.6] },
    { color: 0xb7d4ff, power: 3.1, size: [1.3, 5.2], position: [-5, 0.1, -2.2] },
    { color: 0x547aff, power: 4.6, size: [8, 1.55], position: [0, -4.6, 2.1] },
    { color: 0xcfe7ff, power: 3.1, size: [5, 0.65], position: [0.6, 4.8, -4] },
  ];
  for (const { color, power, size, position } of cards) {
    const panel = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(power),
      toneMapped: false,
    }));
    panel.position.set(...position);
    panel.scale.set(...size, 1);
    panel.lookAt(0, 0, 0);
    stage.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(stage, 0.06, 0.1, 30, { size: 128 });
  stage.children.forEach(child => child.material.dispose());
  geometry.dispose();
  pmrem.dispose();
  return environment;
}

function createSculpture() {
  const sculpture = new THREE.Group();
  const outer = new THREE.Group();
  outer.rotation.set(-0.32, -0.40, -0.23);
  addRibbon(outer, { radius: 1.64, wave: 0.30, phase: 0.68, width: 0.53, depth: 0.18, color: 0x2c68dc, markings: true });
  sculpture.add(outer);

  const inner = new THREE.Group();
  inner.rotation.set(0.86, 0.60, -0.49);
  inner.position.z = 0.10;
  addRibbon(inner, { radius: 1.27, wave: 0.22, phase: 2.3, width: 0.29, depth: 0.125, color: 0x5997f2 });
  sculpture.add(inner);

  const orbit = new THREE.Group();
  orbit.rotation.set(0.11, -0.51, -0.12);
  const radius = 2.13;
  const orbitPoints = Array.from({ length: 184 }, (_, step) => {
    const angle = fullTurn * step / 184;
    return new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0);
  });
  orbit.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(orbitPoints),
    new THREE.LineBasicMaterial({ color: 0x658ebc, transparent: true, opacity: 0.36 }),
  ));

  const tracer = new THREE.Group();
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xeaff56, toneMapped: false });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.040, 16, 10), markerMaterial);
  marker.position.x = radius;
  tracer.add(marker);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008, 6, 16, 0.20), markerMaterial);
  tail.rotation.z = -0.20;
  tracer.add(tail);
  orbit.add(tracer);
  sculpture.add(orbit);
  return { sculpture, tracer };
}

function mountSculpture(canvas, frame) {
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!context) return;
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.20;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 25);
  camera.position.z = 7.7;
  const environment = makeEnvironment(renderer);
  scene.environment = environment.texture;
  scene.add(new THREE.HemisphereLight(0xb5cdff, 0x142046, 0.98));
  const key = new THREE.DirectionalLight(0xceeeff, 2.45);
  key.position.set(-2.8, 4, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x4a71ff, 3.15);
  rim.position.set(4.7, 0.7, -3.5);
  scene.add(rim);
  const { sculpture, tracer } = createSculpture();
  scene.add(sculpture);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionRoot = document.documentElement;
  const motionPaused = () => reducedMotion.matches || motionRoot.dataset.motion === 'paused';
  const pointer = new THREE.Vector2();
  const tilt = new THREE.Vector2();
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  let visible = true;
  let usable = true;
  let sized = false;
  let raf = 0;
  let previous = 0;
  let time = 0;

  function draw() {
    sculpture.rotation.set(
      0.10 + 0.11 * Math.sin(time * 0.42) + tilt.y * 0.10,
      -0.19 + 0.17 * Math.sin(time * 0.48) + tilt.x * 0.14,
      0.075 * Math.sin(time * 0.32),
    );
    sculpture.position.y = 0.035 * Math.sin(time * 0.60);
    tracer.rotation.z = 0.58 + time * 0.25;
    renderer.render(scene, camera);
    if (canvas.dataset.ready !== 'true') canvas.dataset.ready = 'true';
  }

  function animate(now) {
    const elapsed = Math.min((now - (previous || now)) / 1000, 0.045);
    previous = now;
    time += elapsed;
    tilt.lerp(pointer, 1 - Math.exp(-elapsed * 5));
    draw();
    raf = requestAnimationFrame(animate);
  }

  function syncMotion() {
    if (usable && sized && visible && !document.hidden && !motionPaused()) {
      if (!raf) raf = requestAnimationFrame(animate);
      return;
    }
    cancelAnimationFrame(raf);
    raf = 0;
    previous = 0;
  }

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    sized = width > 1 && height > 1;
    if (sized && usable) {
      const dprLimit = width < 540 ? 1.35 : 1.65;
      const pixelBudget = Math.sqrt(960000 / (width * height));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprLimit, pixelBudget));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const viewHeight = Math.max(5, 4.55 / camera.aspect);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(viewHeight / (2 * camera.position.z)));
      camera.updateProjectionMatrix();
      draw();
    }
    syncMotion();
  }

  const sizeObserver = new ResizeObserver(resize);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncMotion();
  });
  const motionObserver = new MutationObserver(syncMotion);
  motionObserver.observe(motionRoot, { attributes: true, attributeFilter: ['data-motion'] });

  frame.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || motionPaused()) return;
    const rect = frame.getBoundingClientRect();
    pointer.set(
      THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1),
      THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1),
    );
  }, options);
  frame.addEventListener('pointerleave', () => pointer.set(0, 0), options);
  document.addEventListener('visibilitychange', syncMotion, options);
  reducedMotion.addEventListener('change', syncMotion, options);
  canvas.addEventListener('webglcontextlost', () => {
    usable = false;
    delete canvas.dataset.ready;
    syncMotion();
  }, options);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    cancelAnimationFrame(raf);
    listeners.abort();
    sizeObserver.disconnect();
    visibilityObserver.disconnect();
    motionObserver.disconnect();
    const materials = new Set();
    scene.traverse(object => {
      object.geometry?.dispose();
      for (const material of [object.material].flat()) {
        if (material) materials.add(material);
      }
    });
    materials.forEach(material => material.dispose());
    environment.dispose();
    renderer.dispose();
  }, options);

  sizeObserver.observe(canvas);
  visibilityObserver.observe(frame);
  resize();
}
