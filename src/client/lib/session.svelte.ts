import type { MemberName } from '../../shared/config';
import type { MeResponse } from '../../shared/protocol';
import { api } from './api';

/** Membre connecté sur cet appareil (cookie de session d'un an) et état des 7 comptes. */
export const session = $state({
  loaded: false,
  offline: false,
  member: null as MemberName | null,
  accounts: [] as MeResponse['accounts'],
});

export async function refreshSession(): Promise<void> {
  try {
    const me = await api<MeResponse>('/api/me');
    session.member = me.member;
    session.accounts = me.accounts;
    session.offline = false;
  } catch {
    session.offline = true;
  } finally {
    session.loaded = true;
  }
}

export async function login(member: MemberName, password: string, create: boolean): Promise<void> {
  await api('/api/login', { method: 'POST', json: { member, password, create } });
  await refreshSession();
}

export async function logout(): Promise<void> {
  await api('/api/logout', { method: 'POST', json: {} });
  await refreshSession();
}
