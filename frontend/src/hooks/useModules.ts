import { useQuery } from '@tanstack/react-query';
import { settingsApi, type ModuleConfig, MODULE_KEYS } from '../api/settings.api';
import { useAuthStore } from '../store/auth.store';

const DEFAULT_CONFIG: ModuleConfig = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, true]),
) as ModuleConfig;

export function useModules() {
  const isLoggedIn = !!useAuthStore((s) => s.token);

  const { data } = useQuery({
    queryKey: ['settings', 'modules'],
    queryFn: settingsApi.getModuleConfig,
    enabled: isLoggedIn,
    staleTime: 5 * 60_000,
    retry: false,
    // If the fetch fails (e.g. network error), fall back to all-enabled
    placeholderData: DEFAULT_CONFIG,
  });

  return data ?? DEFAULT_CONFIG;
}

export function useIsModuleEnabled(module: keyof ModuleConfig): boolean {
  const cfg = useModules();
  return cfg[module] !== false;
}
