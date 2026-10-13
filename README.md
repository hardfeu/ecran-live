# CinéLive

CinéLive est un salon privé pour partager un écran Windows avec un Mac. La capture est demandée explicitement par le navigateur. Le projet ne demande pas l’accès au micro.

## Lancer le projet

Sur Windows, double-clique `Lancer-sur-ce-PC.bat`. Il faut Python 3 ; si `py` n'est pas reconnu, installe Python en activant l'option PATH. Le script ouvre `http://localhost:8000` dans le navigateur. Laisse la fenêtre noire ouverte pendant le partage.

Pour lancer à la main dans PowerShell depuis ce dossier :

```powershell
py -m http.server 8000
```

Pour un vrai partage entre ton PC et le Mac depuis Internet, il faut publier le dossier sur un hébergeur statique HTTPS. Étapes simples avec GitHub Pages :

1. Crée un compte GitHub si tu n'en as pas, puis un dépôt public nommé `ecran-live`.
2. Envoie les fichiers de ce dossier à la racine du dépôt (bouton **Add file → Upload files** sur GitHub convient).
3. Dans **Settings → Pages**, choisis **Deploy from a branch**, branche `main`, dossier `/(root)`, puis **Save**.
4. Quand GitHub affiche l'adresse du site (de la forme `https://TON-NOM.github.io/ecran-live/`), ouvre-la dans Brave, Chrome ou Edge sur le PC et envoie le lien de partage au Mac.

Ne publie jamais de clé API, de mot de passe ou d'identifiant privé dans le dépôt. Le site utilise un service PeerJS public pour la signalisation.

## Utilisation

1. Sur le PC, ouvre la page HTTPS et clique sur « PARTAGER L’ÉCRAN » sur le téléviseur.
2. Dans la boîte de dialogue, sélectionne l’écran entier et coche le partage audio système s’il est proposé.
3. Donne le code de salle affiché ; sur son Mac, elle le saisit dans le champ de la télécommande puis rejoint la séance.
4. Elle peut activer le son dans les commandes vidéo du navigateur. « Arrêter » coupe les pistes capturées.

Utiliser un navigateur à jour. Le profil haute qualité demande jusqu'à 1080p, 60 images/s et autorise un plafond vidéo de 100 Mb/s. La capture vidéo privilégie aussi la fluidité pour les contenus en mouvement. La négociation préfère H.264 puis garde les autres codecs comme secours ; le codec effectif apparaît dans l’indicateur. H.264 peut utiliser un encodeur matériel s’il est pris en charge et activé sur les deux appareils, mais cela n’est pas garanti. Ces réglages sont des préférences, pas une garantie de cadence ou de débit : la source capturée, le navigateur, l’encodage, le Mac et le trajet réseau peuvent limiter le résultat. WebRTC adapte l’envoi à la capacité réelle du PC et du réseau. Pendant le partage, l’indicateur affiche la résolution, la cadence, le codec et le débit vidéo observés. La capture audio système dépend du navigateur et du choix de source ; les navigateurs ne garantissent pas tous sa disponibilité. Le site n’active pas le micro.

## Réseau et confidentialité

La vidéo et l’audio sont envoyés par WebRTC entre les navigateurs. PeerJS fournit la signalisation de connexion et Google STUN aide à établir le chemin direct. Ce prototype n’intègre pas de relais TURN : certains réseaux stricts empêcheront donc la connexion ou réduiront sa fiabilité. Le code de salle est court et ne constitue pas une authentification forte ; ne partage pas le lien publiquement. N’affiche pas de fenêtres ou notifications privées pendant la capture.

Pour un usage régulier, il faudra publier le site sous HTTPS et ajouter un service TURN fiable. Les identifiants TURN doivent être fournis par un fournisseur ou un serveur que tu contrôles.
