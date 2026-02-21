// =========================
// Backend placeholders
// =========================
// Replace BACKEND_BASE_URL if your API is hosted elsewhere.
const BACKEND_BASE_URL = 'https://phonebox-bac-git-546130-matthewvincentthomasmalone-ops-projects.vercel.app';
const WS_URL = `${BACKEND_BASE_URL.replace('https://', 'wss://')}/ws`;
const ANSWER_API_URL = `${BACKEND_BASE_URL}/api/answer`;
const HANGUP_API_URL = `${BACKEND_BASE_URL}/api/hangup`;

const ENDPOINTS = [
  { number: '+61851246362', displayNumber: '+61 8 5124 6362', businessName: "Wesley and Co’s Locks Ipswich", messageLabel: 'Wesley welcome message' },
  { number: '+61485016964', displayNumber: '+61 485 016 964', businessName: 'Family Smiths Northside', messageLabel: 'Family Smiths intro' },
  { number: '+61485012051', displayNumber: '+61 485 012 051', businessName: "Golden Locksmith’s CBD", messageLabel: 'Golden CBD greeting' },
  { number: '+61485025767', displayNumber: '+61 485 025 767', businessName: "Wagner’s Southside Locksmiths", messageLabel: 'Wagner Southside message' },
  { number: '+61485027225', displayNumber: '+61 485 027 225', businessName: "Southside Sam’s Locksmithing", messageLabel: 'Southside Sam welcome' }
];

const IDLE_STATE = 'idle';
const MAX_LOG_ITEMS = 20;
const stateByNumber = new Map();
let socket;
let ringMuted = false;

const endpointGrid = document.getElementById('endpointGrid');
const eventLog = document.getElementById('eventLog');
const muteToggle = document.getElementById('muteToggle');
const resetBtn = document.getElementById('resetBtn');
const ringAudio = document.getElementById('ringAudio');

initializeState();
renderTiles();
connectWebSocket();

muteToggle.addEventListener('click', toggleMute);
resetBtn.addEventListener('click', resetAll);

setInterval(() => {
  const shouldPlayRing = ENDPOINTS.some((endpoint) => stateByNumber.get(endpoint.number)?.status === 'ringing');

  if (!ringMuted && shouldPlayRing) {
    tryPlayRing();
  } else {
    stopRing();
  }

  renderTiles();
}, 500);

function initializeState() {
  ENDPOINTS.forEach((endpoint) => {
    stateByNumber.set(endpoint.number, {
      status: IDLE_STATE,
      callSid: null,
      ringingSince: null,
      answeredAt: null,
      lastRingTime: null,
      callDurationSec: 0,
      callsToday: 0,
      errorMessage: ''
    });
  });
}

function renderTiles() {
  endpointGrid.innerHTML = '';

  ENDPOINTS.forEach((endpoint) => {
    const entry = stateByNumber.get(endpoint.number);
    const tile = document.createElement('article');
    tile.className = `tile ${entry.status}`;
    if (entry.status === 'ringing') tile.classList.add('ringing');

    const statusText = readableStatus(entry.status);
    const ringSeconds = entry.ringingSince ? Math.floor((Date.now() - entry.ringingSince) / 1000) : 0;

    tile.innerHTML = `
      <div class="tile-head">
        <div class="business">${endpoint.businessName}</div>
      </div>
      <div class="number">${endpoint.displayNumber}</div>
      <div class="status-row status-${entry.status}">
        <span class="status-chip"><span class="signal-icon"></span>${statusText}</span>
        <span>${entry.status === 'ringing' ? `Ringing ${ringSeconds}s` : ''}</span>
      </div>
      <div class="actions-row">
        <button class="action-btn answer-btn" ${entry.status === 'ringing' ? '' : 'disabled'}>Answer</button>
        <button class="action-btn hangup-btn" ${(entry.status === 'answered' || entry.status === 'answering') ? '' : 'disabled'}>Terminate</button>
      </div>
      <div class="action-hint">${actionHint(entry.status, endpoint.messageLabel)}</div>
      <div class="meta">
        <span>Last ring: ${entry.lastRingTime ? formatTime(entry.lastRingTime) : '-'}</span>
        <span>Call duration: ${formatDuration(entry.callDurationSec)}</span>
        <span>Calls today: ${entry.callsToday}</span>
        <span>${entry.errorMessage || ''}</span>
      </div>
    `;

    tile.querySelector('.answer-btn')?.addEventListener('click', () => onAnswerClick(endpoint));
    tile.querySelector('.hangup-btn')?.addEventListener('click', () => onHangupClick(endpoint));

    endpointGrid.appendChild(tile);
  });
}

function actionHint(status, messageLabel) {
  if (status === 'ringing') return 'Incoming call - flash indicator active';
  if (status === 'answering') return 'Answer request in progress...';
  if (status === 'answered') return `Connected: ${messageLabel}`;
  if (status === 'hanging_up') return 'Termination in progress...';
  if (status === 'completed') return 'Call completed';
  if (status === 'error') return 'Error while handling call';
  return 'Standing by for incoming call';
}

