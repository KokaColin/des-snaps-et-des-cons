# Des Snaps et des Cons — Cahier des charges V1

Version de référence : 28 novembre 2026. Document de travail complet (avec schémas) : https://claude.ai/artifact/11ExaHKnnMkttWKS2wzGjK

Toutes les décisions ci-dessous ont été validées par le mainteneur. En cas de doute, ce fichier fait foi ; toute modification de règle passe par une mise à jour de ce fichier **et** des tests (`tests/`).

## Résumé

Party game web (PWA) pour le Groupe des 7 : 3 manches, une photo du groupe par joueur, une légende, des notes sur 22, et une Fauto pour semer le chaos. Une partie dure environ 6 à 12 minutes et se joue entièrement sur téléphone (au bar, en appart ou sur Discord).

**Dans la V1**

- Comptes pour les 7 membres (mot de passe personnel), invités sans compte pour compléter une partie.
- Salon avec code ou lien, 3 à 7 joueurs, toujours plus de membres que d'invités.
- Éditeur de meme rapide (jusqu'à 3 zones de texte, 2 styles, 8 couleurs).
- Vote anonyme et synchronisé, un meme à la fois, note de 0 à 22.
- Gadget Fauto, pendant les résultats de la manche 1 ou de la manche 2.
- Grand récap de fin de partie, podium, badges, téléchargement des memes.
- Photothèque commune (Iconiques et Fauto), corbeille, galerie des memes légendaires.
- Profil simple : statistiques, XP, meilleures créations.

**Hors V1, mais prévu dans l'architecture** : autres gadgets, nouvelles catégories de photos, mode écran partagé, polices supplémentaires, historique détaillé, variantes de règles, changement de pseudo.

## Règles du jeu

Une partie = 3 manches ; le gagnant est celui qui cumule le plus de points (66 au maximum). Aucun bonus ni malus en dehors de ces règles.

### Joueurs

- 3 à 7 joueurs. Seul un membre peut créer une partie.
- Membres : Trystan, Raffael, Maxe, Gasdard, Gaslard, Caulin, Tibaud — chacun une seule fois par partie.
- Invités : pseudo libre de 12 caractères au plus, badge « invité », 3 au maximum.
- À l'entrée dans le salon, toujours **strictement plus de membres que d'invités** (2+1, 4+3, 7+0…). La règle ne s'applique plus une fois la partie lancée.
- **L'organisateur est compté prêt d'office.** Il n'a qu'un bouton « Lancer la partie », grisé avec un compteur « 3/5 PRÊTS » tant que tout le monde n'est pas prêt. Les autres joueurs ont seulement « Je suis prêt ».

### Déroulement d'une manche

1. **Attribution** : chaque joueur reçoit une photo iconique au hasard (ou sa Fauto imposée). Jamais deux fois la même photo dans une manche ; les photos les moins récemment jouées passent en priorité.
2. **Création (90 s)** : le joueur légende sa photo. Il peut changer d'image une fois, sauf si c'est une Fauto. Les autres voient qu'il a validé, jamais le contenu. À la fin du chrono, le meme part tel quel (image seule s'il est vide).
3. **Vote (15 s par meme)** : les memes défilent un par un pour tout le monde, sans nom d'auteur. Chacun note de 0 à 22. Sur son propre meme : « c'est le tien », pas de vote. Une note validée est définitive. Passage anticipé au meme suivant dès que tous les votants connectés ont noté.
4. **Résultats rapides (30 s, ou 40 s si une Fauto reste jouable)** : chaque meme revient avec son score, son auteur et la note de chaque votant ; les 22 sont tamponnés. Aucun total cumulé avant la fin (suspense). En manches 1 et 2, c'est aussi la fenêtre de la Fauto.
5. Court chargement (pas d'entracte), puis manche suivante. La manche 3 est annoncée « dernière manche » avec une mise en scène plus forte.

### Calcul des scores

- Score d'un meme = **moyenne des notes réellement données**, sur 22, affichée avec une décimale, calculée en fractions exactes.
- Vote manquant (déconnexion, chrono) = remplacé par la moyenne des autres, donc sans effet sur le score.
- Meme sans aucun vote réel : 11/22.
- Joueur absent pendant toute une création : son image part sans texte et elle est notée normalement.
- Score de manche d'un joueur = score de son meme. Score final = somme des 3 manches.
- **Meme légendaire** : toutes les notes réelles valent 22, avec au moins 2 notes réelles → galerie légendaire.
- Calcul fait uniquement par le serveur, une seule fois, à la clôture du vote.

### Égalités au classement final

1. Total de points. 2. Nombre de manches gagnées (co-vainqueurs inclus). 3. Meilleur score sur un seul meme. 4. Sinon place partagée (rangs 1, 1, 3…).

### Badges de fin de partie

| Badge | Attribué à | Pictogramme |
| --- | --- | --- |
| goofy ass gwero | Le plus de points | Couronne jaune |
| broke ass gwero | Le moins de points | Pièce cassée |
| shame ass gwero | La plus petite moyenne de notes données (le plus radin) | Mini rat |

En cas d'égalité, le badge est partagé.

## Gadget Fauto

Impose un « screen random » (photo de la bibliothèque Fauto) au prochain meme d'un adversaire. Une seule utilisation par partie, pendant les résultats de la manche 1 ou 2.

- **Attribution** : à la fin de la manche 1, un tiers des joueurs (arrondi à l'inférieur) reçoit une Fauto : 1 de 3 à 5 joueurs, 2 à 6 ou 7. Les invités peuvent être tirés. Le détenteur le voit discrètement ; les autres voient seulement le nombre de Fauto en circulation.
- **Déroulement** : activer (annulable sans conséquence) → roulette de 3 photos Fauto → choix de la photo et d'une cible libre → envoi (le serveur verrouille la cible, premier arrivé).
- **Annulation après la roulette** : inutilisable pendant cette fenêtre ; réutilisable à la fenêtre suivante si on était en manche 1, perdue en manche 2. Un chrono écoulé après la roulette sans envoi compte comme une annulation.
- On ne se cible pas soi-même ; une seule Fauto par cible et par manche ; un joueur peut en recevoir plusieurs dans la partie.
- La cible est prévenue au début de la manche (« X t'a envoyé une Fauto ! ») ; qui a visé qui est révélé dans les résultats. Photo imposée non changeable ; une Fauto déjà jouée n'est pas reproposée.
- Bibliothèque Fauto vide : gadget grisé avec invitation à en ajouter.

## Photothèque

- Réservée aux 7 membres connectés, jamais aux invités. Deux bibliothèques : **Iconiques** (tirées en partie) et **Fauto**, présentées à l'import comme « screen random ».
- Envoi multiple depuis téléphone ou ordinateur ; catégorie obligatoire (Iconique par défaut), modifiable ensuite ; compression dans le navigateur (1600 px, WebP, ~150–300 Ko) ; doublons exacts refusés ; on enregistre l'auteur, la date, le nombre d'utilisations et la dernière utilisation.
- Grille, filtres (catégorie, membre), tri par date, plein écran, compteurs.
- Tout membre peut supprimer → corbeille 30 jours restaurable par tous. Une photo d'un meme légendaire est conservée.
- Lancement impossible s'il y a moins de 2 Iconiques par joueur.
- Galerie légendaire : memes 100 % de 22, avec auteur, date et votants (mention « invité » le cas échéant).

## Comptes, profils et invités

- Compte membre : choix du nom parmi les 7, mot de passe (6 caractères min.) à la première connexion, session d'un an, plusieurs appareils. Réinitialisation par le mainteneur. Mots de passe hachés.
- Invité : rejoint par lien ou code, saisit un pseudo ; session limitée à la partie (et à la revanche).
- Profil : parties jouées, victoires, moyenne reçue, 22 reçus et donnés, badges, memes légendaires, 6 meilleurs memes ; visible par tous les membres.
- XP (sans effet sur le jeu) : partie terminée +10, chaque point reçu +1, chaque 22 reçu +5, victoire +30, meme légendaire +50. Niveau N = 100 × N XP de plus que le précédent. Seules les parties terminées comptent.

## Écrans

Accueil, Connexion, Rejoindre, Salon, Éditeur, Attente, Vote, Résultats de manche (+ autocollant Fauto), Annonces, Fin de partie, Photothèque, Galerie légendaire, Profil. Maquettes des écrans clés : `docs/maquettes/` et [DIRECTION-ARTISTIQUE.md](DIRECTION-ARTISTIQUE.md).

- **Éditeur** : modèle haut/bas d'office, 3 zones max déplaçables, styles « classique meme » et « bandeau Snap », 8 couleurs, aperçu = image finale.
- **Vote** : grand chiffre au centre et curseur 0–22 (pas de raccourcis). L'aspect de la note évolue par paliers : 0 triste, 1–11 progression du gris au crème, 12–21 du jaune à l'orange, 22 version « LÉGENDAIRE ! » avec explosion.
- **Fin de partie** : révélation du dernier au premier, podium, badges, récap de tous les memes triés par score (défilement horizontal, le suivant dépasse sur le bord) avec score tagué et tampons 22, bouton Télécharger (image brute), bouton Revanche.

## États d'une partie

Salon → [Attribution → Création → Vote → Résultats → Chargement] × 3 → Fin de partie → (Revanche → Salon). Depuis n'importe quel état : arrêt si moins de 2 joueurs restent connectés pendant 60 s. C'est le serveur qui fait passer tout le salon d'un état à l'autre ; un joueur qui revient reçoit l'état courant et le temps restant.

## Déconnexions, erreurs et sécurité

- Jeton de joueur par appareil : retour automatique au bon écran avec le bon chrono.
- « Absent » après 5 s sans signe de vie ; place réservée toute la partie ; les chronos continuent.
- Organisateur déconnecté : rôle transmis au plus ancien joueur connecté (membre de préférence).
- Partie vidée (< 2 connectés pendant 60 s) : arrêtée, non comptée.
- Personne ne rejoint une partie lancée, sauf reconnexion.
- Serveur seul arbitre ; aucun meme ni auteur envoyé avant la phase prévue ; votes validés côté serveur ; salons isolés ; codes de 5 lettres ; partie expirée après 2 h d'inactivité ; limitation des tentatives de connexion.

## Architecture technique

Tout tient sur l'offre gratuite Cloudflare (Workers + Durable Objects SQLite), **sans carte bancaire**.

- PWA, front Svelte 5 + Vite + TypeScript servi par le Worker.
- Worker : application, API, routage WebSocket.
- Durable Object `GameRoom` (un par partie) : moteur, chronos (alarmes), votes, scores.
- Durable Object `Group` (unique) : comptes, photothèque (fichiers + infos), memes, statistiques, galerie.
- Moteur partagé `src/shared/` (pur, testé).
- Pas de R2 : activation avec moyen de paiement et facturation sans plafond au-delà du gratuit. Stockage SQLite (5 Go ≈ 15 000 photos).

| Ressource gratuite | Limite | Partie à 7 |
| --- | --- | --- |
| Requêtes Worker | 100 000 / jour | ~500 |
| Requêtes Durable Objects | 100 000 / jour (WebSocket entrants 20 pour 1) | < 100 |
| Durée Durable Objects | 13 000 Go-s / jour | ~115 Go-s |
| Stockage SQLite | 5 Go | photo ~250 Ko + miniature ~30 Ko |

## Feuille de route

| # | Étape | Dépend de | Critère de validation | État |
| --- | --- | --- | --- | --- |
| 0 | Mise en place | — | Un push met le site à jour sur workers.dev | Fait |
| 1 | Moteur de jeu | 0 | Chaque règle couverte par un test | Fait (78 tests) |
| 2 | Maquettes | — | Style validé | Fait |
| 3 | Comptes | 0 | Connexion sur 2 appareils, mauvais mot de passe refusé, invité sans photothèque | À faire |
| 4 | Photothèque | 3 | 300 photos importées, grille fluide, restauration corbeille | À faire |
| 5 | Salon temps réel | 1, 3 | 7 navigateurs, reconnexion au bon écran, hôte remplacé | À faire |
| 6 | Partie complète | 4, 5 | Parties à 3 et 7 de bout en bout | À faire |
| 7 | Fauto | 6 | Tous les cas limites rejoués | À faire |
| 8 | Habillage | 2, 6 | iPhone, Android, ordinateur, ajout à l'écran d'accueil | À faire |
| 9 | Profils et galerie | 6 | Stats exactes, téléchargement identique à l'écran | À faire |
| 10 | Tests complets et doc | 7, 8, 9 | Les 11 scénarios du cahier initial passent | À faire |
