import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * When the command palette's "Add X" quick action navigates here, it sets
 * `location.state = { openAdd: true }`. This hook consumes that flag once
 * (opening the given form) and clears it from history state so it doesn't
 * re-trigger on back/forward navigation or a page refresh.
 */
export function useOpenAddFromNavState(openForm: () => void) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const state = location.state as { openAdd?: boolean } | null;
    if (state?.openAdd) {
      openForm();
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);
}