async function onAnswerClick(endpoint) {
  const entry = stateByNumber.get(endpoint.number);

  if (entry.status !== 'ringing') return;

  entry.status = 'answering';
  entry.errorMessage = '';
  renderTiles();

  try {
    const response = await fetch(ANSWER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointNumber: endpoint.number, callSid: entry.callSid })
    });

    if (!response.ok) {
      throw new Error(`Answer failed with status ${response.status}`);
    }

    entry.status = 'answered';
    entry.answeredAt = Date.now();
    entry.ringingSince = null;
    addLog('answered', endpoint.number, entry.callSid, 'Answer API success');
  } catch (error) {
    entry.status = 'error';
    entry.errorMessage = error.message;
    addLog('error', endpoint.number, entry.callSid, `Answer API error: ${error.message}`);
  } finally {
    renderTiles();
  }
}

async function onHangupClick(endpoint) {
  const entry = stateByNumber.get(endpoint.number);

  if (entry.status !== 'answered' && entry.status !== 'answering') return;

  entry.status = 'hanging_up';
  entry.errorMessage = '';
  renderTiles();

  try {
    const response = await fetch(HANGUP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointNumber: endpoint.number, callSid: entry.callSid })
    });

    if (!response.ok) {
      throw new Error(`Terminate failed with status ${response.status}`);
    }

    entry.status = 'completed';
    if (entry.answeredAt) {
      entry.callDurationSec = Math.max(0, Math.floor((Date.now() - entry.answeredAt) / 1000));
    }
    entry.ringingSince = null;
    addLog('completed', endpoint.number, entry.callSid, 'Terminate API success');
  } catch (error) {
    entry.status = 'error';
    entry.errorMessage = error.message;
    addLog('error', endpoint.number, entry.callSid, `Terminate API error: ${error.message}`);
  } finally {
    renderTiles();
  }
}

function connectWebSocket() {
  try {
    socket = new WebSocket(WS_URL);
  } catch (error) {
    addLog('error', 'system', null, `WebSocket setup failed: ${error.message}`);
    return;
  }

  socket.addEventListener('open', () => {
    addLog('info', 'system', null, 'WebSocket connected');
  });

  socket.addEventListener('message', (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      addLog('error', 'system', null, `Invalid JSON event: ${event.data}`);
      return;
    }

    applyBackendEvent(payload);
    renderTiles();
  });

  socket.addEventListener('close', () => {
    addLog('error', 'system', null, 'WebSocket closed, retrying in 3s...');
    setTimeout(connectWebSocket, 3000);
  });

  socket.addEventListener('error', () => {
    addLog('error', 'system', null, 'WebSocket error');
  });
}

function applyBackendEvent(evt) {
  const { eventType, endpointNumber, callSid, timestamp } = evt;
  const entry = stateByNumber.get(endpointNumber);

  if (!entry) {
    addLog('error', endpointNumber || 'unknown', callSid, `Unknown endpoint in event: ${JSON.stringify(evt)}`);
    return;
  }

  const eventTime = timestamp ? new Date(timestamp).getTime() : Date.now();

  if (eventType === 'ringing') {
    entry.status = 'ringing';
    entry.callSid = callSid || entry.callSid;
    entry.ringingSince = eventTime;
    entry.lastRingTime = eventTime;
    entry.errorMessage = '';
    entry.callsToday += 1;
  } else if (eventType === 'answered') {
    entry.status = 'answered';
    entry.answeredAt = eventTime;
    entry.ringingSince = null;
  } else if (eventType === 'completed') {
    entry.status = 'completed';
    if (entry.answeredAt) {
      entry.callDurationSec = Math.max(0, Math.floor((eventTime - entry.answeredAt) / 1000));
    }
    entry.ringingSince = null;
    entry.callSid = null;
  } else if (eventType === 'error') {
    entry.status = 'error';
    entry.errorMessage = 'Backend signaled error';
    entry.ringingSince = null;
  }

  addLog(eventType || 'unknown', endpointNumber, callSid, 'Event received from backend');
}

function addLog(type, endpointNumber, callSid, message) {
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString();
  li.textContent = `[${time}] [${type.toUpperCase()}] ${endpointNumber}${callSid ? ` (${callSid})` : ''} — ${message}`;

  eventLog.prepend(li);
  while (eventLog.children.length > MAX_LOG_ITEMS) {
    eventLog.removeChild(eventLog.lastChild);
  }
}

function readableStatus(status) {
  if (!status) return 'Idle';
  if (status === 'hanging_up') return 'Terminating';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function toggleMute() {
  ringMuted = !ringMuted;
  muteToggle.setAttribute('aria-pressed', ringMuted ? 'true' : 'false');
  muteToggle.textContent = ringMuted ? 'Ring Sound: Off' : 'Ring Sound: On';
  if (ringMuted) stopRing();
}

function tryPlayRing() {
  if (!ringAudio.paused) return;
  ringAudio.play().catch(() => {
    // Browser autoplay restrictions may block audio until user interaction.
  });
}

function stopRing() {
  ringAudio.pause();
  ringAudio.currentTime = 0;
}

function resetAll() {
  stopRing();
  initializeState();
  addLog('info', 'system', null, 'Local UI state reset to Idle');
  renderTiles();
}

function formatDuration(totalSec) {
  const s = totalSec || 0;
  const mins = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const sec = Math.floor(s % 60)
    .toString()
    .padStart(2, '0');
  return `${mins}:${sec}`;
}

function formatTime(ms) {
  try {
    return new Date(ms).toLocaleTimeString();
  } catch {
    return '-';
  }
}
