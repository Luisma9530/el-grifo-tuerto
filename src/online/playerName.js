// The name last used to play online in this browser. Kept apart from
// useOnlineRoom (sessions, protocol, security) so the landing page can fill in
// the "join a room" window without loading the online layer.
import { cleanName } from './room';

const NAME_KEY = 'grifo_online_name';

/** The name last used to play online in this browser. */
export const storedPlayerName = () => {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
};
export const storePlayerName = name => {
  try { localStorage.setItem(NAME_KEY, cleanName(name)); } catch { /* ignore */ }
};
