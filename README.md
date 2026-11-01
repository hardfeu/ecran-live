# CinéLive

CinéLive permet de partager tout l'écran et son audio dans une salle de cinéma partagée. Le diffuseur et le spectateur utilisent le site dans un navigateur compatible.

## Lancer une séance

1. Ouvre [CinéLive](https://hardfeu.github.io/ecran-live/) dans Brave, Chrome ou Edge et clique **Partager mon écran**.
2. Dans la fenêtre de partage du navigateur, choisis **Écran entier** et active le partage audio système.
3. Copie le lien de la salle et envoie-le au spectateur. Il peut également saisir le code sur le site.
4. Pour arrêter, clique sur **Quitter la salle** ou arrête le partage depuis le navigateur.

## Enregistrer une vidéo sans la diffuser

Clique **Enregistrer mon écran**, choisis **Écran entier** dans le sélecteur, puis active l'audio système si tu veux enregistrer le son. Clique **Arrêter l'enregistrement** et télécharge le fichier vidéo créé dans le navigateur. La vidéo reste locale sur ton appareil et n'est pas envoyée au site. Garde la page ouverte jusqu'au téléchargement.

Le partage envoie l'écran choisi et l'audio système autorisé par le navigateur. Le micro n'est pas demandé. Certains navigateurs ne proposent pas l'audio système selon le type d'écran ou de contenu sélectionné.

## Compatibilité et réseau

- Le partage écran fonctionne dans Brave, Chrome et Edge. Le spectateur peut rejoindre depuis macOS dans Safari ou un navigateur moderne.
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

Le compagnon VLC reste disponible dans le dossier `companion/`, mais le site utilise le partage navigateur de l'écran entier.
