// =========================
// Backend configuration
// =========================
const BACKEND_BASE_URL = 'https://phonebox-backend.vercel.app';
const ANSWER_API_URL = `${BACKEND_BASE_URL}/api/answer`;
const HANGUP_API_URL = `${BACKEND_BASE_URL}/api/hangup`;
const PASS_API_URL = `${BACKEND_BASE_URL}/api/pass`;

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
let ringMuted = false;

const endpointGrid = document.getElementById('endpointGrid');
const eventLog = document.getElementById('eventLog');
const muteToggle = document.getElementById('muteToggle');
const resetBtn = document.getElementById('resetBtn');
const ringAudio = document.getElementById('ringAudio');

initializeState();
renderTiles();

setInterval(pollForCalls, 3000);

setInterval(() => {
  const shouldPlayRing = ENDPOINTS.some((endpoint) => stateByNumber.get(endpoint.number)?.status === 'ringing');
  if (!ringMuted && shouldPlayRing) {
    tryPlayRing();
  } else {
    stopRing();
  }
  renderTiles();
}, 500);

muteToggle.addEventListener('click', toggleMute);
resetBtn.addEventListener('click', resetAll);

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

async function pollForCalls() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/status`);
    const data = await response.json();
    if (data.ok && data.calls) {
      stateByNumber.forEach((entry, number) => {
        if (entry.status === 'ringing' && !data.calls[number]) {
          applyBackendEvent({ eventType: 'completed', endpointNumber: number });
        }
      });
      Object.entries(data.calls).forEach(([number, callData]) => {
        applyBackendEvent({
          eventType: 'ringing',
          endpointNumber: number,
          callSid: callData.callSid
        });
      });
    }
  } catch (error) {
    console.error("Polling error:", error);
  }
}

function applyBackendEvent(evt) {
  const { eventType, endpointNumber, callSid, timestamp } = evt;
  const entry = stateByNumber.get(endpointNumber);
  if (!entry) return;
  const eventTime = timestamp ? new Date(timestamp).getTime() : Date.now();
  if (eventType === 'ringing' && entry.status === 'ringing') return;
  if (eventType === 'ringing') {
    entry.status = 'ringing';
    entry.callSid = callSid || entry.callSid;
    entry.ringingSince = entry.ringingSince || eventTime;
    entry.lastRingTime = eventTime;
    entry.errorMessage = '';
    entry.callsToday += 1;
    addLog('ringing', endpointNumber, callSid, 'Incoming call detected');
  } else if (eventType === 'completed') {
    entry.status = 'completed';
    entry.ringingSince = null;
    entry.callSid = null;
    addLog('completed', endpointNumber, null, 'Call cleared');
  }
}

async function onAnswerClick(endpoint) {
  const entry = stateByNumber.get(endpoint.number);
  if (entry.status !== 'ringing') return;
  entry.status = 'answering';
  renderTiles();
  try {
    const response = await fetch(ANSWER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointNumber: endpoint.number, callSid: entry.callSid })
    });
    if (!response.ok) throw new Error(`Answer failed: ${response.status}`);
    entry.status = 'answered';
    entry.answeredAt = Date.now();
    entry.ringingSince = null;
    addLog('answered', endpoint.number, entry.callSid, 'Call connected successfully');
  } catch (error) {
    entry.status = 'error';
    entry.errorMessage = error.message;
    addLog('error', endpoint.number, entry.callSid, error.message);
  }
}

async function onPassClick(endpoint) {
  const entry = stateByNumber.get(endpoint.number);
  if (entry.status !== 'ringing') return;
  entry.status = 'passing';
  renderTiles();
  try {
    const response = await fetch(PASS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointNumber: endpoint.number, callSid: entry.callSid })
    });
    if (!response.ok) throw new Error('Pass failed');
    entry.status = IDLE_STATE;
    entry.callSid = null;
    addLog('info', endpoint.number, null, 'Call passed to next in hunt group');
  } catch (error) {
    entry.status = 'error';
    entry.errorMessage = error.message;
    addLog('error', endpoint.number, null, error.message);
  }
}

async function onHangupClick(endpoint) {
  const entry = stateByNumber.get(endpoint.number);
  if (entry.status !== 'answered' && entry.status !== 'answering' && entry.status !== 'ringing') return;
  entry.status = 'hanging_up';
  renderTiles();
  try {
    const response = await fetch(HANGUP_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointNumber: endpoint.number, callSid: entry.callSid })
    });
    if (!response.ok) throw new Error('Terminate failed');
    entry.status = 'completed';
    if (entry.answeredAt) {
      entry.callDurationSec = Math.floor((Date.now() - entry.answeredAt) / 1000);
    }
    entry.callSid = null;
    addLog('completed', endpoint.number, null, 'Call terminated by console');
  } catch (error) {
    entry.status = 'error';
    entry.errorMessage = error.message;
  }
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
      <div class="tile-head"><div class="business">${endpoint.businessName}</div></div>
      <div class="number">${endpoint.displayNumber}</div>
      <div class="status-row status-${entry.status}">
        <span class="status-chip"><span class="signal-icon"></span>${statusText}</span>
        <span>${entry.status === 'ringing' ? `Ringing ${ringSeconds}s` : ''}</span>
      </div>
      <div class="actions-row">
        <button class="action-btn answer-btn" ${entry.status === 'ringing' ? '' : 'disabled'}>Answer</button>
        <button class="action-btn pass-btn" ${entry.status === 'ringing' ? '' : 'disabled'}>Pass</button>
        <button class="action-btn hangup-btn" ${(entry.status === 'answered' || entry.status === 'answering' || entry.status === 'ringing') ? '' : 'disabled'}>Terminate</button>
      </div>
      <div class="action-hint">${actionHint(entry.status, endpoint.messageLabel)}</div>
      <div class="meta">
        <span>Last ring: ${entry.lastRingTime ? formatTime(entry.lastRingTime) : '-'}</span>
        <span>Duration: ${formatDuration(entry.callDurationSec)}</span>
        <span>Calls today: ${entry.callsToday}</span>
      </div>
    `;
    tile.querySelector('.answer-btn')?.addEventListener('click', () => onAnswerClick(endpoint));
    tile.querySelector('.pass-btn')?.addEventListener('click', () => onPassClick(endpoint));
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
  if (status === 'passing') return 'Requesting next agent in hunt group...';
  return 'Standing by for incoming call';
}

function addLog(type, endpointNumber, callSid, message) {
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString();
  li.textContent = `[${time}] [${type.toUpperCase()}] ${endpointNumber} — ${message}`;
  eventLog.prepend(li);
  if (eventLog.children.length > MAX_LOG_ITEMS) eventLog.removeChild(eventLog.lastChild);
}

function readableStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
}

function toggleMute() {
  ringMuted = !ringMuted;
  muteToggle.setAttribute('aria-pressed', ringMuted);
  muteToggle.textContent = ringMuted ? 'Ring Sound: Off' : 'Ring Sound: On';
}

function tryPlayRing() {
  if (ringAudio.paused) ringAudio.play().catch(() => {});
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

function formatDuration(s) {
  const mins = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${mins}:${sec}`;
}

function formatTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
