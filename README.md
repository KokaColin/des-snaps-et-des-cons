# Des Snaps et des Cons

Party game multijoueur du Groupe des 7 : chacun reçoit une photo du groupe, la légende, et tout le monde note les memes sur 22. Trois manches, une Fauto pour semer le chaos, un podium à la fin.

- Jouable depuis un navigateur (ordinateur, téléphone, tablette), installable sur l'écran d'accueil.
- Hébergé gratuitement sur Cloudflare (Workers + Durable Objects), sans carte bancaire.
- Cahier des charges : [docs/CAHIER-DES-CHARGES.md](docs/CAHIER-DES-CHARGES.md)
- Direction artistique et maquettes : [docs/DIRECTION-ARTISTIQUE.md](docs/DIRECTION-ARTISTIQUE.md)
- Reprise du projet : [docs/PROCHAINES-ETAPES.md](docs/PROCHAINES-ETAPES.md)

## État d'avancement

| Lot | Contenu | État |
| --- | --- | --- |
| 1. Fondations | Mise en place, moteur de jeu testé, maquettes | Terminé |
| 2. Cœur multijoueur | Comptes, photothèque, salon temps réel | Terminé |
| 3. Jeu complet | Partie jouable de bout en bout, Fauto | En validation |
| 4. Finition | Habillage, profils, galerie, tests complets, doc | À venir |

## Organisation du code

```
src/
  shared/          Moteur de jeu, sans dépendance : utilisé par le serveur et l'application
    config.ts        Règles chiffrées (durées, notes, limites) et noms des membres
    engine.ts        Machine à états : salon, manches, chronos, actions des joueurs
    scoring.ts       Scores exacts (fractions), classement, égalités, badges
    view.ts          Ce que chaque joueur a le droit de voir (filtrage anti-triche)
    gadgets/         Gadgets (V1 : la Fauto) ; un fichier par gadget
    photos.ts        Tirage des photos (sans doublon, les moins jouées d'abord)
    meme.ts          Format d'un meme (photo + zones de texte)
    record.ts        Ce qu'on garde d'une partie terminée
    protocol.ts      Messages échangés entre l'application et le serveur
  server/          Worker Cloudflare et Durable Objects
    index.ts         Routage : /api/rooms, /api/* (vers Group), /ws/:code (vers GameRoom)
    group.ts         Objet unique : comptes, sessions, photothèque (SQLite)
    game-room.ts     Un objet par partie : moteur, WebSocket, chronos (alarmes)
    lib/             Mots de passe, jetons, limitation des tentatives, HTTP
  client/          Application Svelte
    screens/         Accueil, connexion, rejoindre, salon, photothèque ; game/ : éditeur, vote, résultats, fin
    lib/             API, session, temps réel, rendu des memes, compression d'images, export zip
tests/             Tests automatiques du moteur (Vitest)
docs/              Déploiement et maintenance
```

## Commandes

```bash
npm install        # une fois
npm test           # tous les tests du moteur
npm run check      # vérification des types
npm run dev        # application en local (http://localhost:5173)
npm run dev:worker # serveur Cloudflare en local (http://localhost:8787)
npm run deploy     # mise en ligne manuelle (le déploiement automatique est décrit dans docs/)
```

Mise en ligne : voir [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).
