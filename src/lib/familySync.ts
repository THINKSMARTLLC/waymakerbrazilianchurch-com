export const FAMILY_FINANCIALS_UPDATED_EVENT = "waymaker:family-financials-updated";

export function emitFamilyFinancialsUpdated(detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(FAMILY_FINANCIALS_UPDATED_EVENT, {
      detail,
    }),
  );
}

export function subscribeToFamilyFinancialsUpdated(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => callback();
  window.addEventListener(FAMILY_FINANCIALS_UPDATED_EVENT, handler as EventListener);

  return () => {
    window.removeEventListener(FAMILY_FINANCIALS_UPDATED_EVENT, handler as EventListener);
  };
}