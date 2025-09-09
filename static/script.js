// ----- Canvas setup -----
const canvas = document.getElementById('handwriting-canvas');
const ctx = canvas.getContext('2d');
const submitBtn = document.getElementById('submit-button');
const undoBtn   = document.getElementById('undo-button');
const clearBtn  = document.getElementById('clear-button');
const outEl     = document.getElementById('prediction-result');
const starsEl   = document.getElementById('stars-container');

let drawing = false;
let history = [];   // dataURL history for undo
const MAX_HISTORY = 10;

// white background so PNG alpha doesn't break preprocessing
function resetCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function saveState() {
  history.push(canvas.toDataURL());
  if (history.length > MAX_HISTORY) history.shift();
}

// initial paint + first snapshot
resetCanvas();
saveState();

// drawing style
ctx.lineWidth = 18;
ctx.lineJoin = 'round';
ctx.lineCap  = 'round';
ctx.strokeStyle = '#000000';

// ----- Pointer events (mouse + touch) -----
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

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', moveDraw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);

canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', moveDraw, { passive: false });
canvas.addEventListener('touchend', endDraw);

// ----- Buttons -----
clearBtn.onclick = () => {
  resetCanvas();
  saveState();
  outEl.textContent = 'Canvas cleared';
};

undoBtn.onclick = () => {
  if (history.length <= 1) return;         // keep at least one state
  history.pop();                            // discard current
  const prev = history[history.length - 1];
  const img = new Image();
  img.onload = () => {
    resetCanvas();
    ctx.drawImage(img, 0, 0);
    outEl.textContent = 'Last stroke undone';
  };
  img.src = prev;
};

// simple celebratory star burst
function burst() {
  starsEl.innerHTML = '';
  const n = 18;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.setProperty('--tx', (Math.random() * 2 - 1) * 140 + 'px');
    s.style.setProperty('--ty', (Math.random() * 2 - 1) * 140 + 'px');
    starsEl.appendChild(s);
  }
  setTimeout(() => starsEl.innerHTML = '', 900);
}

// ----- Predict -----
submitBtn.onclick = async () => {
  try {
    outEl.textContent = 'Predicting…';
    const dataUrl = canvas.toDataURL('image/png'); // "data:image/png;base64,...."

    const res = await fetch(`${window.API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl })
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      outEl.textContent = `Error: ${json.error || 'request failed'}`;
      return;
    }

    if (typeof json.prediction === 'number') {
      outEl.textContent = `Prediction: ${json.prediction}`;
      burst();
    } else {
      outEl.textContent = `Error: ${json.error || 'invalid response'}`;
    }
  } catch (e) {
    outEl.textContent = `Error: ${e.message}`;
  }
};
