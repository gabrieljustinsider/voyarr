export const triggerApiMutate = (path?: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('voyarr-api-mutate', { detail: { path } }));
  }
};
