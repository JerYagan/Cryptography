# 🌌 Fractal Bloom Cipher  
### AES-GCM Encryption + LSB Steganography + WebGL Fractals

Fractal Bloom Cipher is a visual cryptography tool that encrypts text using **AES-GCM**, then hides the encrypted bytes inside the **pixels of a generative WebGL fractal** (Julia set). The result is a beautiful fractal PNG that secretly contains your encrypted message.

Only someone with the correct password can extract and decrypt the hidden text.

---

## 🚀 Features

### 🔐 **AES-GCM Encryption**
Your message is encrypted using AES-256-GCM.  
Includes:
- PBKDF2 password stretching  
- Random 16-byte salt  
- Random 12-byte IV  
- Authentication tag for message integrity  

### 🎨 **Animated WebGL Julia Fractals**
The fractals are:
- Smooth shaded  
- Neon-colored  
- Time-animated  
- Seeded by your password, so each password creates a unique fractal signature  

### 🖼️ **LSB Steganography (Pixel-Level Hiding)**
Encrypted bytes are hidden inside the **least-significant bits** of the fractal’s RGB pixels.  
The image looks normal to the human eye, but embedded ciphertext can be extracted exactly.

### 📤 **PNG Export**
The encoded fractal is exported as a PNG containing hidden encrypted data.

### 📥 **Decode System**
Uploaded PNGs are scanned, the stego-data is extracted, and AES-GCM decryption returns the message if the correct password is provided.

### 🧪 **Advanced Technical Viewer**
Includes an optional section explaining:
- AES-GCM internal structure  
- PBKDF2 key derivation  
- Pixel bit embedding  
- Fractal seed generation  

### 🎛️ **Extra UI Features**
- Password visibility toggle  
- WebGL animation toggle  
- Metadata display (status, seed, message length, timestamps)  
- “How It Works” breakdown with icons + diagrams  

---

## 🛠️ Tech Stack

| Component | Technology |
|----------|------------|
| Fractal Rendering | WebGL + GLSL fragment shaders |
| Encryption | AES-256-GCM (Web Crypto API) |
| Key Derivation | PBKDF2 + SHA-256 |
| Steganography | RGB LSB encoding |
| UI | HTML, CSS (custom dark neon), JS |
| Export | PNG (Canvas) |

---

## 📘 How It Works (Short Version)

1. **Text → Bytes**  
   The message is converted into UTF-8 bytes.

2. **Password → AES Key**  
   PBKDF2 derives a strong AES-GCM key from the password.

3. **Encrypt**  
   The text becomes ciphertext + auth tag.

4. **Password → Fractal Seed**  
   The password also generates a deterministic seed for the fractal animation.

5. **Render Fractal**  
   A neon Julia set is drawn with WebGL.

6. **Hide Ciphertext in Pixels**  
   The encrypted bytes are embedded inside the pixel LSB bits.

7. **Export PNG**  
   The fractal PNG now contains encrypted data.

8. **Decode + Decrypt**  
   Extraction + AES-GCM decryption returns the original text (if password is correct).

---

## 🧩 Folder Structure

/
├─ index.html
├─ styles.css
├─ script.js
├─ assets/
│ └─ logo.svg
└─ generated/
└─ fractal_cipher.png (example output)


---

## 📦 Installation

Clone the repo:

```bash
git clone https://github.com/YOUR_USERNAME/fractal-bloom-cipher.git
cd fractal-bloom-cipher
