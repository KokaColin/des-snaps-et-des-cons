# Des Snaps et des Cons — consignes du projet

- Langue : interface, commentaires et documentation en français.
- Le moteur (`src/shared/`) reste pur : pas d'entrée/sortie, pas d'horloge (toujours un `now` en paramètre), aléatoire via `state.rng` uniquement.
- Toute règle du jeu modifiée = test ajouté ou mis à jour dans `tests/`. `npm test` et `npm run check` doivent passer avant chaque commit.
- Les scores se calculent en fractions exactes (`fraction.ts`), jamais en flottants.
- Rien ne sort vers un client sans passer par `view.ts`.
- Nouveau gadget : un fichier dans `src/shared/gadgets/` qui respecte `gadget.ts`, enregistré dans `gadgets/index.ts`.
- Gratuité stricte : offre gratuite Cloudflare uniquement (Workers, Durable Objects SQLite). Pas de R2, pas de service payant.
