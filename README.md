# Des Snaps et des Cons

Party game multijoueur du Groupe des 7 : chacun reçoit une photo du groupe, la légende, et tout le monde note les memes sur 22. Trois manches, une Fauto pour semer le chaos, un podium à la fin.

- Jouable depuis un navigateur (ordinateur, téléphone, tablette), installable sur l'écran d'accueil.
- Hébergé gratuitement sur Cloudflare (Workers + Durable Objects), sans carte bancaire.
- Cahier des charges complet : voir le document de conception partagé.

## État d'avancement

| Lot | Contenu | État |
| --- | --- | --- |
| 1. Fondations | Mise en place, moteur de jeu testé, maquettes | En cours |
| 2. Cœur multijoueur | Comptes, photothèque, salon temps réel | À venir |
| 3. Jeu complet | Partie jouable de bout en bout, Fauto | À venir |
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
  server/          Worker Cloudflare et Durable Objects (Salon par partie, Groupe unique)
  client/          Application Svelte
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
