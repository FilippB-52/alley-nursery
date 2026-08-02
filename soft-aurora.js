/* SoftAurora — vanilla WebGL port of the React Bits component (originally ogl-based).
   Renders a soft, cursor-reactive aurora band behind the CTA text. Colors are tuned
   to the site's forest palette so the glow reads as a slightly brighter green haze. */
(function () {
  const container = document.getElementById('cta-aurora');
  if (!container) return;

  const section = document.getElementById('cta') || container.parentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
  if (!gl) return; // graceful no-op if WebGL is unavailable
  container.appendChild(canvas);

  // ---- Config (brand-tuned) ----
  const opts = {
    speed: 0.45,
    scale: 2.2,
    brightness: 0.2,
    color1: '#8ea86a', // luminous moss
    color2: '#c79a54', // warm bark/gold
    noiseFrequency: 0.6,
    noiseAmplitude: 3.0,
    bandHeight: 0.28,
    bandSpread: 3.0,
    octaveDecay: 0.02,
    layerOffset: 0.4,
    colorSpeed: 0.15,
    enableMouseInteraction: true,
    mouseInfluence: 0.07
  };

  function hexToVec3(hex) {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255
    ];
  }

  const vertexSrc = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

  const fragmentSrc = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uBrightness;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uNoiseFreq;
uniform float uNoiseAmp;
uniform float uBandHeight;
uniform float uBandSpread;
uniform float uOctaveDecay;
uniform float uLayerOffset;
uniform float uColorSpeed;
uniform vec2 uMouse;
uniform float uMouseInfluence;
uniform bool uEnableMouse;

#define TAU 6.28318

vec3 gradientHash(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 234.6)),
    dot(p, vec3(269.5, 183.3, 198.3)),
    dot(p, vec3(169.5, 283.3, 156.9))
  );
  vec3 h = fract(sin(p) * 43758.5453123);
  float phi = acos(2.0 * h.x - 1.0);
  float theta = TAU * h.y;
  return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
}

float quinticSmooth(float t) {
  float t2 = t * t;
  float t3 = t * t2;
  return 6.0 * t3 * t2 - 15.0 * t2 * t2 + 10.0 * t3;
}

