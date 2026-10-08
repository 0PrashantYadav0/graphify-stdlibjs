import { useCallback, useState } from 'react';

/** Which tree nodes are open. One implementation for every tree view. */
export function useExpansion(initial: Iterable<string>) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initial));
  /** Open a closed node or close an open one; returns true when it opened. */
  const toggle = useCallback(
    (key: string): boolean => {
      const opening = !expanded.has(key);
      setExpanded((prev) => {
        const next = new Set(prev);
        if (opening) next.add(key);
        else next.delete(key);
        return next;
      });
      return opening;
    },
    [expanded],
  );
  /** Replace the open set: a new tree. */
  const reset = useCallback((keys: Iterable<string>) => setExpanded(new Set(keys)), []);
  /** Open these as well, keeping what the user already opened. */
  const merge = useCallback((keys: Iterable<string>) => setExpanded((prev) => new Set([...prev, ...keys])), []);
  return { expanded, toggle, reset, merge };
}
