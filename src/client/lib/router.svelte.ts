/** Navigation minimale par l'adresse (History API) : /, /connexion, /rejoindre, /p/CODE, /photos. */
export const route = $state({ path: location.pathname, search: location.search });

export function go(path: string, replace = false): void {
  if (replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  route.path = location.pathname;
  route.search = location.search;
  window.scrollTo(0, 0);
}

window.addEventListener('popstate', () => {
  route.path = location.pathname;
  route.search = location.search;
});

/** Destination de retour après connexion (uniquement un chemin interne). */
export function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}
