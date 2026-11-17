export type ActiveRegistrationStatus = "confirmed" | "queue";

export type RegistrationForSheetComparison = {
  user_id: string;
  status: ActiveRegistrationStatus | "cancelled";
  user: {
    name: string | null;
    nickname: string | null;
    identity_status: "identified" | "unidentified";
  } | null;
};

export type SiteOnlySheetRegistration = {
  userId: string;
  displayName: string;
  status: ActiveRegistrationStatus;
  identityStatus: "identified" | "unidentified";
};

/** Tikai salīdzinājums: tukša Sheet šūna pati par sevi nav atcelšanas komanda. */
export function findSiteOnlySheetRegistrations(
  registrations: RegistrationForSheetComparison[],
  sheetUserIds: Iterable<string>
): SiteOnlySheetRegistration[] {
  const sheetIds = new Set(sheetUserIds);
  return registrations
    .filter((registration) => registration.status !== "cancelled" && !sheetIds.has(registration.user_id))
    .map((registration) => ({
      userId: registration.user_id,
      displayName: registration.user?.nickname?.trim() || registration.user?.name?.trim() || "Spēlētājs",
      status: registration.status as ActiveRegistrationStatus,
      identityStatus: registration.user?.identity_status ?? "identified",
    }));
}

export function sheetStatusMismatch(
  siteStatus: RegistrationForSheetComparison["status"] | undefined,
  sheetStatus: ActiveRegistrationStatus
): ActiveRegistrationStatus | null {
  return siteStatus && siteStatus !== "cancelled" && siteStatus !== sheetStatus
    ? siteStatus
    : null;
}
