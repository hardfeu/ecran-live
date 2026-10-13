const $ = id => document.getElementById(id);
const list = $('windowList');
const startButton = $('startButton');
const sessionPanel = $('sessionPanel');
const SITE_URL = 'https://hardfeu.github.io/ecran-live/';
let selectedWindowId = null;
let localStream = null;
let peer = null;
let activeCall = null;
let qualityTimer = null;
let lastStats = null;

function setStatus(text, live = false) {
  $('status').textContent = text;
  $('statusDot').classList.toggle('live', live);
}

function makeRoom() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, value => value.toString(36).padStart(2, '0')).join('').slice(0, 8).toUpperCase();
}

async function refreshWindows() {
  $('error').textContent = '';
  $('refreshButton').disabled = true;
  try {
    const sources = await window.cinelive.listVlcWindows();
    if (selectedWindowId && !sources.some(source => source.id === selectedWindowId)) {
      selectedWindowId = null;
      await window.cinelive.clearVlcSelection();
    }
    if (!selectedWindowId && sources.length === 1) selectWindow(sources[0]);
    renderWindows(sources);
    if (!sources.length) {
      list.innerHTML = '<div class="empty">Aucune fenêtre VLC détectée. Ouvre un film dans VLC, puis actualise.</div>';
      startButton.disabled = true;
    }
  } catch (error) {
    $('error').textContent = 'Impossible de rechercher VLC : ' + error.message;
  } finally {
    $('refreshButton').disabled = false;
  }
}

function renderWindows(sources) {
  if (!sources.length) return;
  list.replaceChildren();
  for (const source of sources) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'window-option' + (source.id === selectedWindowId ? ' selected' : '');
    const thumbnail = document.createElement('img');
    thumbnail.src = source.thumbnail;
    thumbnail.alt = '';
    const label = document.createElement('span');
    label.className = 'window-name';
    label.textContent = source.name;
    const check = document.createElement('span');
    check.className = 'window-check';
    check.textContent = '✓';
    button.append(thumbnail, label, check);
    button.addEventListener('click', () => selectWindow(source));
    list.append(button);
  }
}

async function selectWindow(source) {
  try {
    await window.cinelive.selectVlcWindow(source.id);
    selectedWindowId = source.id;
    startButton.disabled = false;
    renderWindows(await window.cinelive.listVlcWindows());
  } catch (error) {
    selectedWindowId = null;
    startButton.disabled = true;
    $('error').textContent = error.message;
  }
}

function preferH264InSdp(sdp) {
  return sdp.split(/\r?\n/).map(line => {
    if (!line.startsWith('m=video ')) return line;
    const fields = line.trim().split(/\s+/);
    const payloads = fields.slice(3);
    const h264 = payloads.filter(pt => new RegExp(`^a=rtpmap:${pt}\\s+H264/90000\\s*$`, 'im').test(sdp));
    if (!h264.length) return line;
    const rtx = payloads.filter(pt => new RegExp(`^a=fmtp:${pt}\\s+.*\\bapt=(?:${h264.join('|')})\\b`, 'im').test(sdp));
    return [...fields.slice(0, 3), ...h264, ...rtx, ...payloads.filter(pt => !h264.includes(pt) && !rtx.includes(pt))].join(' ');
  }).join('\r\n');
}

async function tuneVideoSender(call) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const sender = call?.peerConnection?.getSenders?.().find(item => item.track?.kind === 'video');
    if (sender) {
      try {
        const parameters = sender.getParameters();
        if (parameters.encodings?.length) {
          parameters.encodings[0].maxBitrate = 100_000_000;
          parameters.encodings[0].maxFramerate = 60;
          parameters.degradationPreference = 'maintain-framerate';
          await sender.setParameters(parameters);
        }
      } catch (error) { console.warn('Réglages vidéo non disponibles', error); }
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}

