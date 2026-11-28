# Direction artistique — validée le 28 novembre 2026

Maquettes de référence (canevas en ligne, avec commentaires) : https://claude.ai/artifact/3uDKpuxXcFMma1RiGR5R97
Copie des fichiers : `docs/maquettes/*.dc.html` (format canevas Claude Design : HTML + styles inline, à lire comme référence visuelle et de valeurs, pas à exécuter tel quel).

## Esprit

Fanzine collé sur une table de bar sombre (papier crème, scotch, tampons, polaroïds), cassé par une énergie **graffiti punk** : lettrage penché, décalage de couleur rose/jaune, formes déchirées. Lisibilité d'abord : l'effet est réservé aux pièces fortes.

## Couleurs

| Rôle | Valeur |
| --- | --- |
| Fond (ardoise + grain de points 5 px) | `#17161b` |
| Papier / texte clair | `#f3ecdc` |
| Jaune (SNAPS, accents, scotch `rgba(255,228,51,.85)`) | `#ffe433` |
| Rose (CONS, accents, décalage glitch) | `#ff4d8d` |
| Rouge tampon | `#e63b2e` |
| Violet explosion du logo | `#2b1340` |
| Bandes sombres (badges) | `#2a2730` |
| Textes secondaires | `#d8d0bd`, `#a39b88`, `#6b6558` |
| Couleurs joueurs (exemples) | Maxe `#ffc23d`, Gasdard `#6fdc7a`, Gaslard `#a678ff`, Raffael `#3ec6e0` |

Un seul jaune dans tout le jeu (`#ffe433`), y compris dans la palette de texte de l'éditeur.

## Typographie (2 polices d'interface, gratuites Google Fonts)

- **Bangers** : tout ce qui doit claquer — titres, scores, code de partie, tampons (PRÊT/ABSENT, « 22 · prénom »), badges, chronos, gros boutons, initiales.
- **Archivo** (500/700/900) : tout ce qui se lit — noms, textes, petites mentions.
- **Anton** : uniquement dans le contenu des memes (style « meme classique » de l'éditeur).

## Règles de style

- **Titres de haut de page** : Bangers, `skew(-8deg) rotate(-2deg)`, liseré glitch de 1 px seulement (`1px 1px 0 #ff4d8d, -1px 0 0 #ffe433`). La fin du titre (« /3 », « MANCHE 1 ») reste de la même couleur, juste plus petite (0.62em).
- **Ombre rose portée** : réservée au logo, à la grosse note du vote et aux scores tagués sur les memes. Pas ailleurs.
- **Contours noirs** : uniquement le *lettrage* du logo, des scores et le texte des memes (`-webkit-text-stroke` + `paint-order: stroke fill`). **Aucun contour noir plein sur les boîtes, boutons, pastilles ou curseurs.** Les ombres portées dures restent.
- **Scores** : tagués directement sur le coin de la photo, sans fond (Bangers, contour noir 5 px, ombre rose 3 px, « /22 » à 0.42em ; jaune pour le n°1, crème sinon). Laisser de la marge au-dessus pour qu'ils ne soient pas coupés.
- **Gros boutons** (`.big`) : Bangers 30 px, `skew(-6deg) rotate(-1deg)`, ombre dure `6px 6px 0 #000`, au clic `translate(4px,4px)` et ombre 2 px (+ vibration dans le jeu). Désactivé : pointillés gris.
- **Formes** : bords déchirés (clip-path irrégulier) pour les bandes de badges et les étiquettes de couleur, légère ombre via `filter: drop-shadow(2px 2px 0 #000)` sur un conteneur.
- **Pictogrammes** : à plat, sans contour (couronne, pièce cassée, rat). Jamais d'emoji.
- **Chrono** : anneau qui se vide + chiffres Bangers ; passe en rose sous 10 s.

## Écrans validés

1. **Salon** : logo graffiti (explosion violette à bord rose, SNAPS jaune / CONS rose lettre par lettre, « & » dans une étoile, « des » en étiquettes), code de partie sur papier scotché, liste des joueurs en bandes de papier avec tampons, bouton unique selon le rôle.
2. **Éditeur** : polaroïd, zone sélectionnée en pointillés jaunes, styles Classique / Bandeau Snap, 8 pastilles, + Texte (2/3), Changer d'image (1), VALIDER MON MEME.
3. **Vote** : meme « auteur : mystère », note par paliers (voir cahier), curseur dont le rail porte le dégradé gris → crème → jaune → orange → rose, poignée losange crème.
4. **Résultats** : grands polaroïds défilants (#rang, score tagué, tampons 22), autocollant jaune « FAUTO ! » flottant en bas à droite pour le détenteur (pas de bandeau).
5. **Fin de partie** : podium (points en jaune penché, distincts des noms), 3 badges gwero, récap horizontal, REVANCHE !
