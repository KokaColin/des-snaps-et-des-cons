# Mise en ligne sur Cloudflare (gratuit)

Le jeu tourne sur l'offre gratuite Cloudflare Workers, sans carte bancaire. Une fois le dépôt GitHub relié, chaque fusion sur `main` met le site à jour automatiquement.

## Relier le dépôt GitHub (à faire une seule fois)

1. Se connecter sur [dash.cloudflare.com](https://dash.cloudflare.com).
2. Menu **Workers & Pages** (rubrique Compute) → **Créer** → onglet **Workers** → **Importer un dépôt** (Import a repository).
3. Autoriser Cloudflare à accéder au compte GitHub, puis choisir `des-snaps-et-des-cons`.
4. Réglages de build :
   - Nom du projet : `des-snaps-et-des-cons` (doit correspondre au `name` de `wrangler.jsonc`)
   - Commande de build : `npm run build`
   - Commande de déploiement : `npx wrangler deploy`
   - Branche de production : `main`
5. Valider. Le premier déploiement prend 1 à 2 minutes.

Le site est alors en ligne à une adresse du type `https://des-snaps-et-des-cons.<votre-sous-domaine>.workers.dev`. Le sous-domaine `workers.dev` est choisi à la création du compte (Workers & Pages → réglages du compte).

## Vérifier que tout fonctionne

- La page d'accueil affiche le logo et « Serveur en ligne ».
- `https://…workers.dev/api/health` renvoie `{"ok":true,…}`.

## Réinitialiser le mot de passe d'un membre

Le mainteneur dispose d'un secret `ADMIN_TOKEN` (gratuit, stocké chiffré par Cloudflare).

1. Une seule fois : dans le tableau de bord Cloudflare, Workers & Pages → `des-snaps-et-des-cons` → Paramètres → Variables et secrets → Ajouter → type **Secret**, nom `ADMIN_TOKEN`, valeur : une longue phrase aléatoire gardée pour soi. (Ou en ligne de commande : `npx wrangler secret put ADMIN_TOKEN`.)
2. Pour réinitialiser, par exemple, Maxe :

   ```bash
   curl -X POST https://des-snaps-et-des-cons.<sous-domaine>.workers.dev/api/admin/reset \
     -H "Authorization: Bearer <ADMIN_TOKEN>" \
     -H "Origin: https://des-snaps-et-des-cons.<sous-domaine>.workers.dev" \
     -H "Content-Type: application/json" \
     -d '{"member":"Maxe"}'
   ```

Le compte repart sans mot de passe et toutes ses sessions sont fermées : à sa prochaine connexion, le membre choisit un nouveau mot de passe. Sans secret configuré, l'adresse répond « introuvable ».

## Rester dans le gratuit

- Aucun moyen de paiement n'est enregistré : un dépassement de quota ne peut rien coûter, l'action échoue jusqu'à la remise à zéro quotidienne (minuit UTC).
- Les quotas et la consommation estimée sont détaillés dans le cahier des charges (section Architecture).
- Ne pas activer R2 ni le plan Workers Paid.
