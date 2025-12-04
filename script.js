// ========= DOM HOOKS =========

const canvas = document.getElementById("fractalCanvas");
const gl = canvas.getContext("webgl");
const w = canvas.width;
const h = canvas.height;

if (!gl) {
  alert("WebGL not supported in this browser.");
  throw new Error("WebGL not supported");
}

// Encode/Decode UI
const textInput = document.getElementById("textInput");
const passwordInput = document.getElementById("passwordInput");
const passwordToggle = document.getElementById("passwordToggle");
const passwordToggleIcon = document.getElementById("passwordToggleIcon");

const encodeBtn = document.getElementById("encodeBtn");
const saveBtn = document.getElementById("saveBtn");
const decodeBtn = document.getElementById("decodeBtn");

const fileInput = document.getElementById("fileInput");
const fileNameSpan = document.querySelector(".file-name");
const decodedTextEl = document.getElementById("decodedText");

// Decode password
const decodePasswordInput = document.getElementById("decodePasswordInput");
const decodePasswordToggle = document.getElementById("decodePasswordToggle");
const decodePasswordToggleIcon = document.getElementById("decodePasswordToggleIcon");

// Sidebar animation toggle
const animationToggle = document.getElementById("animationToggle");
const animationToggleLabel = document.getElementById("animationToggleLabel");

// Metadata
const metaStatus = document.getElementById("metaStatus");
const metaEncryption = document.getElementById("metaEncryption");
const metaLength = document.getElementById("metaLength");
const metaSeed = document.getElementById("metaSeed");
const metaTime = document.getElementById("metaTime");

// Controls card (for gradient follow)
const controlsCard = document.querySelector(".controls");

// ========= WEBGL SHADERS =========

const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Smooth, neon Julia shader
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

// ========= WEBGL SETUP =========

function createShader(glCtx, type, source) {
  const shader = glCtx.createShader(type);
  glCtx.shaderSource(shader, source);
  glCtx.compileShader(shader);
  if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
    console.error(glCtx.getShaderInfoLog(shader));
    glCtx.deleteShader(shader);
    throw new Error("Shader compile failed");
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
  throw new Error("Program link failed");
}

gl.useProgram(program);

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

