const canvas = document.getElementById("fractalCanvas");
const gl = canvas.getContext("webgl");
const w = canvas.width;
const h = canvas.height;

if (!gl) {
  alert("WebGL not supported!");
  throw new Error("WebGL not supported");
}

const vertexShaderSource = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

const fragmentShaderSource = `
            precision highp float;
            varying vec2 v_uv;
            uniform vec2 u_resolution;
            uniform vec2 u_c;
            uniform float u_seed;
            uniform float u_time;

            vec3 turboColormap(float t) {
                float r = 0.13572138 + 4.6153926 * t - 42.66032258 * t * t + 
                          132.13108234 * t * t * t - 152.94239396 * t * t * t * t + 
                          59.28637943 * t * t * t * t * t;
                float g = 0.09140261 + 2.94319816 * t + 4.23465233 * t * t - 
                          24.86742029 * t * t * t + 60.45632801 * t * t * t * t - 
                          54.2984038 * t * t * t * t * t;
                float b = 0.1066733 + 11.60249368 * t - 60.13642266 * t * t + 
                          136.11487975 * t * t * t - 140.45121126 * t * t * t * t + 
                          52.60698968 * t * t * t * t * t;
                return clamp(vec3(r, g, b), 0.0, 1.0);
            }

            vec3 hsvToRgb(float h, float s, float v) {
                float c = v * s;
                float x = c * (1.0 - abs(mod(h / 60.0, 2.0) - 1.0));
                float m = v - c;
                vec3 rgb;
                if (h < 60.0) rgb = vec3(c, x, 0.0);
                else if (h < 120.0) rgb = vec3(x, c, 0.0);
                else if (h < 180.0) rgb = vec3(0.0, c, x);
                else if (h < 240.0) rgb = vec3(0.0, x, c);
                else if (h < 300.0) rgb = vec3(x, 0.0, c);
                else rgb = vec3(c, 0.0, x);
                return rgb + m;
            }

            void main() {
                vec2 coord = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
                coord.y *= u_resolution.y / u_resolution.x;

                vec2 z = coord * 1.5;
                vec2 c = u_c;
                
                float iter = 0.0;
                const float maxIter = 400.0;
                
                for (float i = 0.0; i < 400.0; i++) {
                    if (dot(z, z) > 4.0) break;
                    float xtemp = z.x * z.x - z.y * z.y + c.x;
                    z.y = 2.0 * z.x * z.y + c.y;
                    z.x = xtemp;
                    iter++;
                }

                float norm = iter / maxIter;
                float xPhase = sin(gl_FragCoord.x * 0.005 + u_seed * 4.0);
                float yPhase = cos(gl_FragCoord.y * 0.005 + u_seed * 6.0);
                float phase = (xPhase + yPhase) * 0.25;
                float t = pow(clamp(norm + phase * 0.2, 0.0, 1.0), 0.9);

                vec3 turbo = turboColormap(t);
                vec3 hsvColor = hsvToRgb(mod(t * 360.0 + phase * 120.0, 360.0), 0.9, 1.3);
                vec3 color = turbo * 0.7 + hsvColor * 0.3;

                vec2 centerDist = gl_FragCoord.xy - u_resolution * 0.5;
                float edgeFade = max(0.85, 1.0 - pow(dot(centerDist, centerDist), 0.000004));
                color *= edgeFade;

                float brightness = (color.r + color.g + color.b) / 3.0;
                if (brightness > 0.75) {
                    color *= 1.1;
                }

                gl_FragColor = vec4(color, 1.0);
            }
        `;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(
  gl,
  gl.FRAGMENT_SHADER,
  fragmentShaderSource
);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  console.error(gl.getProgramInfoLog(program));
}

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
  gl.STATIC_DRAW
);

const positionLocation = gl.getAttribLocation(program, "a_position");
const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
const cLocation = gl.getUniformLocation(program, "u_c");
const seedLocation = gl.getUniformLocation(program, "u_seed");
const timeLocation = gl.getUniformLocation(program, "u_time");

function textToBytes(text) {
  return new TextEncoder().encode(text);
}
function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}
function bytesToBits(bytes) {
  const bits = [];
  for (let byte of bytes)
    for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
  return bits;
}
function bitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i + j] || 0);
    bytes.push(b);
  }
  return new Uint8Array(bytes);
}

function hashStringToSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash / 0xffffffff;
}

function renderJulia(seed, time = 0) {
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const baseCx = Math.sin(seed * 6.28) * 0.7;
  const baseCy = Math.cos(seed * 6.28) * 0.7;
  const cx = baseCx + 0.15 * Math.sin(time * 0.4 + seed * 10);
  const cy = baseCy + 0.15 * Math.cos(time * 0.6 + seed * 5);

  gl.uniform2f(resolutionLocation, w, h);
  gl.uniform2f(cLocation, cx, cy);
  gl.uniform1f(seedLocation, seed);
  gl.uniform1f(timeLocation, time);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function getCanvasImageData() {
  const pixels = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const flipped = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const dstIdx = ((h - 1 - y) * w + x) * 4;
      flipped[dstIdx] = pixels[srcIdx];
      flipped[dstIdx + 1] = pixels[srcIdx + 1];
      flipped[dstIdx + 2] = pixels[srcIdx + 2];
      flipped[dstIdx + 3] = pixels[srcIdx + 3];
    }
  }
  return flipped;
}

