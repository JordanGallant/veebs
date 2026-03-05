const VERT_SRC = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;

uniform sampler2D uIndexTex;
uniform sampler2D uGlyphTex;
uniform vec2 uGrid;
uniform vec2 uAtlasGrid;
uniform vec3 uFg;

in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 gridMax = max(vec2(1.0), uGrid) - vec2(0.0001);
  vec2 p = clamp(vUv * uGrid, vec2(0.0), gridMax);
  ivec2 cell = ivec2(p);
  vec2 local = fract(p);

  float idx = texelFetch(uIndexTex, cell, 0).r * 255.0;
  float rounded = floor(idx + 0.5);
  if (rounded < 0.5) {
    outColor = vec4(0.0);
    return;
  }

  vec2 atlasCell = vec2(mod(rounded, uAtlasGrid.x), floor(rounded / uAtlasGrid.x));
  vec2 glyphUv = (atlasCell + local) / uAtlasGrid;

  float alpha = texture(uGlyphTex, glyphUv).r;
  outColor = vec4(uFg, alpha);
}`;

function compileShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const err = gl.getShaderInfoLog(shader) || 'shader compile failure';
    gl.deleteShader(shader);
    throw new Error(err);
  }
  return shader;
}

function createProgram(gl) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const err = gl.getProgramInfoLog(program) || 'program link failure';
    gl.deleteProgram(program);
    throw new Error(err);
  }

  return program;
}

function parseRgb(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return [0, 0, 0];
  return [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255];
}

function flipRows(src, dst, width, height) {
  const row = width;
  for (let y = 0; y < height; y++) {
    const srcOff = y * row;
    const dstOff = (height - 1 - y) * row;
    dst.set(src.subarray(srcOff, srcOff + row), dstOff);
  }
}

function buildGlyphAtlas(chars, style, charW, lineH) {
  const count = chars.length;
  const atlasCols = Math.ceil(Math.sqrt(count));
  const atlasRows = Math.ceil(count / atlasCols);

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const upscale = Math.max(2, Math.round(dpr * 1.25));
  const pad = Math.max(1, Math.floor(upscale * 0.75));
  const cellW = Math.max(8, Math.ceil(charW * upscale) + pad * 2);
  const cellH = Math.max(8, Math.ceil(lineH * upscale) + pad * 2);

  const canvas = document.createElement('canvas');
  const width = atlasCols * cellW;
  const height = atlasRows * cellH;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const fontPx = Math.max(6, Math.round((parseFloat(style.fontSize) || 8) * upscale));
  ctx.font = `${style.fontWeight} ${fontPx}px ${style.fontFamily}`;

  for (let i = 0; i < count; i++) {
    const ch = chars[i];
    const col = i % atlasCols;
    const row = Math.floor(i / atlasCols);

    const m = ctx.measureText(ch);
    const left = Number.isFinite(m.actualBoundingBoxLeft) ? m.actualBoundingBoxLeft : 0;
    const right = Number.isFinite(m.actualBoundingBoxRight) ? m.actualBoundingBoxRight : m.width;
    const ascent = Number.isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : fontPx * 0.78;
    const descent = Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : fontPx * 0.22;
    const glyphW = Math.max(1, left + right);

    const originX = col * cellW + (cellW - glyphW) * 0.5 - left;
    const originY = row * cellH + (cellH + ascent - descent) * 0.5;
    ctx.fillText(ch, originX, originY);
  }

  const img = ctx.getImageData(0, 0, width, height).data;
  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const srcRow = y * width * 4;
    const dstRow = (height - 1 - y) * width;
    for (let x = 0; x < width; x++) {
      alpha[dstRow + x] = img[srcRow + x * 4 + 3];
    }
  }

  return {
    alpha,
    width,
    height,
    atlasCols,
    atlasRows,
  };
}

export function createAsciiWebGlRenderer(chars) {
  const canvas = document.createElement('canvas');
  canvas.className = 'ascii-viewport';
  canvas.setAttribute('aria-label', 'ASCII viewport');

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });

  if (!gl) return null;

  const program = createProgram(gl);
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    1, 1,
  ]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const uniforms = {
    uIndexTex: gl.getUniformLocation(program, 'uIndexTex'),
    uGlyphTex: gl.getUniformLocation(program, 'uGlyphTex'),
    uGrid: gl.getUniformLocation(program, 'uGrid'),
    uAtlasGrid: gl.getUniformLocation(program, 'uAtlasGrid'),
    uFg: gl.getUniformLocation(program, 'uFg'),
  };

  const indexTex = gl.createTexture();
  const glyphTex = gl.createTexture();

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  gl.bindTexture(gl.TEXTURE_2D, indexTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_2D, glyphTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.useProgram(program);
  gl.uniform1i(uniforms.uIndexTex, 0);
  gl.uniform1i(uniforms.uGlyphTex, 1);

  let gridCols = 0;
  let gridRows = 0;
  let flipped = new Uint8Array(0);
  let fontSig = '';
  let cssW = 0;
  let cssH = 0;
  let dprW = 0;
  let dprH = 0;

  function resizeCanvasToDisplay() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const nextCssW = Math.max(1, Math.round(rect.width));
    const nextCssH = Math.max(1, Math.round(rect.height));
    const nextDprW = Math.max(1, Math.round(rect.width * dpr));
    const nextDprH = Math.max(1, Math.round(rect.height * dpr));

    if (nextCssW === cssW && nextCssH === cssH && nextDprW === dprW && nextDprH === dprH) return;

    cssW = nextCssW;
    cssH = nextCssH;
    dprW = nextDprW;
    dprH = nextDprH;

    canvas.width = nextDprW;
    canvas.height = nextDprH;
    gl.viewport(0, 0, nextDprW, nextDprH);
  }

  function ensureGrid(cols, rows) {
    if (cols === gridCols && rows === gridRows) return;

    gridCols = cols;
    gridRows = rows;
    flipped = new Uint8Array(cols * rows);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, indexTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, cols, rows, 0, gl.RED, gl.UNSIGNED_BYTE, flipped);

    gl.useProgram(program);
    gl.uniform2f(uniforms.uGrid, cols, rows);
  }

  function updateGlyphAtlas(charW, lineH) {
    const style = window.getComputedStyle(canvas);
    const sig = [
      style.fontFamily,
      style.fontWeight,
      style.fontSize,
      Math.round(charW * 100),
      Math.round(lineH * 100),
      chars,
    ].join('|');

    if (sig === fontSig) return;
    fontSig = sig;

    const atlas = buildGlyphAtlas(chars, style, charW, lineH);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.R8,
      atlas.width,
      atlas.height,
      0,
      gl.RED,
      gl.UNSIGNED_BYTE,
      atlas.alpha,
    );

    gl.useProgram(program);
    gl.uniform2f(uniforms.uAtlasGrid, atlas.atlasCols, atlas.atlasRows);
  }

  function updateColor() {
    const fg = parseRgb(window.getComputedStyle(canvas).color);
    gl.useProgram(program);
    gl.uniform3f(uniforms.uFg, fg[0], fg[1], fg[2]);
  }

  function clear() {
    resizeCanvasToDisplay();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function render(topDownIndices, cols, rows) {
    if (!topDownIndices || !cols || !rows) return;

    resizeCanvasToDisplay();
    ensureGrid(cols, rows);

    flipRows(topDownIndices, flipped, cols, rows);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, indexTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RED, gl.UNSIGNED_BYTE, flipped);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  return {
    el: canvas,
    updateLayout(charW, lineH, cols, rows) {
      ensureGrid(cols, rows);
      updateGlyphAtlas(charW, lineH);
      updateColor();
      resizeCanvasToDisplay();
    },
    updateColor,
    render,
    clear,
    destroy() {
      gl.deleteTexture(indexTex);
      gl.deleteTexture(glyphTex);
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
  };
}
