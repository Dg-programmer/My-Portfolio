const vertexSource = `
  attribute vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const fragmentSource = `
  precision highp float;

  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uTime;
  uniform float uScroll;

  float fold(float offsetX, float width) {
    float edge = offsetX / width;
    return exp2(-edge * edge * 1.443);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    float portrait = 1.0 - smoothstep(0.55, 1.25, uResolution.x / uResolution.y);
    float phase = uTime * 0.23;
    float y = uv.y + 0.042 * uPointer.y + 0.065 * uScroll;
    float tilt = y - 0.51;
    float sweep = 0.786 - 0.40 * tilt + 0.31 * tilt * tilt
      + 0.071 * sin(5.2 * y + phase + 2.7 * uScroll)
      + 0.032 * sin(8.8 * y - 0.62 * phase)
      + 0.105 * uPointer.x + 0.106 * portrait;
    float offsetX = uv.x - sweep;

    vec2 corner = (uv - vec2(0.94 + 0.05 * uPointer.x, 0.28 + 0.06 * uScroll)) * vec2(2.55, 1.78);
    float bloom = exp2(-3.42 * dot(corner, corner));
    float rightSide = smoothstep(0.27, 0.82, uv.x);
    float rise = 0.45 + 0.55 * smoothstep(-0.04, 0.33, y);
    float fall = 1.0 - 0.61 * smoothstep(0.55, 1.02, y);
    float lit = rise * fall * (0.44 + 0.56 * rightSide);

    vec3 color = vec3(0.021, 0.031, 0.062);
    color += vec3(0.027, 0.064, 0.178) * bloom;
    color += vec3(0.036, 0.091, 0.282) * fold(offsetX + 0.037, 0.154) * lit;

    // Each fold has a wider translucent face and a narrow light-catching edge.
    float pleat = offsetX + 0.062 + 0.029 * sin(8.5 * y + 0.71 * phase + 2.1 * uScroll);
    float shoulder = offsetX - 0.065 + 0.023 * sin(9.4 * y - 0.92 * phase + 1.7);
    float filament = offsetX + 0.125 + 0.028 * sin(9.0 * y - 0.44 * phase);
    float crease = 0.69 + 0.31 * cos(5.9 * y + phase + 2.6 * uScroll);
    color += vec3(0.068, 0.192, 0.512) * fold(pleat + 0.026, 0.062) * lit * crease;
    color += vec3(0.159, 0.339, 0.694) * fold(pleat, 0.018) * lit * crease;
    color += vec3(0.062, 0.154, 0.426) * fold(shoulder - 0.017, 0.083) * lit;
    color += vec3(0.233, 0.390, 0.646) * fold(shoulder, 0.013) * lit * (0.36 + 0.64 * bloom);
    color += vec3(0.079, 0.151, 0.331) * fold(filament, 0.0065) * lit * rightSide;

    float thread = offsetX - 0.008 + 0.011 * sin(13.0 * y + 0.83 * phase);
    float threadFade = smoothstep(0.22, 0.43, y) * (1.0 - smoothstep(0.62, 0.88, y));
    color += vec3(0.245, 0.334, 0.512) * fold(thread, 0.006) * lit * threadFade;

    vec2 cursor = (uv - (uPointer * 0.5 + 0.5)) * vec2(2.5, 1.8);
    float response = exp2(-4.0 * dot(cursor, cursor)) * fold(offsetX, 0.14) * rightSide;
    color += vec3(0.045, 0.106, 0.246) * response;

    float edgeShade = smoothstep(0.34, 0.95, length((uv - vec2(0.57, 0.46)) * vec2(1.1, 0.83)));
    color *= 1.0 - 0.31 * edgeShade;
    float grain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5;
    color += grain * (0.008 + 0.012 * rightSide);
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create wallpaper shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  const message = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw new Error(message || 'Unable to compile wallpaper shader.');
}

function makePipeline(gl) {
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create wallpaper program.');

  let vertex;
  let fragment;
  let triangle;
  try {
    vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const source = precision?.precision ? fragmentSource : fragmentSource.replace('highp float', 'mediump float');
    fragment = compile(gl, gl.FRAGMENT_SHADER, source);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    triangle = gl.createBuffer();
    if (!triangle) throw new Error('Unable to create wallpaper geometry.');
    gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  } catch (error) {
    if (triangle) gl.deleteBuffer(triangle);
    gl.deleteProgram(program);
    throw error;
  } finally {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
  }

  return {
    program,
    triangle,
    resolution: gl.getUniformLocation(program, 'uResolution'),
    pointer: gl.getUniformLocation(program, 'uPointer'),
    time: gl.getUniformLocation(program, 'uTime'),
    scroll: gl.getUniformLocation(program, 'uScroll'),
  };
}

