const $=id=>document.getElementById(id);
const home=$('home'),session=$('session'),video=$('video'),placeholder=$('placeholder'),status=$('status');
let peer=null,localStream=null,call=null,mode='',offerResources=[],statsTimer=null,lastVideoStats=null;
function setStatus(text,live=false){status.textContent='';const dot=document.createElement('i');status.append(dot,document.createTextNode(' '+text));status.classList.toggle('live',live)}
function showSession(){home.classList.add('hidden');session.classList.remove('hidden')}
function makeRoom(){const bytes=crypto.getRandomValues(new Uint8Array(6));return Array.from(bytes,b=>b.toString(36).padStart(2,'0')).join('').slice(0,8).toUpperCase()}
async function startHost(){
  if(!window.Peer){alert('Connexion au service de signalisation impossible. Vérifie ta connexion et recharge la page.');return}
  mode='host';showSession();$('shareInfo').classList.remove('hidden');$('hint').textContent='Profil fluide : jusqu’à 1080p, 60 images/s et un plafond de 50 Mb/s. La fluidité est prioritaire ; si le débit manque, la résolution peut baisser. Choisis « Écran entier » et active le partage audio.';setStatus('Préparation du partage…');
  try{
    localStream=await navigator.mediaDevices.getDisplayMedia({video:{width:{ideal:1920,max:1920},height:{ideal:1080,max:1080},frameRate:{ideal:60,max:60}},audio:true,systemAudio:'include'});
    // Favor frame rate for movies and other moving content. This is a browser hint, not a guarantee.
    const capturedVideo=localStream.getVideoTracks()[0];
    if(capturedVideo&&'contentHint'in capturedVideo)capturedVideo.contentHint='motion';
    // Re-apply the target after capture and read back what the browser actually selected.
    if(capturedVideo){try{await capturedVideo.applyConstraints({frameRate:{ideal:60,max:60}})}catch(error){console.warn('Could not request 60 fps from screen capture',error)}}
    video.srcObject=localStream;video.muted=true;placeholder.classList.add('hidden');
    const room=makeRoom();$('roomCode').textContent=room;
    peer=new Peer('ecranlive-'+room.toLowerCase(),{config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}});
    peer.on('open',()=>setStatus('En attente de ta copine',true));
    peer.on('call',incoming=>{call=incoming;incoming.answer(localStream,{sdpTransform:preferH264InSdp});tuneVideoSender(incoming);startStats(incoming,'outbound-rtp');incoming.on('close',()=>{stopStats();setStatus('Connexion interrompue')});setStatus('Connecté — partage en direct',true)});
    peer.on('error',err=>{setStatus('Erreur de connexion');$('hint').textContent='Erreur : '+err.type+'. Essaie de recharger la page et de relancer le partage.'});
    if(!localStream.getAudioTracks().length)$('hint').textContent='L’écran est partagé, mais le navigateur n’a pas fourni de piste audio. Arrête et réessaie en activant le partage audio dans la fenêtre de sélection.';
    localStream.getVideoTracks()[0].addEventListener('ended',stopSession);
    $('copyButton').onclick=async()=>{const url=new URL(location.href);url.search='?room='+room;try{await navigator.clipboard.writeText(url.href);$('copyButton').textContent='Lien copié ✓';setTimeout(()=>$('copyButton').textContent='Copier le lien',1800)}catch{$('hint').textContent='Ton code est '+room+'. Envoie-lui ce lien : '+url.href}};
  }catch(e){setStatus('Partage non démarré');$('hint').textContent=e.name==='NotAllowedError'?'Autorisation refusée ou partage annulé.':'Impossible de capturer l’écran : '+e.message}
}
function startViewer(room){
  room=room.trim().toLowerCase();if(!/^[a-z0-9]{4,8}$/.test(room)){alert('Entre un code de partage valide.');return}
  if(!window.Peer){alert('Connexion au service de signalisation impossible. Recharge la page.');return}
  mode='viewer';showSession();$('shareInfo').classList.add('hidden');setStatus('Connexion au partage…');$('hint').textContent='Le son du partage est activé avec les commandes du lecteur.';
  peer=new Peer({config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}});
  peer.on('open',()=>{const offerTracks=createOfferTracks();call=peer.call('ecranlive-'+room,offerTracks,{sdpTransform:preferH264InSdp});if(!call){setStatus('Partage introuvable');return}call.on('stream',stream=>{video.srcObject=stream;video.muted=false;placeholder.classList.add('hidden');video.play().catch(()=>{});startStats(call,'inbound-rtp');setStatus('En direct',true)});call.on('close',()=>{stopStats();setStatus('Le partage est terminé');placeholder.classList.remove('hidden')});call.on('error',()=>setStatus('Connexion interrompue'))});
  peer.on('error',err=>{setStatus('Partage introuvable');$('hint').textContent='Vérifie que le partage est encore actif et que le code est correct ('+err.type+').'});
}
function preferH264InSdp(sdp){
  return sdp.split(/\r?\n/).map(line=>{
    if(!line.startsWith('m=video '))return line;
    const fields=line.trim().split(/\s+/),payloads=fields.slice(3);
    const h264=payloads.filter(pt=>new RegExp(`^a=rtpmap:${pt}\\s+H264/90000\\s*$`,'im').test(sdp));
    if(!h264.length)return line;
    const h264Rtx=payloads.filter(pt=>new RegExp(`^a=fmtp:${pt}\\s+.*\\bapt=(?:${h264.join('|')})\\b`,'im').test(sdp));
    const ordered=[...h264,...h264Rtx,...payloads.filter(pt=>!h264.includes(pt)&&!h264Rtx.includes(pt))];
    return [...fields.slice(0,3),...ordered].join(' ');
  }).join('\r\n');
}
function createOfferTracks(){
  // PeerJS needs audio and video m-lines in the initial offer to receive both tracks.
  const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,2,2);
  const stream=canvas.captureStream(1);
  const audioContext=new AudioContext();const silence=audioContext.createMediaStreamDestination();
  const oscillator=audioContext.createOscillator();const gain=audioContext.createGain();gain.gain.value=0;oscillator.connect(gain).connect(silence);oscillator.start();
  stream.addTrack(silence.stream.getAudioTracks()[0]);
  offerResources=[stream,canvas,audioContext,oscillator];
  return stream;
}
async function tuneVideoSender(mediaCall){
  for(let attempt=0;attempt<20;attempt++){
    const pc=mediaCall?.peerConnection;
    const sender=pc?.getSenders?.().find(item=>item.track?.kind==='video');
    if(sender){
      try{
        const parameters=sender.getParameters();
        if(parameters.encodings?.length){
          parameters.encodings[0].maxBitrate=50_000_000;
          parameters.encodings[0].maxFramerate=60;
          parameters.degradationPreference='maintain-framerate';
          await sender.setParameters(parameters);
        }
      }catch(error){console.warn('Could not apply high-quality video settings',error)}
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
}
function startStats(mediaCall,direction){
  stopStats();lastVideoStats=null;$('quality').textContent='Mesure de la qualité…';
  statsTimer=setInterval(async()=>{
    try{
      const pc=mediaCall?.peerConnection;if(!pc)return;
      const report=await pc.getStats();
      const row=Array.from(report.values()).find(item=>item.type===direction&&(item.kind==='video'||item.mediaType==='video'));
      if(!row)return;
      const bytes=direction==='outbound-rtp'?row.bytesSent:row.bytesReceived;
      const now=row.timestamp;
      let rate=0;
      if(lastVideoStats&&now>lastVideoStats.time)rate=Math.max(0,(bytes-lastVideoStats.bytes)*8*1000/(now-lastVideoStats.time));
      lastVideoStats={bytes,time:now};
      const size=row.frameWidth&&row.frameHeight?`${row.frameWidth}×${row.frameHeight}`:'résolution en mesure';
      const fps=row.framesPerSecond?` · ${Math.round(row.framesPerSecond)} i/s`:'';
      const sourceFps=mode==='host'?localStream?.getVideoTracks?.()[0]?.getSettings?.().frameRate:null;
      const sourceInfo=sourceFps?` · capture ${Math.round(sourceFps)} i/s`:'';
      const codec=report.get(row.codecId)?.mimeType?.replace(/^video\//,'');
      const codecInfo=codec?` · codec ${codec}`:'';
      const mbps=rate?` · ${(rate/1_000_000).toFixed(1)} Mb/s`:'';
      const limitation=row.qualityLimitationReason&&row.qualityLimitationReason!=='none'?` · limité par ${row.qualityLimitationReason==='bandwidth'?'le réseau':'le PC'}`:'';
      $('quality').textContent=`Vidéo ${size}${fps}${sourceInfo}${codecInfo}${mbps}${limitation}`;
      $('quality').classList.toggle('low',rate>0&&rate<1_500_000);
    }catch(error){console.debug('Video stats unavailable',error)}
  },1000);
}
function stopStats(){if(statsTimer){clearInterval(statsTimer);statsTimer=null}lastVideoStats=null;$('quality').textContent='';$('quality').classList.remove('low')}
function stopSession(){stopStats();if(call){call.close();call=null}if(peer){peer.destroy();peer=null}if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null}for(const item of offerResources){if(item instanceof MediaStream)item.getTracks().forEach(t=>t.stop());else if(item instanceof AudioContext)item.close();else if(item instanceof OscillatorNode)item.stop()}offerResources=[];video.srcObject=null;video.muted=false;placeholder.classList.remove('hidden');session.classList.add('hidden');home.classList.remove('hidden');$('shareInfo').classList.add('hidden');mode=''}
$('hostButton').addEventListener('click',startHost);
$('watchForm').addEventListener('submit',e=>{e.preventDefault();startViewer($('roomInput').value)});
$('stopButton').addEventListener('click',stopSession);
const initialRoom=new URLSearchParams(location.search).get('room');if(initialRoom){$('roomInput').value=initialRoom;startViewer(initialRoom)}
