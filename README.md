# CinéLive

CinéLive permet de regarder à distance le contenu d'une fenêtre VLC dans une salle de cinéma partagée. Le diffuseur utilise le compagnon Windows ; le spectateur rejoint depuis le site dans un navigateur compatible.

## Utiliser le compagnon VLC

1. Installe VLC et ouvre le film sur le PC Windows.
2. Télécharge et installe **CinéLive VLC** depuis [la dernière version](https://github.com/hardfeu/ecran-live/releases/latest/download/CineLive-VLC-Setup.exe).
3. Ouvre le compagnon, sélectionne la fenêtre VLC puis clique **Lier VLC et lancer la séance**.
4. Copie le lien de la salle et envoie-le au spectateur. Le site s'ouvrira directement sur la bonne salle ; il peut aussi saisir le code manuellement sur [CinéLive](https://hardfeu.github.io/ecran-live/).
5. Pour arrêter la diffusion, clique **Arrêter** dans le compagnon ou ferme VLC.

Le compagnon capture directement la fenêtre VLC : il ne demande pas de choisir l'écran ou une fenêtre dans Brave. L'audio transmis est la sortie audio Windows par loopback ; Windows peut donc inclure d'autres sons joués sur le PC. Mets en sourdine les autres applications pendant la séance si nécessaire. Laisse VLC ouvert et non minimisé. L'application ne demande pas l'accès au micro.

## Compatibilité et réseau

- Le compagnon de diffusion est pour Windows. Le spectateur peut rejoindre depuis macOS dans un navigateur moderne.
- PeerJS fournit la signalisation WebRTC et Google STUN aide à établir une connexion directe entre les appareils. Ce prototype n'intègre pas de relais TURN : certains réseaux stricts peuvent empêcher la connexion.
- Le flux demande jusqu'à 1080p, 60 images/s et un débit vidéo maximal de 100 Mb/s. La cadence et le débit réels dépendent de VLC, du matériel et des réseaux des deux côtés.
- L'installateur Windows n'est pas signé numériquement ; Windows peut afficher un avertissement SmartScreen lors de son lancement.

## Développement du compagnon

Avec Node.js 22.12 ou plus récent :

```powershell
cd companion
npm install
npm start
```

Pour produire localement l'installateur Windows :

```powershell
npm run dist
```

La compilation et la publication de l'installateur sont configurées dans `.github/workflows/release-vlc-companion.yml`. Une balise `vlc-companion-v*` déclenche la création d'une version GitHub Release.