function startQuality(call) {
  clearInterval(qualityTimer);
  lastStats = null;
  qualityTimer = setInterval(async () => {
    try {
      const report = await call.peerConnection.getStats();
      const row = [...report.values()].find(item => item.type === 'outbound-rtp' && (item.kind === 'video' || item.mediaType === 'video'));
      if (!row) return;
      let bitrate = 0;
      if (lastStats && row.timestamp > lastStats.time) bitrate = (row.bytesSent - lastStats.bytes) * 8 * 1000 / (row.timestamp - lastStats.time);
      lastStats = { bytes: row.bytesSent, time: row.timestamp };
      const dimensions = row.frameWidth && row.frameHeight ? `${row.frameWidth}×${row.frameHeight}` : 'résolution en mesure';
      const fps = row.framesPerSecond ? ` · ${Math.round(row.framesPerSecond)} i/s` : '';
      const mbps = bitrate > 0 ? ` · ${(bitrate / 1_000_000).toFixed(1)} Mb/s` : '';
      $('quality').textContent = `VLC ${dimensions}${fps}${mbps}`;
    } catch (error) { console.debug('Mesure du flux indisponible', error); }
  }, 1000);
}

function stopSession() {
  clearInterval(qualityTimer);
  qualityTimer = null;
  lastStats = null;
  if (activeCall) { activeCall.close(); activeCall = null; }
  if (peer) { peer.destroy(); peer = null; }
  if (localStream) {
    for (const track of localStream.getTracks()) track.stop();
    localStream = null;
  }
  $('copyButton').disabled = true;
  $('stopButton').classList.add('hidden');
  $('quality').textContent = '';
  $('roomCode').textContent = '--------';
  setStatus('Séance arrêtée');
  startButton.disabled = !selectedWindowId;
  startButton.classList.remove('hidden');
  $('error').textContent = '';
}

async function startSession() {
  if (!selectedWindowId || peer) return;
  $('error').textContent = '';
  setStatus('Connexion à VLC…');
  startButton.disabled = true;

  // Call getDisplayMedia synchronously in this button handler; Electron's main
  // process supplies the already selected VLC window, so no OS share picker appears.
  let captureRequest;
  try {
    captureRequest = navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 }, frameRate: { ideal: 60, max: 60 } },
      audio: true
    });
    localStream = await captureRequest;
  } catch (error) {
    setStatus('VLC non connecté');
    $('error').textContent = error.message || 'La capture de VLC a échoué.';
    startButton.disabled = false;
    return;
  }

  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack && 'contentHint' in videoTrack) videoTrack.contentHint = 'motion';
  if (!localStream.getAudioTracks().length) {
    $('sessionHint').textContent = 'La vidéo VLC est connectée, mais Windows n’a pas fourni de son système.';
  } else {
    $('sessionHint').textContent = 'Vidéo de la fenêtre VLC et audio de sortie Windows. Les autres sons du PC peuvent aussi être transmis.';
  }

  const room = makeRoom();
  $('roomCode').textContent = room;
  sessionPanel.classList.remove('hidden');
  $('stopButton').classList.remove('hidden');
  startButton.classList.add('hidden');
  $('copyButton').disabled = false;
  $('copyButton').onclick = async () => {
    const url = new URL(SITE_URL);
    url.searchParams.set('room', room);
    try {
      await navigator.clipboard.writeText(url.href);
      $('copyButton').textContent = 'Lien copié ✓';
      setTimeout(() => { $('copyButton').textContent = 'Copier le lien'; }, 1800);
    } catch { $('error').textContent = `Code de salle : ${room}. Envoie ce lien : ${url.href}`; }
  };

  peer = new Peer(`ecranlive-${room.toLowerCase()}`, {
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
  });
  peer.on('open', () => setStatus('VLC en direct · En attente du spectateur', true));
  peer.on('call', incoming => {
    activeCall = incoming;
    incoming.answer(localStream, { sdpTransform: preferH264InSdp });
    tuneVideoSender(incoming);
    startQuality(incoming);
    incoming.on('close', () => {
      activeCall = null;
      clearInterval(qualityTimer);
      setStatus('Spectateur déconnecté · lien toujours actif');
    });
    incoming.on('error', error => { $('error').textContent = 'Connexion interrompue : ' + error.type; });
    setStatus('VLC en direct · Spectateur connecté', true);
  });
  peer.on('error', error => {
    setStatus('Erreur de connexion');
    $('error').textContent = `PeerJS : ${error.type}. Vérifie la connexion Internet puis relance la séance.`;
  });
  videoTrack?.addEventListener('ended', stopSession);
}

$('refreshButton').addEventListener('click', refreshWindows);
$('startButton').addEventListener('click', startSession);
$('stopButton').addEventListener('click', stopSession);
refreshWindows();
setInterval(() => { if (!selectedWindowId && !peer) refreshWindows(); }, 4000);
