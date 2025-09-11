const canvas   = document.getElementById('handwriting-canvas');
const ctx      = canvas.getContext('2d');
const submitBtn= document.getElementById('submit-button');
const clearBtn = document.getElementById('clear-button');
const undoBtn  = document.getElementById('undo-button');
const outEl    = document.getElementById('prediction-result');

let drawing = false;
let history = [];
const MAX_HISTORY = 10;

// ---------- Canvas boot ----------
function resetCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
function saveState() {
  history.push(canvas.toDataURL('image/png'));
  if (history.length > MAX_HISTORY) history.shift();
}
resetCanvas();
saveState();

// Brush
ctx.lineWidth = 15;
ctx.lineJoin = 'round';
ctx.lineCap  = 'round';
ctx.strokeStyle = '#000000';

// ---------- Pointer handling ----------
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
canvas.addEventListener('touchmove',  moveDraw,  { passive: false });
canvas.addEventListener('touchend',   endDraw);

// ---------- Buttons ----------
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

// ---------- Helpers ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function setDisabled(disabled) {
  submitBtn.disabled = disabled;
  clearBtn.disabled  = disabled;
  undoBtn.disabled   = disabled;
}

function isBlankCanvas(threshold = 0.98) {
  // returns true if >= threshold of pixels are near white
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let whiteish = 0;
  for (let i = 0; i < img.length; i += 4) {
    // simple luma; treat as white if all channels > 245
    if (img[i] > 245 && img[i+1] > 245 && img[i+2] > 245) whiteish++;
  }
  const frac = whiteish / (img.length / 4);
  return frac >= threshold;
}

async function warm() {
  // Wake service; try /ready then /health; tolerate timeouts
  const paths = ['/ready', '/health'];
  for (const p of paths) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(`${window.API_BASE}${p}?ts=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (r.ok) return true;
    } catch (_) {
      clearTimeout(t);
    }
  }
  return false;
}

async function postPredict(dataUrl, tries = 2, topk = 3) {
  const url = `${window.API_BASE}/predict?topk=${topk}`;
  const doFetch = () => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // simple request → no preflight
    body: dataUrl,
    cache: 'no-store'
  });
  try {
    const res = await doFetch();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (tries > 1) {
      await sleep(1200);
      return postPredict(dataUrl, tries - 1, topk);
    }
    throw e;
  }
}

function renderResult(json) {
  if (typeof json.prediction === 'number') {
    const confPct = json.confidence != null ? ` (${(json.confidence*100).toFixed(1)}%)` : '';
    let line = `Prediction: ${json.prediction}${confPct}`;
    if (Array.isArray(json.top) && json.top.length > 1) {
      const alts = json.top.slice(1).map(t => `${t.digit} ${(t.p*100).toFixed(0)}%`).join('  ·  ');
      if (alts) line += `\nAlternates: ${alts}`;
    }
    outEl.textContent = line;
  } else {
    outEl.textContent = `Error: ${json.error || 'invalid response'}`;
  }
}

// ---------- Predict ----------
submitBtn.onclick = async () => {
  try {
    if (isBlankCanvas()) {
      outEl.textContent = 'Draw a digit first';
      return;
    }
    setDisabled(true);

    outEl.textContent = 'Warming…';
    await warm();

    outEl.textContent = 'Predicting…';
    const dataUrl = canvas.toDataURL('image/png');
    const json = await postPredict(dataUrl, 2, 3);
    renderResult(json);
  } catch (e) {
    outEl.textContent = `Error: ${e.message || 'Load failed'}`;
  } finally {
    setDisabled(false);
  }
};

// Optional: keep warm while the page is OPEN (does not stop scale-to-zero over long idle)
setInterval(() => {
  fetch(`${window.API_BASE}/health?ts=${Date.now()}`, { cache: 'no-store' }).catch(() => {});
}, 8 * 60 * 1000);