// ========= UTILS: BYTES / BITS / TEXT =========

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBits(bytes) {
  const bits = [];
  for (let b of bytes) {
    for (let i = 7; i >= 0; i--) {
      bits.push((b >> i) & 1);
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

// Hash string → seed in [0,1]
function hashStringToSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash / 0xffffffff;
}

// ========= SIMPLE XOR CIPHER =========

// Encrypt plaintext → Uint8Array of XOR ciphertext
function xorEncryptMessage(plaintext, password) {
  const textBytes = textEncoder.encode(plaintext);
  const passBytes = textEncoder.encode(password);
  const out = new Uint8Array(textBytes.length);

  for (let i = 0; i < textBytes.length; i++) {
    out[i] = textBytes[i] ^ passBytes[i % passBytes.length];
  }
  return out;
}

// Decrypt Uint8Array payload → plaintext string
function xorDecryptMessage(payloadBytes, password) {
  const passBytes = textEncoder.encode(password);
  const out = new Uint8Array(payloadBytes.length);

  for (let i = 0; i < payloadBytes.length; i++) {
    out[i] = payloadBytes[i] ^ passBytes[i % passBytes.length];
  }
  return textDecoder.decode(out);
}

// ========= STEGO: EMBED / EXTRACT =========

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

// Embed payload bytes into pixel RGB LSBs.
// Layout: [4-byte length][payload bytes...]
function embedBytesIntoPixels(pixels, payload) {
  const length = payload.length;
  const header = new Uint8Array(4);
  header[0] = (length >>> 24) & 0xff;
  header[1] = (length >>> 16) & 0xff;
  header[2] = (length >>> 8) & 0xff;
  header[3] = length & 0xff;

  const all = new Uint8Array(4 + length);
  all.set(header, 0);
  all.set(payload, 4);

  const bits = bytesToBits(all);
  const capacityBits = Math.floor(pixels.length / 4) * 3;
  if (bits.length > capacityBits) {
    throw new Error("Message too large for this image resolution.");
  }

  let bitIndex = 0;
  for (let i = 0; i < pixels.length && bitIndex < bits.length; i += 4) {
    for (let j = 0; j < 3 && bitIndex < bits.length; j++) {
      pixels[i + j] = (pixels[i + j] & 0xfe) | bits[bitIndex++];
    }
  }

  return pixels;
}

function extractPayloadFromPixels(pixels) {
  const bits = [];
  for (let i = 0; i < pixels.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      bits.push(pixels[i + j] & 1);
    }
  }

  const headerBits = bits.slice(0, 32);
  const headerBytes = bitsToBytes(headerBits);
  const length =
    (headerBytes[0] << 24) |
    (headerBytes[1] << 16) |
    (headerBytes[2] << 8) |
    headerBytes[3];

  if (length <= 0 || length > 1000000) {
    throw new Error("Invalid or no embedded message.");
  }

  const payloadBits = bits.slice(32, 32 + length * 8);
  const payloadBytes = bitsToBytes(payloadBits);
  return payloadBytes;
}

// ========= FRACTAL RENDERING =========

let animationId = null;
let startTime = null;
let animationEnabled = true;

let currentSeed = 0;
let currentPayload = null; // Uint8Array of XOR ciphertext
let latestEmbeddedPixels = null;

// Offscreen canvas for stego preview / saving
const stegCanvas = document.createElement("canvas");
stegCanvas.width = w;
stegCanvas.height = h;
const stegCtx = stegCanvas.getContext("2d", { willReadFrequently: true });

function renderJulia(seed, timeSeconds) {
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // Base c influenced by seed
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

// Render one frame (animated or static) and update stego canvas
function renderFrame(elapsedSeconds = 0) {
  const t = animationEnabled ? elapsedSeconds : 0;
  renderJulia(currentSeed, t);

  if (currentPayload) {
    const pixels = getCanvasImageDataFlipped();
    try {
      embedBytesIntoPixels(pixels, currentPayload);
      latestEmbeddedPixels = new Uint8Array(pixels);

      const imageData = stegCtx.createImageData(w, h);
      imageData.data.set(pixels);
      stegCtx.putImageData(imageData, 0, 0);
    } catch (err) {
      console.error(err);
      metaStatus.textContent = "Error: " + err.message;
    }
  }
}

function animationLoop(timestamp) {
  if (!startTime) startTime = timestamp;
  const elapsed = (timestamp - startTime) / 1000;

  renderFrame(elapsed);

  if (animationEnabled) {
    animationId = requestAnimationFrame(animationLoop);
  } else {
    animationId = null;
  }
}

// ========= UI HANDLERS =========

// Encode password eye toggle
if (passwordToggle && passwordToggleIcon) {
  passwordToggle.addEventListener("click", () => {
    if (!passwordInput) return;
    passwordInput.type =
      passwordInput.type === "password" ? "text" : "password";
    passwordToggleIcon.textContent =
      passwordInput.type === "password" ? "visibility_off" : "visibility";
  });
}

// Decode password eye toggle
if (decodePasswordToggle && decodePasswordToggleIcon && decodePasswordInput) {
  decodePasswordToggle.addEventListener("click", () => {
    decodePasswordInput.type =
      decodePasswordInput.type === "password" ? "text" : "password";
    decodePasswordToggleIcon.textContent =
      decodePasswordInput.type === "password"
        ? "visibility_off"
        : "visibility";
  });
}

// Animation toggle
function updateAnimationToggleUI() {
  if (!animationToggle || !animationToggleLabel) return;
  if (animationEnabled) {
    animationToggle.classList.add("switch-on");
    animationToggleLabel.textContent = "On";
  } else {
    animationToggle.classList.remove("switch-on");
    animationToggleLabel.textContent = "Off";
  }
}

if (animationToggle) {
  animationToggle.addEventListener("click", () => {
    animationEnabled = !animationEnabled;
    updateAnimationToggleUI();

    if (animationEnabled) {
      startTime = null;
      if (!animationId) animationLoop(0);
    } else {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      renderFrame(0);
    }
  });
}

// Controls card gradient follow
if (controlsCard) {
  controlsCard.addEventListener("mousemove", (e) => {
    const rect = controlsCard.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    controlsCard.style.setProperty("--x", `${x}%`);
    controlsCard.style.setProperty("--y", `${y}%`);
  });
  controlsCard.addEventListener("mouseleave", () => {
    controlsCard.style.setProperty("--x", `50%`);
    controlsCard.style.setProperty("--y", `50%`);
  });
}

// File input label
let hasUploadedFile = false;
if (fileInput && fileNameSpan) {
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files.length > 0) {
      fileNameSpan.textContent = fileInput.files[0].name;
      hasUploadedFile = true;
    } else {
      fileNameSpan.textContent = "Choose image";
      hasUploadedFile = false;
    }
  });
}

// ========= ENCODE BUTTON =========