function mountWallpaper(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  });
  if (!gl) return;

  const root = document.documentElement;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const passive = { passive: true, signal: controller.signal };
  let pipeline;
  let frameId = 0;
  let lastPaint = 0;
  let time = 0;
  let viewportWidth = 1;
  let viewportHeight = 1;
  let scrollRange = 1;
  let scrollTarget = 0;
  let scroll = 0;
  let pointerTargetX = 0;
  let pointerTargetY = 0;
  let pointerX = 0;
  let pointerY = 0;

  function canAnimate() {
    return pipeline && !document.hidden && !motionPreference.matches;
  }

  function paint() {
    if (!pipeline || document.hidden) return;
    gl.uniform2f(pipeline.pointer, pointerX, pointerY);
    gl.uniform1f(pipeline.time, time);
    gl.uniform1f(pipeline.scroll, scroll);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function stop() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    lastPaint = 0;
  }

  function frame(now) {
    frameId = 0;
    if (!canAnimate()) return;
    if (!lastPaint) lastPaint = now - 33;
    const elapsed = now - lastPaint;
    if (elapsed >= 30) {
      lastPaint = now;
      const dt = Math.min(elapsed * 0.001, 0.065);
      const ease = 1 - Math.exp(-4.5 * dt);
      pointerX += (pointerTargetX - pointerX) * ease;
      pointerY += (pointerTargetY - pointerY) * ease;
      scroll += (scrollTarget - scroll) * ease;
      time += dt;
      paint();
    }
    frameId = requestAnimationFrame(frame);
  }

  function syncMotion() {
    if (canAnimate()) {
      if (!frameId) frameId = requestAnimationFrame(frame);
    } else {
      stop();
    }
  }

  function updateScroll() {
    scrollTarget = Math.min(1, Math.max(0, window.scrollY / scrollRange));
  }

  function updateScrollRange() {
    scrollRange = Math.max(1, root.scrollHeight - viewportHeight);
    updateScroll();
  }

  function resize() {
    viewportWidth = Math.max(1, canvas.clientWidth || innerWidth);
    viewportHeight = Math.max(1, canvas.clientHeight || innerHeight);
    updateScrollRange();
    if (!pipeline) return;

    const compact = viewportWidth < 760;
    const budget = compact ? 420000 : 1250000;
    const scale = Math.min(devicePixelRatio || 1, compact ? 1.05 : 1.2, Math.sqrt(budget / (viewportWidth * viewportHeight)));
    canvas.width = Math.max(1, Math.round(viewportWidth * scale));
    canvas.height = Math.max(1, Math.round(viewportHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(pipeline.resolution, canvas.width, canvas.height);
    paint();
  }

  function initialize() {
    try {
      pipeline = makePipeline(gl);
      resize();
      canvas.dataset.ready = 'true';
      syncMotion();
    } catch {
      pipeline = undefined;
      delete canvas.dataset.ready;
    }
  }

  const contentObserver = new ResizeObserver(updateScrollRange);
  contentObserver.observe(document.body);

  window.addEventListener('resize', resize, passive);
  window.addEventListener('scroll', updateScroll, passive);
  window.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !canAnimate()) return;
    pointerTargetX = Math.min(1, Math.max(-1, event.clientX / viewportWidth * 2 - 1));
    pointerTargetY = Math.min(1, Math.max(-1, 1 - event.clientY / viewportHeight * 2));
  }, passive);
  window.addEventListener('pointerout', event => {
    if (event.relatedTarget !== null) return;
    pointerTargetX = 0;
    pointerTargetY = 0;
  }, passive);
  window.addEventListener('blur', () => {
    pointerTargetX = 0;
    pointerTargetY = 0;
  }, passive);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) paint();
    syncMotion();
  }, passive);
  motionPreference.addEventListener('change', syncMotion, passive);

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    pipeline = undefined;
    delete canvas.dataset.ready;
    stop();
  }, { signal: controller.signal });
  canvas.addEventListener('webglcontextrestored', initialize, passive);

  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    stop();
    controller.abort();
    contentObserver.disconnect();
    if (pipeline) {
      gl.deleteBuffer(pipeline.triangle);
      gl.deleteProgram(pipeline.program);
    }
  }, passive);

  initialize();
}

const canvas = document.querySelector('#wallpaper-canvas');
if (canvas) mountWallpaper(canvas);