function embedMessage(pixels, message) {
  const bytes = textToBytes(message);
  const lengthBits = bytesToBits(
    new Uint8Array([
      (bytes.length >>> 24) & 255,
      (bytes.length >>> 16) & 255,
      (bytes.length >>> 8) & 255,
      bytes.length & 255,
    ])
  );
  const bits = lengthBits.concat(bytesToBits(bytes));

  let bitIndex = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      if (bitIndex < bits.length) {
        pixels[i + j] = (pixels[i + j] & 0xfe) | bits[bitIndex++];
      }
    }
  }
  return pixels;
}

function extractMessage(pixels) {
  const bits = [];
  for (let i = 0; i < pixels.length; i += 4)
    for (let j = 0; j < 3; j++) bits.push(pixels[i + j] & 1);
  const lengthBits = bits.slice(0, 32);
  const lenBytes = bitsToBytes(lengthBits);
  const msgLen =
    (lenBytes[0] << 24) |
    (lenBytes[1] << 16) |
    (lenBytes[2] << 8) |
    lenBytes[3];
  if (msgLen > 1000000 || msgLen < 0) return "Invalid or no message";
  const msgBits = bits.slice(32, 32 + msgLen * 8);
  const msgBytes = bitsToBytes(msgBits);
  try {
    return bytesToText(msgBytes);
  } catch (e) {
    return "Failed to decode message";
  }
}

let animationId = null;
let startTime = null;
let currentMessage = "";
let currentSeed = 0;

const stegCanvas = document.createElement("canvas");
stegCanvas.width = w;
stegCanvas.height = h;
const stegCtx = stegCanvas.getContext("2d", { willReadFrequently: true });

let latestEmbeddedPixels = null;

function animate(time) {
  if (!startTime) startTime = time;
  const elapsed = (time - startTime) / 1000;

  renderJulia(currentSeed, elapsed);

  const pixels = getCanvasImageData();
  embedMessage(pixels, currentMessage);

  latestEmbeddedPixels = new Uint8Array(pixels);

  const imageData = stegCtx.createImageData(w, h);
  imageData.data.set(pixels);
  stegCtx.putImageData(imageData, 0, 0);

  animationId = requestAnimationFrame(animate);
}

document.getElementById("encodeBtn").onclick = () => {
  const text = document.getElementById("textInput").value.trim();
  if (!text) return alert("Please enter text.");

  currentMessage = text;
  currentSeed = hashStringToSeed(text);

  if (animationId) cancelAnimationFrame(animationId);
  startTime = null;
  animate(0);
};

document.getElementById("saveBtn").onclick = () => {
  if (!latestEmbeddedPixels || !currentMessage) {
    return alert("Please encode a message first!");
  }

  const saveCanvas = document.createElement("canvas");
  saveCanvas.width = w;
  saveCanvas.height = h;
  const saveCtx = saveCanvas.getContext("2d");

  const imageData = saveCtx.createImageData(w, h);
  imageData.data.set(latestEmbeddedPixels);
  saveCtx.putImageData(imageData, 0, 0);

  const a = document.createElement("a");
  a.href = saveCanvas.toDataURL("image/png");
  a.download = "fractal_cipher.png";
  a.click();
};

document.getElementById("decodeBtn").onclick = () => {
  if (!hasUploadedFile || !fileInput.files[0]) {
    return alert("Please upload an image first!");
  }

  const file = fileInput.files[0];
  const img = new Image();
  img.onload = () => {
    const decodeCanvas = document.createElement("canvas");
    decodeCanvas.width = w;
    decodeCanvas.height = h;
    const decodeCtx = decodeCanvas.getContext("2d");

    decodeCtx.drawImage(img, 0, 0, w, h);
    const imageData = decodeCtx.getImageData(0, 0, w, h);
    const msg = extractMessage(imageData.data);
    document.getElementById("decodedText").textContent = msg;
  };
  img.onerror = () => {
    alert("Failed to load image. Please try another file.");
  };
  img.src = URL.createObjectURL(file);
};

const fileInput = document.getElementById("fileInput");
let hasUploadedFile = false;

fileInput.addEventListener("change", () => {
  const fileNameSpan = document.querySelector(".file-name");
  if (fileInput.files.length > 0) {
    fileNameSpan.textContent = fileInput.files[0].name;
    hasUploadedFile = true;
  } else {
    fileNameSpan.textContent = "Choose Image";
    hasUploadedFile = false;
  }
});

const controls = document.querySelector(".controls");
controls.addEventListener("mousemove", (e) => {
  const rect = controls.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  controls.style.setProperty("--x", `${x}%`);
  controls.style.setProperty("--y", `${y}%`);
});
controls.addEventListener("mouseleave", () => {
  controls.style.setProperty("--x", `50%`);
  controls.style.setProperty("--y", `50%`);
});