if (encodeBtn) {
  encodeBtn.addEventListener("click", () => {
    const plain = (textInput?.value || "").trim();
    const password = (passwordInput?.value || "").trim();

    if (!plain) {
      alert("Please enter some text to encode.");
      return;
    }
    if (!password) {
      alert("Please enter a password.");
      return;
    }

    try {
      metaStatus.textContent = "Encrypting with XOR...";
      const payload = xorEncryptMessage(plain, password);
      currentPayload = payload;
      currentSeed = hashStringToSeed(password);

      // restart animation loop
      if (animationId) cancelAnimationFrame(animationId);
      startTime = null;
      if (animationEnabled) {
        animationLoop(0);
      } else {
        renderFrame(0);
      }

      // Update metadata
      metaStatus.textContent = "Encoded";
      showBanner("success", "XOR-encrypted and embedded successfully!");
      metaEncryption.textContent = "XOR cipher + LSB steganography";
      metaLength.textContent = plain.length.toString();
      metaSeed.textContent = currentSeed.toFixed(5);
      metaTime.textContent = new Date().toLocaleString();

      // Clear input fields after encoding
      if (textInput) textInput.value = "";
      if (passwordInput) {
        passwordInput.value = "";
        passwordInput.type = "password";
      }
      if (passwordToggleIcon) {
        passwordToggleIcon.textContent = "visibility_off";
      }

      // Optional: clear decoded area & decode password
      if (decodedTextEl) decodedTextEl.textContent = "";
      if (decodePasswordInput) decodePasswordInput.value = "";
    } catch (err) {
      console.error(err);
      metaStatus.textContent = "Error during XOR encryption";
      showBanner("error", "Failed to encrypt message.");
      alert("Failed to encrypt message.");
    }
  });
}

// ========= SAVE PNG BUTTON =========

if (saveBtn) {
  saveBtn.addEventListener("click", () => {
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

    metaStatus.textContent = "PNG exported";
    metaTime.textContent = new Date().toLocaleString();
  });
}

// ========= DECODE BUTTON =========

if (decodeBtn) {
  decodeBtn.addEventListener("click", () => {
    if (!hasUploadedFile || !fileInput || !fileInput.files || !fileInput.files[0]) {
      alert("Please upload a PNG fractal first.");
      return;
    }

    const password = (decodePasswordInput?.value || "").trim();
    if (!password) {
      showBanner("error", "Password required to decrypt.");
      return;
    }

    const file = fileInput.files[0];
    const img = new Image();
    img.onload = async () => {
      try {
        const decodeCanvas = document.createElement("canvas");
        decodeCanvas.width = w;
        decodeCanvas.height = h;
        const decodeCtx = decodeCanvas.getContext("2d");

        decodeCtx.drawImage(img, 0, 0, w, h);
        const imageData = decodeCtx.getImageData(0, 0, w, h);

        // Extract embedded payload
        const payloadBytes = extractPayloadFromPixels(imageData.data);

        // XOR decrypt
        let plaintext;
        try {
          plaintext = xorDecryptMessage(payloadBytes, password);
        } catch (e) {
          showBanner("error", "Failed to decode text.");
          decodedTextEl.textContent = "Failed to decode text.";
          metaStatus.textContent = "Decrypt failed";
          metaTime.textContent = new Date().toLocaleString();
          return;
        }

        decodedTextEl.textContent = plaintext || "[Empty / invalid text]";
        showBanner("success", "Message decrypted!");
        metaStatus.textContent = "Decoded successfully";
        metaLength.textContent = (plaintext || "").length.toString();
        metaTime.textContent = new Date().toLocaleString();
      } catch (err) {
        console.error(err);
        showBanner("error", "Wrong password or corrupted image!");
        decodedTextEl.textContent = "Wrong password or corrupted image.";
        metaStatus.textContent = "Decrypt failed";
        metaTime.textContent = new Date().toLocaleString();
      }
    };
    img.onerror = () => {
      alert("Failed to load image. Try another PNG.");
    };
    img.src = URL.createObjectURL(file);
  });
}

// ========= INITIALIZE =========

// Start with some default fractal (no payload yet)
currentSeed = hashStringToSeed("default-seed");
metaStatus.textContent = "Idle";
metaEncryption.textContent = "XOR cipher + LSB steganography";
metaLength.textContent = "–";
metaSeed.textContent = "–";
metaTime.textContent = "–";

updateAnimationToggleUI();
animationLoop(0);

function showBanner(type, message) {
  const banner = document.getElementById("floatingBanner");
  const icon = document.getElementById("floatingBannerIcon");
  const text = document.getElementById("floatingBannerText");

  // Reset classes
  banner.classList.remove("hidden", "success", "error", "show");

  text.textContent = message;

  if (type === "success") {
    banner.classList.add("success");
    icon.textContent = "check_circle";
  } else {
    banner.classList.add("error");
    icon.textContent = "error";
  }

  // Show banner
  setTimeout(() => banner.classList.add("show"), 10);

  // Auto-hide
  setTimeout(() => {
    banner.classList.remove("show");
    setTimeout(() => banner.classList.add("hidden"), 400);
  }, 3000);
}