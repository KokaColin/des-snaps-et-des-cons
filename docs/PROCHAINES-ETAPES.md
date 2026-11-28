# Où on en est — reprise du projet

Dernière mise à jour : 28 novembre 2026.

## Liens

- Site en ligne : https://des-snaps-et-des-cons.kokacolin.workers.dev/ (déployé automatiquement depuis `main` par Cloudflare Workers Builds)
- Cahier des charges : [CAHIER-DES-CHARGES.md](CAHIER-DES-CHARGES.md) (document de travail : https://claude.ai/artifact/11ExaHKnnMkttWKS2wzGjK)
- Direction artistique : [DIRECTION-ARTISTIQUE.md](DIRECTION-ARTISTIQUE.md) (maquettes : https://claude.ai/artifact/3uDKpuxXcFMma1RiGR5R97)

## Fait

- Lot 1 terminé : mise en place, moteur de jeu pur (`src/shared/`) avec 78 tests, maquettes validées.
- Règle ajoutée après les maquettes : l'organisateur est compté prêt d'office.

## Méthode convenue

- Avancer lot par lot (voir feuille de route du cahier) ; une pull request par lot, validée par le mainteneur avant fusion.
- `npm test` et `npm run check` doivent passer avant chaque commit (voir `CLAUDE.md`).
- Ne prendre aucune décision de règle de jeu sans l'accord du mainteneur ; mettre à jour le cahier des charges et les tests en même temps.
- Gratuité stricte : offre gratuite Cloudflare, pas de R2, pas de carte bancaire.

## Prochaine étape : lot 2 (cœur multijoueur)

1. **Comptes** (`Group` Durable Object) : choix du nom parmi les 7, création du mot de passe à la première connexion (hachage PBKDF2 via WebCrypto, exécuté dans le Durable Object), session longue en cookie ou jeton, invités sans compte, limitation des tentatives.
2. **Photothèque** : envoi multiple, compression navigateur (1600 px WebP + miniature 400 px), stockage en SQLite dans `Group` (blobs ≤ 2 Mo), catégories Iconique / Fauto (« screen random »), corbeille 30 jours, export.
3. **Salon temps réel** (`GameRoom`) : WebSocket avec hibernation, état du moteur persisté en SQLite à chaque changement, alarmes réglées sur `nextWakeAt()`, appel de `tick()` à chaque alarme et après chaque (dé)connexion, envoi à chaque joueur de `viewFor()` uniquement.
4. Puis lot 3 : interface de jeu complète selon les maquettes, et la Fauto.

## Points d'attention

- Une limite de CPU courte s'applique aux Workers gratuits : faire le hachage des mots de passe dans un Durable Object.
- Toujours passer par `view.ts` pour ce qui part vers un téléphone.
- Les photos de test seront fournies plus tard par le mainteneur.
