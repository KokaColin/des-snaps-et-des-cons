# Où on en est — reprise du projet

Dernière mise à jour : 28 novembre 2026.

## Liens

- Site en ligne : https://des-snaps-et-des-cons.kokacolin.workers.dev/ (déployé automatiquement depuis `main` par Cloudflare Workers Builds)
- Cahier des charges : [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md) (document de travail : https://claude.ai/artifact/11ExaHKnnMkttWKS2wzGjK)
- Direction artistique : [DIRECTION-ARTISTIQUE.md](DIRECTION-ARTISTIQUE.md) (maquettes : https://claude.ai/artifact/3uDKpuxXcFMma1RiGR5R97)

## Fait

- Lot 1 terminé : mise en place, moteur de jeu pur (`src/shared/`), maquettes validées.
- Lot 2 (cœur multijoueur), en attente de validation :
  - **Comptes** (`src/server/group.ts`) : choix du nom parmi les 7, mot de passe créé à la première connexion (PBKDF2-SHA256, 100 000 itérations, calculé dans le Durable Object), session d'un an en cookie `HttpOnly`, plusieurs appareils, limitation des tentatives (5 erreurs par membre ou 20 par adresse IP en 15 min → blocage), réinitialisation par le mainteneur (voir `DEPLOIEMENT.md`).
  - **Photothèque** (`group.ts` + `src/client/screens/Library.svelte`) : envoi multiple, compression dans le navigateur (1600 px WebP + miniature 400 px, JPEG en repli), doublons exacts refusés (empreinte du fichier d'origine), catégories Iconique / Fauto (« screen random »), filtres, tri, plein écran, corbeille 30 jours (purge par alarme, photos légendaires conservées), export zip fait dans le navigateur.
  - **Salon temps réel** (`src/server/game-room.ts`) : WebSocket avec hibernation, état du moteur en SQLite à chaque changement, une alarme sur l'échéance la plus proche (`nextWakeAt`, présence, expiration 2 h), `tick()` à chaque alarme et (dé)connexion, chaque joueur ne reçoit que `viewFor()`. Jeton par appareil, reconnexion au bon écran, présence par pings (« absent » après 5 s), organisateur remplacé.
  - Écrans : accueil, connexion, rejoindre, salon (maquette), photothèque. Pendant la partie, écran provisoire (manche, phase, chrono, joueurs) en attendant le lot 3.

## Décisions techniques prises au lot 2 (à valider avec la PR)

- **Adresse des photos = autorisation** : `/api/photos/<id>/full` n'exige pas de compte ; l'identifiant est aléatoire (128 bits) et n'est donné qu'aux membres (liste) ou aux joueurs d'une partie qui utilise la photo. C'est ce qui permettra aux invités de voir les photos de leur partie sans accès à la photothèque.
- **Présentation au salon par message** : le jeton de l'appareil et le pseudo d'invité sont envoyés dans le premier message WebSocket (`hello`), jamais dans l'adresse (qui peut finir dans des journaux).
- **Le créateur entre en premier** : tant qu'il n'est pas dans le salon, personne d'autre ne peut entrer (il devient l'organisateur).
- **Pings** : l'application envoie « ping » toutes les 2 s ; Cloudflare répond sans réveiller le Durable Object. Contrôle de présence toutes les 3 s tant que quelqu'un est connecté ; connexion muette depuis 20 s fermée (le joueur passe « déconnecté »).
- Moteur : ajout de `heartbeat()` (signe de vie sans action) et de `phaseStartedAt` dans la vue (anneau du chrono).

## Prochaine étape : lot 3 (jeu complet)

1. Écrans de jeu selon les maquettes : Éditeur (modèle haut/bas, 3 zones, styles, 8 couleurs, changer d'image), Attente, Vote (curseur 0–22 à paliers), Résultats (+ autocollant Fauto), Annonces, Fin de partie (podium, badges, récap, téléchargement, revanche).
2. Fauto côté interface (activation, roulette, cible, prévenir la cible).
3. Fin de partie côté serveur : enregistrer memes, statistiques et memes légendaires dans `Group` (marquer `legendary` sur la photo).
4. Critère : parties à 3 et à 7 de bout en bout.

## Points d'attention

- Une limite de CPU courte s'applique aux Workers gratuits : le hachage des mots de passe se fait dans le Durable Object `Group`.
- Toujours passer par `view.ts` pour ce qui part vers un téléphone.
- Les photos de test seront fournies plus tard par le mainteneur.
- Les écrans du salon pendant la partie (`InGame.svelte`) sont provisoires et seront remplacés au lot 3.

## Tester en local

```bash
npm run dev:worker   # construit l'application puis lance le serveur sur http://localhost:8787
```

Les données locales (comptes, photos, parties) vivent dans `.wrangler/state` ; supprimer ce dossier repart de zéro.
