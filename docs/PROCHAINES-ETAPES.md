# Où on en est — reprise du projet

Dernière mise à jour : 28 novembre 2026.

## Liens

- Site en ligne : https://des-snaps-et-des-cons.kokacolin.workers.dev/ (déployé automatiquement depuis `main` par Cloudflare Workers Builds)
- Cahier des charges : [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md) (document de travail : https://claude.ai/artifact/11ExaHKnnMkttWKS2wzGjK)
- Direction artistique : [DIRECTION-ARTISTIQUE.md](DIRECTION-ARTISTIQUE.md) (maquettes : https://claude.ai/artifact/3uDKpuxXcFMma1RiGR5R97)

## Fait

- Lot 1 terminé : mise en place, moteur de jeu pur (`src/shared/`), maquettes validées.
- Lot 2 terminé (fusionné le 28 novembre 2026) : comptes, photothèque, salon temps réel.
- Lot 3 (jeu complet), en attente de validation :
  - **Rendu des memes** (`src/client/lib/meme-render.ts`) : un seul code dessine sur canvas l'aperçu de l'éditeur, les memes du vote, des résultats, du récap et l'image téléchargée. L'aperçu est donc l'image finale.
  - **Éditeur** (`screens/game/Editor.svelte`) : modèle haut/bas, 3 zones déplaçables au doigt, Classique / Bandeau Snap, A−/A+, 8 couleurs, changer d'image (1 fois, jamais une Fauto), brouillon envoyé au serveur au fil de l'eau (à la fin du chrono, le meme part tel quel), écran d'attente, bandeau « X t'a envoyé une Fauto ! ».
  - **Vote** : meme « auteur : mystère », grande note à paliers (0 triste, gris → crème, jaune → orange, 22 « LÉGENDAIRE ! » avec explosion), curseur, « c'est le tien », compteur « x/y ont noté ».
  - **Résultats** : polaroïds classés, score tagué, tampons « 22 · prénom », notes de chaque votant, « Fauto de X », mention légendaire ; autocollant FAUTO ! pour le détenteur (activer → roulette → photo + cible → envoi, annulation avec avertissement), « N Fauto en circulation » pour les autres.
  - **Annonces** entre les manches (« DERNIÈRE MANCHE » plus forte), **fin de partie** : révélation du dernier au premier, podium, 3 badges gwero, récap horizontal de tous les memes avec téléchargement, revanche.
  - **Enregistrement** (`src/shared/record.ts` + `Group.recordGame`) : chaque partie terminée est gardée une fois (tables `games` et `memes`, votants avec mention invité) ; la photo d'un meme légendaire est marquée et n'est jamais purgée. Base des profils et de la galerie du lot 4.

## Décisions techniques (lots 2 et 3)

- **Adresse des photos = autorisation** : `/api/photos/<id>/full` n'exige pas de compte ; l'identifiant est aléatoire (128 bits) et n'est donné qu'aux membres (liste) ou aux joueurs d'une partie qui utilise la photo (invités compris).
- **Présentation au salon par message** : jeton de l'appareil et pseudo d'invité dans le premier message WebSocket (`hello`), jamais dans l'adresse.
- **Le créateur entre en premier** dans son salon.
- **Pings** toutes les 2 s, contrôle de présence toutes les 3 s ; connexion muette depuis 20 s fermée. Un joueur resté « connecté » sans aucune connexion (redémarrage du serveur lors d'une mise en ligne) passe déconnecté au bout de 20 s.
- **Vote anonyme** : le client désigne le meme par sa position dans l'ordre de passage (`{ type: 'vote', index, note }`), jamais par son auteur, qu'il ne connaît pas. Pendant le vote, la liste des joueurs ne marque plus l'auteur comme « fait » (ça le trahissait).
- Moteur : `heartbeat()`, `phaseStartedAt` dans la vue, compteurs de vote, `fauto.libraryEmpty`.

## Prochaine étape : lot 4 (finition)

Feuille de route du cahier : étapes 8 (habillage : iPhone, Android, ordinateur, ajout à l'écran d'accueil / PWA), 9 (profils, XP, galerie légendaire — les données sont déjà enregistrées) et 10 (tests complets et documentation).

## Points d'attention

- Une limite de CPU courte s'applique aux Workers gratuits : le hachage des mots de passe se fait dans le Durable Object `Group`.
- Toujours passer par `view.ts` pour ce qui part vers un téléphone.
- Les photos de test seront fournies plus tard par le mainteneur.

## Tester en local

```bash
npm run dev:worker   # construit l'application puis lance le serveur sur http://localhost:8787
```

Les données locales (comptes, photos, parties) vivent dans `.wrangler/state` ; supprimer ce dossier repart de zéro. Attention : reconstruire l'application (`npm run build`) pendant que `wrangler dev` tourne redémarre le serveur local et coupe les connexions (l'application se reconnecte toute seule).
