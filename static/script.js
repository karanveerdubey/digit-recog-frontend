// Elements
const canvas   = document.getElementById('handwriting-canvas');
const ctx      = canvas.getContext('2d');
const submitBtn= document.getElementById('submit-button');
const clearBtn = document.getElementById('clear-button');
const undoBtn  = document.getElementById('undo-button');
const outEl    = document.getElementById('prediction-result');

let drawing = false;
let history = [];
const MAX_HISTORY = 10;

// Initialize canvas with white background
function resetCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function saveState() {
  history.push(canvas.toDataURL());
  if (history.length > MAX_HISTORY) history.shift();
}

// Init
resetCanvas();
saveState();

// Pen style
ctx.lineWidth = 18;
ctx.lineJoin = 'round';
ctx.lineCap  = 'round';
ctx.strokeStyle = '#000000';

// Pointer utils
function getPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const e = evt.touches ? evt.touches[0] : evt;
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function startDraw(evt) {
  drawing = true;
  const { x, y } = getPos(evt);
  ctx.beginPath();
  ctx.moveTo(x, y);
  evt.preventDefault();
}
function moveDraw(evt) {
  if (!drawing) return;
  const { x, y } = getPos(evt);
  ctx.lineTo(x, y);
  ctx.stroke();
  evt.preventDefault();
}
function endDraw() {
  if (!drawing) return;
  drawing = false;
  saveState();
}

// Mouse
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', moveDraw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);

// Touch
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', moveDraw, { passive: false });
canvas.addEventListener('touchend', endDraw);

// Buttons
clearBtn.onclick = () => {
  resetCanvas();
  saveState();
  outEl.textContent = 'Canvas cleared';
};

undoBtn.onclick = () => {
  if (history.length <= 1) return;
  history.pop();
  const prev = history[history.length - 1];
  const img = new Image();
  img.onload = () => {
    resetCanvas();
    ctx.drawImage(img, 0, 0);
    outEl.textContent = 'Last stroke undone';
  };
  img.src = prev;
};

// Predict
submitBtn.onclick = async () => {
  try {
    outEl.textContent = 'Predicting…';
    const dataUrl = canvas.toDataURL('image/png');

    const res = await fetch(`${window.API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl })
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      outEl.textContent = `Error: ${json.error || res.statusText || 'request failed'}`;
      return;
    }

    if (typeof json.prediction === 'number') {
      outEl.textContent = `Prediction: ${json.prediction}`;
    } else {
      outEl.textContent = `Error: ${json.error || 'invalid response'}`;
    }
  } catch (e) {
    outEl.textContent = `Error: ${e.message}`;
  }
};
