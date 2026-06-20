import { useCallback, useEffect, useState } from 'react';
import {
  navigateToView,
  readDashboardView,
  type DashboardView,
} from '../utils/dashboardRoutes';

export function useDashboardRoute(initial: DashboardView = 'home') {
  const [view, setViewState] = useState<DashboardView>(() => {
    const fromUrl = readDashboardView();
    return fromUrl !== 'home' || window.location.pathname !== '/'
      ? fromUrl
      : initial;
  });

  useEffect(() => {
    const onPop = () => setViewState(readDashboardView());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    navigateToView(view, true);
  }, []);

  const setView = useCallback((next: DashboardView) => {
    setViewState(next);
    navigateToView(next);
  }, []);

  return { view, setView };
}
