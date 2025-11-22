// === DOM: canvas & WebGL ==================================================
const canvas = document.getElementById("fractalCanvas");
const gl = canvas.getContext("webgl");
const w = canvas.width;
const h = canvas.height;

if (!gl) {
  alert("WebGL not supported in this browser.");
  throw new Error("WebGL not supported");
}

// === Shaders ==============================================================
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

const int MAX_ITER = 400;

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
    if (h < 60.0)       rgb = vec3(c, x, 0.0);
    else if (h < 120.0) rgb = vec3(x, c, 0.0);
    else if (h < 180.0) rgb = vec3(0.0, c, x);
    else if (h < 240.0) rgb = vec3(0.0, x, c);
    else if (h < 300.0) rgb = vec3(x, 0.0, c);
    else                rgb = vec3(c, 0.0, x);
    return rgb + m;
}

void main() {
    // Normalized coords centered at origin, aspect-correct
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / u_resolution.y;

    // Gentle camera motion based on time & seed
    float zoom = 1.4 + 0.25 * sin(u_time * 0.2 + u_seed * 10.0);
    float angle = 0.2 * sin(u_time * 0.15 + u_seed * 5.0);
    float ca = cos(angle);
    float sa = sin(angle);

    vec2 z = uv * zoom;
    z = vec2(
        z.x * ca - z.y * sa,
        z.x * sa + z.y * ca
    );

    // Julia parameter, slightly pulsing
    vec2 c = u_c +
             0.10 * vec2(
                 sin(u_time * 0.27 + u_seed * 3.0),
                 cos(u_time * 0.19 + u_seed * 7.0)
             );

    float iter = 0.0;
    float escapedIter = float(MAX_ITER);
    vec2 zEscaped = z;

    for (int i = 0; i < MAX_ITER; i++) {
        // z = z^2 + c
        vec2 z2 = vec2(
            z.x * z.x - z.y * z.y,
            2.0 * z.x * z.y
        ) + c;

        z = z2;

        if (dot(z, z) > 16.0 && escapedIter == float(MAX_ITER)) {
            escapedIter = float(i);
            zEscaped = z;
            break;
        }
    }

    float mu;
    if (escapedIter < float(MAX_ITER)) {
        float r = length(zEscaped);
        // smooth iteration count
        mu = escapedIter + 1.0 - log(log(r)) / log(2.0);
        mu = clamp(mu / float(MAX_ITER), 0.0, 1.0);
    } else {
        mu = 1.0; // inside set
    }

    // Domain coloring: hue from angle of z
    float ang = atan(z.y, z.x);          // [-pi, pi]
    float hue = (ang / 6.2831853 + 1.0); // [0,1]
    hue = fract(hue + 0.15 * sin(u_seed * 20.0));

    // Distance-ish term for glow
    float r = length(z);
    float edge = exp(-3.0 * abs(log(r)));

    // Base color from turbo on smooth mu
    vec3 base = turboColormap(pow(mu, 0.8));

    // Neon overlay from HSV with edge emphasis
    float v = 0.7 + 0.4 * edge;
    float s = 0.85;
    vec3 neon = hsvToRgb(hue * 360.0, s, v);

    // Mix them
    vec3 color = mix(base, neon, 0.55);

    // Vignette so it feels framed
    vec2 ndc = (gl_FragCoord.xy / u_resolution) * 2.0 - 1.0;
    float vignette = 1.0 - 0.25 * dot(ndc, ndc);
    color *= clamp(vignette, 0.65, 1.0);

    // Slight highlight on bright zones
    float brightness = (color.r + color.g + color.b) / 3.0;
    if (brightness > 0.75) {
        color *= 1.1;
    }

    gl_FragColor = vec4(color, 1.0);
}
`;


// === WebGL boilerplate ===================================================
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPLETE_STATUS) &&
      !gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

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

// === Text / bytes helpers ===============================================
function textToBytes(text) {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

function bytesToBits(bytes) {
  const bits = [];
  for (let byte of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  return bits;
}

function bitsToBytes(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | (bits[i + j] || 0);
    }
    bytes.push(b);
  }
  return new Uint8Array(bytes);
}

function concatBytes(...arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// === Hashing for fractal seed ===========================================
function hashStringToSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash / 0xffffffff;
}

// === AES-GCM + PBKDF2 encryption ========================================
async function deriveAesKey(passwordBytes, salt, usage) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    [usage]
  );
}

// Returns: [salt(16) | iv(12) | ciphertext(...)]
async function encryptMessage(plaintext, password) {
  const textBytes = textToBytes(plaintext);
  const passwordBytes = textToBytes(password);

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const key = await deriveAesKey(passwordBytes, salt, "encrypt");

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textBytes
  );

  const ciphertext = new Uint8Array(ciphertextBuf);
  return concatBytes(salt, iv, ciphertext);
}

async function decryptMessage(payloadBytes, password) {
  if (payloadBytes.length < 16 + 12 + 1) {
    throw new Error("Invalid encrypted payload.");
  }

  const salt = payloadBytes.slice(0, 16);
  const iv = payloadBytes.slice(16, 28);
  const ciphertext = payloadBytes.slice(28);

  const passwordBytes = textToBytes(password);
  const key = await deriveAesKey(passwordBytes, salt, "decrypt");

  const plaintextBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return bytesToText(new Uint8Array(plaintextBuf));
}

// === Fractal rendering ===================================================
function renderJulia(seed, timeSeconds = 0) {
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const baseCx = Math.sin(seed * 6.28318) * 0.7;
  const baseCy = Math.cos(seed * 6.28318) * 0.7;
  const cx = baseCx + 0.15 * Math.sin(timeSeconds * 0.4 + seed * 10.0);
  const cy = baseCy + 0.15 * Math.cos(timeSeconds * 0.6 + seed * 5.0);

  gl.uniform2f(resolutionLocation, w, h);
  gl.uniform2f(cLocation, cx, cy);
  gl.uniform1f(seedLocation, seed);
  gl.uniform1f(timeLocation, timeSeconds);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function getCanvasImageDataFlipped() {
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

// === Steganography: embed/extract bytes ==================================
function embedBytesIntoPixels(pixels, payloadBytes) {
  const len = payloadBytes.length;
  const lengthBytes = new Uint8Array([
    (len >>> 24) & 255,
    (len >>> 16) & 255,
    (len >>> 8) & 255,
    len & 255,
  ]);

  const lengthBits = bytesToBits(lengthBytes);
  const payloadBits = bytesToBits(payloadBytes);
  const allBits = lengthBits.concat(payloadBits);

  const capacity = (pixels.length / 4) * 3; // 3 channels per pixel
  if (allBits.length > capacity) {
    throw new Error("Message too long for this canvas size.");
  }

  let bitIndex = 0;
  for (let i = 0; i < pixels.length && bitIndex < allBits.length; i += 4) {
    for (let j = 0; j < 3 && bitIndex < allBits.length; j++) {
      pixels[i + j] = (pixels[i + j] & 0xfe) | allBits[bitIndex++];
    }
  }
}

function extractBytesFromPixels(pixels) {
  const bits = [];
  for (let i = 0; i < pixels.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      bits.push(pixels[i + j] & 1);
    }
  }

  const lengthBits = bits.slice(0, 32);
  const lenBytes = bitsToBytes(lengthBits);
  const msgLen =
    (lenBytes[0] << 24) |
    (lenBytes[1] << 16) |
    (lenBytes[2] << 8) |
    lenBytes[3];

  if (msgLen <= 0 || msgLen > 1_000_000) {
    throw new Error("Invalid or no message found.");
  }

  const totalMsgBits = msgLen * 8;
  if (32 + totalMsgBits > bits.length) {
    throw new Error("Message truncated or corrupt.");
  }

  const msgBits = bits.slice(32, 32 + totalMsgBits);
  return bitsToBytes(msgBits);
}

// === State & offscreen canvas ===========================================
let animationEnabled = true;
let animationId = null;
let startTime = null;

let currentSeed = hashStringToSeed("FractalBloom");
let currentPayload = null; // Uint8Array of encrypted data
let latestEmbeddedPixels = null;

// hidden canvas used only for saving
const stegCanvas = document.createElement("canvas");
stegCanvas.width = w;
stegCanvas.height = h;
const stegCtx = stegCanvas.getContext("2d", { willReadFrequently: true });

// metadata state
let metadata = {
  status: "Idle",
  length: 0,
  seed: null,
  encodedAt: null,
  encryption: "AES-GCM + LSB steganography",
};

// === DOM references ======================================================
const textInput = document.getElementById("textInput");
const passwordInput = document.getElementById("passwordInput");
const encodeBtn = document.getElementById("encodeBtn");
const saveBtn = document.getElementById("saveBtn");
const decodeBtn = document.getElementById("decodeBtn");
const fileInput = document.getElementById("fileInput");
const decodedTextEl = document.getElementById("decodedText");

const passwordToggle = document.getElementById("passwordToggle");
const passwordToggleIcon = document.getElementById("passwordToggleIcon");

const animationToggle = document.getElementById("animationToggle");
const animationToggleLabel = document.getElementById("animationToggleLabel");

// metadata DOM
const metaStatusEl = document.getElementById("metaStatus");
const metaLengthEl = document.getElementById("metaLength");
const metaSeedEl = document.getElementById("metaSeed");
const metaTimeEl = document.getElementById("metaTime");
const metaEncryptionEl = document.getElementById("metaEncryption");

let hasUploadedFile = false;

// === Metadata helpers ====================================================
function formatDateTime(date) {
  if (!date) return "–";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function updateMetadata() {
  metaStatusEl.textContent = metadata.status || "–";
  metaLengthEl.textContent =
    metadata.length && metadata.length > 0 ? `${metadata.length} chars` : "–";
  metaSeedEl.textContent =
    metadata.seed !== null ? metadata.seed.toFixed(6) : "–";
  metaTimeEl.textContent = formatDateTime(metadata.encodedAt);
  metaEncryptionEl.textContent = metadata.encryption || "–";
}

// === Rendering frames + animation loop ==================================
function renderFrame(elapsedSeconds = 0) {
  // draw fractal to visible WebGL canvas
  renderJulia(currentSeed, elapsedSeconds);

  // if we have payload, embed into a copy and stash for saving
  if (currentPayload) {
    const pixels = getCanvasImageDataFlipped();
    try {
      embedBytesIntoPixels(pixels, currentPayload);
    } catch (err) {
      console.error(err);
      alert(err.message);
      return;
    }

    latestEmbeddedPixels = new Uint8Array(pixels);

    const imageData = stegCtx.createImageData(w, h);
    imageData.data.set(pixels);
    stegCtx.putImageData(imageData, 0, 0);
  } else {
    latestEmbeddedPixels = null;
  }
}

function animationLoop(timeMs) {
  if (!animationEnabled) {
    animationId = null;
    return;
  }
  if (startTime === null) startTime = timeMs;
  const elapsed = (timeMs - startTime) / 1000;
  renderFrame(elapsed);
  animationId = requestAnimationFrame(animationLoop);
}

// === UI helpers: animation toggle & password toggle ======================
function updateAnimationToggleUI() {
  if (animationEnabled) {
    animationToggle.classList.add("switch-on");
    animationToggleLabel.textContent = "On";
  } else {
    animationToggle.classList.remove("switch-on");
    animationToggleLabel.textContent = "Off";
  }
}

passwordToggle.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  passwordToggleIcon.textContent = isPassword ? "visibility" : "visibility_off";
});

// animation toggle
animationToggle.addEventListener("click", () => {
  animationEnabled = !animationEnabled;
  if (!animationEnabled && animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  } else if (animationEnabled) {
    startTime = null;
    animationLoop(0);
  }
  updateAnimationToggleUI();
});

// === Encode handler ======================================================
encodeBtn.onclick = async () => {
  const text = textInput.value.trim();
  const password = passwordInput.value.trim();

  if (!text) {
    alert("Please enter text to encode.");
    return;
  }
  if (!password) {
    alert("Please enter a password.");
    return;
  }

  try {
    const encryptedPayload = await encryptMessage(text, password);
    currentPayload = encryptedPayload;
    currentSeed = hashStringToSeed(password);

    metadata = {
      ...metadata,
      status: "Encrypted & embedded into fractal",
      length: text.length,
      seed: currentSeed,
      encodedAt: new Date(),
    };
    updateMetadata();

    decodedTextEl.textContent = "";

    if (animationEnabled) {
      if (animationId) cancelAnimationFrame(animationId);
      startTime = null;
      animationLoop(0);
    } else {
      // static frame only
      renderFrame(0);
    }
  } catch (err) {
    console.error(err);
    alert("Failed to encrypt or encode message.");
  }
};

// === Save PNG handler ====================================================
saveBtn.onclick = () => {
  if (!currentPayload || !latestEmbeddedPixels) {
    alert("Please encode a message first.");
    return;
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

// === Decode handler ======================================================
decodeBtn.onclick = async () => {
  if (!hasUploadedFile || !fileInput.files[0]) {
    alert("Please upload an image first.");
    return;
  }

  const password = passwordInput.value.trim();
  if (!password) {
    alert("Please enter the password to decode.");
    return;
  }

  const file = fileInput.files[0];
  const img = new Image();

  img.onload = async () => {
    const decodeCanvas = document.createElement("canvas");
    decodeCanvas.width = w;
    decodeCanvas.height = h;
    const decodeCtx = decodeCanvas.getContext("2d");

    decodeCtx.drawImage(img, 0, 0, w, h);
    const imageData = decodeCtx.getImageData(0, 0, w, h);

    try {
      const payloadBytes = extractBytesFromPixels(imageData.data);
      const plaintext = await decryptMessage(payloadBytes, password);
      decodedTextEl.textContent = plaintext;

      metadata = {
        ...metadata,
        status: "Decrypted successfully",
        length: plaintext.length,
        encodedAt: new Date(),
      };
      updateMetadata();
    } catch (err) {
      console.error(err);
      alert("Wrong password or corrupted image.");
      decodedTextEl.textContent = "";
      metadata = {
        ...metadata,
        status: "Decode error / wrong password",
        encodedAt: new Date(),
      };
      updateMetadata();
    }
  };

  img.onerror = () => {
    alert("Failed to load image. Please try another file.");
  };

  img.src = URL.createObjectURL(file);
};

// === File input change ===================================================
fileInput.addEventListener("change", () => {
  const fileNameSpan = document.querySelector(".file-name");
  if (fileInput.files.length > 0) {
    fileNameSpan.textContent = fileInput.files[0].name;
    hasUploadedFile = true;
  } else {
    fileNameSpan.textContent = "Choose image";
    hasUploadedFile = false;
  }
});

// === Gradient-follow effect on controls ==================================
const controlsEl = document.querySelector(".controls");
if (controlsEl) {
  controlsEl.addEventListener("mousemove", (e) => {
    const rect = controlsEl.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    controlsEl.style.setProperty("--x", `${x}%`);
    controlsEl.style.setProperty("--y", `${y}%`);
  });

  controlsEl.addEventListener("mouseleave", () => {
    controlsEl.style.setProperty("--x", `50%`);
    controlsEl.style.setProperty("--y", `50%`);
  });
}

// === Initial render ======================================================
updateMetadata();
renderFrame(0);
animationEnabled = true;
updateAnimationToggleUI();
animationLoop(0);