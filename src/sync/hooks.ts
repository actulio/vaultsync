import { AppState } from 'react-native';
import { syncOnce } from './orchestrator';

export function startSyncOnForeground(): () => void {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncOnce();
  });
  return () => sub.remove();
}
