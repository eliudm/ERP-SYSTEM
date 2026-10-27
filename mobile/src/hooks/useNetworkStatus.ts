import { useCallback } from 'react';
import NetInfo, { useNetInfo } from '@react-native-community/netinfo';

// `isConnected`/`isInternetReachable` are `boolean | null` — null means
// "not yet determined" (e.g. briefly on mount, or on browsers that don't
// support the Network Information API, which falls back to navigator.onLine
// on web). Treat anything that isn't a confirmed `false` as online, so a
// slow-to-resolve reachability check doesn't flash the offline banner.
export const useNetworkStatus = () => {
  const netInfo = useNetInfo();
  const isOnline =
    netInfo.isConnected !== false && netInfo.isInternetReachable !== false;

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    return state.isConnected !== false && state.isInternetReachable !== false;
  }, []);

  return { isOnline, refresh };
};