vec3 cosineGradient(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

float perlin3D(float amplitude, float frequency, float px, float py, float pz) {
  float x = px * frequency;
  float y = py * frequency;

  float fx = floor(x); float fy = floor(y); float fz = floor(pz);
  float cx = ceil(x);  float cy = ceil(y);  float cz = ceil(pz);

  vec3 g000 = gradientHash(vec3(fx, fy, fz));
  vec3 g100 = gradientHash(vec3(cx, fy, fz));
  vec3 g010 = gradientHash(vec3(fx, cy, fz));
  vec3 g110 = gradientHash(vec3(cx, cy, fz));
  vec3 g001 = gradientHash(vec3(fx, fy, cz));
  vec3 g101 = gradientHash(vec3(cx, fy, cz));
  vec3 g011 = gradientHash(vec3(fx, cy, cz));
  vec3 g111 = gradientHash(vec3(cx, cy, cz));

  float d000 = dot(g000, vec3(x - fx, y - fy, pz - fz));
  float d100 = dot(g100, vec3(x - cx, y - fy, pz - fz));
  float d010 = dot(g010, vec3(x - fx, y - cy, pz - fz));
  float d110 = dot(g110, vec3(x - cx, y - cy, pz - fz));
  float d001 = dot(g001, vec3(x - fx, y - fy, pz - cz));
  float d101 = dot(g101, vec3(x - cx, y - fy, pz - cz));
  float d011 = dot(g011, vec3(x - fx, y - cy, pz - cz));
  float d111 = dot(g111, vec3(x - cx, y - cy, pz - cz));

  float sx = quinticSmooth(x - fx);
  float sy = quinticSmooth(y - fy);
  float sz = quinticSmooth(pz - fz);

  float lx00 = mix(d000, d100, sx);
  float lx10 = mix(d010, d110, sx);
  float lx01 = mix(d001, d101, sx);
  float lx11 = mix(d011, d111, sx);

  float ly0 = mix(lx00, lx10, sy);
  float ly1 = mix(lx01, lx11, sy);

  return amplitude * mix(ly0, ly1, sz);
}

float auroraGlow(float t, vec2 shift) {
  vec2 uv = gl_FragCoord.xy / uResolution.y;
  uv += shift;

  float noiseVal = 0.0;
  float freq = uNoiseFreq;
  float amp = uNoiseAmp;
  vec2 samplePos = uv * uScale;

  for (float i = 0.0; i < 3.0; i += 1.0) {
    noiseVal += perlin3D(amp, freq, samplePos.x, samplePos.y, t);
    amp *= uOctaveDecay;
    freq *= 2.0;
  }

  float yBand = uv.y * 10.0 - uBandHeight * 10.0;
  return 0.3 * max(exp(uBandSpread * (1.0 - 1.1 * abs(noiseVal + yBand))), 0.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float t = uSpeed * 0.4 * uTime;

  vec2 shift = vec2(0.0);
  if (uEnableMouse) {
    shift = (uMouse - 0.5) * uMouseInfluence;
  }

  vec3 col = vec3(0.0);
  col += 0.99 * auroraGlow(t, shift) * cosineGradient(uv.x + uTime * uSpeed * 0.2 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.20, 0.20)) * uColor1;
  col += 0.99 * auroraGlow(t + uLayerOffset, shift) * cosineGradient(uv.x + uTime * uSpeed * 0.1 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.20, 0.25)) * uColor2;

  col *= uBrightness;
  float alpha = clamp(length(col), 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;

  function compile(type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('SoftAurora shader error:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  const vs = compile(gl.VERTEX_SHADER, vertexSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vs || !fs) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('SoftAurora link error:', gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // Fullscreen (oversized) triangle — covers clip space with one primitive.
  const positions = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const uvs = new Float32Array([0, 0, 2, 0, 0, 2]);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uvBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
  const uvLoc = gl.getAttribLocation(program, 'uv');
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(program, name);
  const loc = {
    uTime: u('uTime'), uResolution: u('uResolution'), uSpeed: u('uSpeed'),
    uScale: u('uScale'), uBrightness: u('uBrightness'), uColor1: u('uColor1'),
    uColor2: u('uColor2'), uNoiseFreq: u('uNoiseFreq'), uNoiseAmp: u('uNoiseAmp'),
    uBandHeight: u('uBandHeight'), uBandSpread: u('uBandSpread'), uOctaveDecay: u('uOctaveDecay'),
    uLayerOffset: u('uLayerOffset'), uColorSpeed: u('uColorSpeed'), uMouse: u('uMouse'),
    uMouseInfluence: u('uMouseInfluence'), uEnableMouse: u('uEnableMouse')
  };

  // Static uniforms
  gl.uniform1f(loc.uSpeed, opts.speed);
  gl.uniform1f(loc.uScale, opts.scale);
  gl.uniform1f(loc.uBrightness, opts.brightness);
  gl.uniform3fv(loc.uColor1, hexToVec3(opts.color1));
  gl.uniform3fv(loc.uColor2, hexToVec3(opts.color2));
  gl.uniform1f(loc.uNoiseFreq, opts.noiseFrequency);
  gl.uniform1f(loc.uNoiseAmp, opts.noiseAmplitude);
  gl.uniform1f(loc.uBandHeight, opts.bandHeight);
  gl.uniform1f(loc.uBandSpread, opts.bandSpread);
  gl.uniform1f(loc.uOctaveDecay, opts.octaveDecay);
  gl.uniform1f(loc.uLayerOffset, opts.layerOffset);
  gl.uniform1f(loc.uColorSpeed, opts.colorSpeed);
  gl.uniform1f(loc.uMouseInfluence, opts.mouseInfluence);
  gl.uniform1i(loc.uEnableMouse, opts.enableMouseInteraction ? 1 : 0);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, container.offsetWidth);
    const h = Math.max(1, container.offsetHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform3f(loc.uResolution, canvas.width, canvas.height, canvas.width / canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // Mouse tracked on the section so the buttons stay clickable (container is pointer-events:none).
  let currentMouse = [0.5, 0.5];
  let targetMouse = [0.5, 0.5];
  function onMove(e) {
    const rect = section.getBoundingClientRect();
    targetMouse = [
      (e.clientX - rect.left) / rect.width,
      1.0 - (e.clientY - rect.top) / rect.height
    ];
  }
  function onLeave() { targetMouse = [0.5, 0.5]; }
  if (opts.enableMouseInteraction && !reduceMotion) {
    section.addEventListener('mousemove', onMove);
    section.addEventListener('mouseleave', onLeave);
  }

  function renderFrame(timeMs) {
    gl.uniform1f(loc.uTime, timeMs * 0.001);
    if (opts.enableMouseInteraction) {
      currentMouse[0] += 0.05 * (targetMouse[0] - currentMouse[0]);
      currentMouse[1] += 0.05 * (targetMouse[1] - currentMouse[1]);
      gl.uniform2f(loc.uMouse, currentMouse[0], currentMouse[1]);
    } else {
      gl.uniform2f(loc.uMouse, 0.5, 0.5);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (reduceMotion) {
    // Respect reduced-motion: paint a single static frame, no loop.
    renderFrame(2000);
  } else {
    let raf;
    function loop(t) { raf = requestAnimationFrame(loop); renderFrame(t); }
    raf = requestAnimationFrame(loop);
  }
})();
