import { PASSWORD_MIN_LENGTH } from '../../shared/protocol';
import { ApiError } from './api';

/** Codes d'erreur du serveur et du moteur → phrases affichées. */
const MESSAGES: Record<string, string> = {
  network: 'Pas de réseau : vérifie ta connexion.',
  server_error: 'Le serveur a eu un souci. Réessaie.',
  not_found: 'Introuvable.',
  bad_origin: 'Requête refusée.',
  // Comptes
  unknown_member: "Ce nom ne fait pas partie du Groupe des 7.",
  invalid_password: `Mot de passe : ${PASSWORD_MIN_LENGTH} caractères minimum.`,
  wrong_password: 'Mauvais mot de passe.',
  too_many_attempts: 'Trop de tentatives. Réessaie dans quelques minutes.',
  account_not_created: "Ce compte n'a pas encore de mot de passe : recharge la page.",
  members_only: 'Réservé aux membres du Groupe des 7.',
  // Photothèque
  duplicate: 'Déjà dans la photothèque.',
  photo_too_big: 'Image trop lourde, même compressée.',
  invalid_image: 'Format non reconnu.',
  invalid_upload: 'Envoi invalide.',
  invalid_category: 'Catégorie inconnue.',
  // Salon
  no_free_code: 'Impossible de créer la partie, réessaie.',
  game_started: 'La partie a déjà commencé.',
  already_joined: 'Tu es déjà dans cette partie.',
  room_full: 'La partie est complète (7 joueurs).',
  name_taken: 'Ce nom est déjà pris dans la partie.',
  host_must_be_member: "L'organisateur doit être un membre.",
  invalid_name: 'Pseudo : 1 à 12 caractères.',
  too_many_guests: 'Déjà 3 invités dans la partie.',
  not_enough_members: "Il faut plus de membres que d'invités : un membre doit entrer d'abord.",
  not_host: "Seul l'organisateur peut faire ça.",
  cannot_kick_self: "Tu ne peux pas t'exclure toi-même.",
  wrong_phase: "Ce n'est pas le moment.",
  unknown_player: 'Joueur inconnu.',
  not_enough_players: 'Il faut au moins 3 joueurs.',
  too_many_players: '7 joueurs maximum.',
  players_absent: "Quelqu'un est déconnecté.",
  players_not_ready: "Tout le monde n'est pas prêt.",
  not_enough_photos: 'Pas assez de photos iconiques (2 par joueur).',
  bad_message: 'Message incompris par le serveur.',
};

export function errorMessage(e: unknown): string {
  const code = e instanceof ApiError ? e.code : typeof e === 'string' ? e : 'server_error';
  return MESSAGES[code] ?? `Erreur : ${code}`;
}

/** Explication d'un empêchement au lancement, vue depuis le salon. */
export function blockerMessage(code: string): string {
  return MESSAGES[code] ?? code;
}
