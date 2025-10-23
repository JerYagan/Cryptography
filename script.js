const canvas = document.getElementById("fractalCanvas");
const ctx = canvas.getContext("2d");
const w = canvas.width,
  h = canvas.height;

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

// Deterministic hash → numeric seed
function hashStringToSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash / 0xffffffff;
}

function drawJulia(message) {
  const seed = hashStringToSeed(message);
  const cx = Math.sin(seed * 6.28) * 0.7;
  const cy = Math.cos(seed * 6.28) * 0.7;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let zx = (3.0 * (x - w / 2)) / w;
      let zy = (3.0 * (y - h / 2)) / h;
      let i = 0;
      while (zx * zx + zy * zy < 4 && i < 200) {
        const tmp = zx * zx - zy * zy + cx;
        zy = 2.0 * zx * zy + cy;
        zx = tmp;
        i++;
      }
      const idx = (y * w + x) * 4;
      const hue = (i / 200) * 360;
      const color = hsvToRgb(hue, 1, i < 200 ? 1 : 0);
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return img;
}

// HSV → RGB
function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

// LSB embedding
function embedMessage(imgData, message) {
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
  const data = imgData.data;

  let bitIndex = 0;
  for (let i = 0; i < data.length; i += 4) {
    for (let j = 0; j < 3; j++) {
      if (bitIndex < bits.length) {
        data[i + j] = (data[i + j] & 0xfe) | bits[bitIndex++];
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function extractMessage(imgData) {
  const data = imgData.data;
  const bits = [];
  for (let i = 0; i < data.length; i += 4)
    for (let j = 0; j < 3; j++) bits.push(data[i + j] & 1);
  const lengthBits = bits.slice(0, 32);
  const lenBytes = bitsToBytes(lengthBits);
  const msgLen =
    (lenBytes[0] << 24) |
    (lenBytes[1] << 16) |
    (lenBytes[2] << 8) |
    lenBytes[3];
  const msgBits = bits.slice(32, 32 + msgLen * 8);
  const msgBytes = bitsToBytes(msgBits);
  return bytesToText(msgBytes);
}

// Event: Encode
document.getElementById("encodeBtn").onclick = () => {
  const text = document.getElementById("textInput").value.trim();
  if (!text) return alert("Please enter text.");
  const img = drawJulia(text);
  embedMessage(img, text);
};

// Event: Save
document.getElementById("saveBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "fractal_cipher.png";
  a.click();
};

// Event: Decode
document.getElementById("decodeBtn").onclick = () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("Upload an image first.");
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const msg = extractMessage(imgData);
    document.getElementById("decodedText").textContent =
      msg;
  };
  img.src = URL.createObjectURL(file);
};

// Hover effect
const controls = document.querySelector('.controls');

controls.addEventListener('mousemove', e => {
  const rect = controls.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  controls.style.setProperty('--x', `${x}%`);
  controls.style.setProperty('--y', `${y}%`);
});

controls.addEventListener('mouseleave', () => {
  controls.style.setProperty('--x', `50%`);
  controls.style.setProperty('--y', `50%`);
});

// File input label click
const fileInput = document.getElementById('fileInput');
const fileNameSpan = document.querySelector('.file-name');

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    const fileName = fileInput.files[0].name;
    fileNameSpan.textContent = fileName;
  } else {
    fileNameSpan.textContent = 'Choose Image';
  }
});

