"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  columnIndexFromA1,
  getGoogleSheetsConfigurationError,
  normalizeGoogleSheetAlias,
  parseGoogleSheetAliases,
  parseGoogleSheetColumnValues,
  readGoogleSheetColumnValues,
  type GoogleSheetTrainingMap,
} from "@/lib/google-sheets";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  findSiteOnlySheetRegistrations,
  sheetStatusMismatch,
  type ActiveRegistrationStatus,
  type RegistrationForSheetComparison,
  type SiteOnlySheetRegistration,
} from "@/lib/google-sheets-reconciliation";

type Result = { ok: true } | { ok: false; error: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TEST_SPREADSHEET_ID = "1N7wveM113ekr_oO1Z0Fhmn0U7N25_BXjny7tdlo-0Mg";

export type GoogleSheetPreviewRow = {
  cell: string;
  displayName: string;
  sheetStatus: "confirmed" | "queue";
  playerName: string | null;
  state: "new" | "registered" | "cancelled" | "new_guest" | "unidentified" | "duplicate" | "needs_payment";
  siteStatusMismatch: ActiveRegistrationStatus | null;
};

type PreviewResult =
  | { ok: true; rows: GoogleSheetPreviewRow[]; siteOnly: SiteOnlySheetRegistration[]; needsMigration: boolean; canImport: boolean }
  | { ok: false; error: string };

/** Tikai nolasa Sheets kolonnu un DB — neko neimportē un nepārraksta. */
export async function previewGoogleSheetColumn(mapId: string): Promise<PreviewResult> {
  await requireAdmin();
  if (!UUID_RE.test(mapId)) return { ok: false, error: "Nederīgs kartējums." };

  const configurationError = getGoogleSheetsConfigurationError();
  if (configurationError) return { ok: false, error: configurationError };

  const supabase = await createClient();
  const { data: map, error: mapError } = await supabase
    .from("google_sheet_training_maps")
    .select("id, training_id, spreadsheet_id, sheet_name, column_index, count_row, roster_start_row, roster_end_row, queue_start_row, queue_end_row, enabled")
    .eq("id", mapId)
    .maybeSingle();
  if (mapError) return { ok: false, error: mapError.message };
  if (!map || !map.enabled) return { ok: false, error: "Aktīvs kartējums nav atrasts." };
  if (map.spreadsheet_id !== (process.env.GOOGLE_SHEETS_TEST_SPREADSHEET_ID ?? TEST_SPREADSHEET_ID)) {
    return { ok: false, error: "Pārbaude atļauta tikai testa tabulas kopijai." };
  }
  if (map.roster_start_row !== 8 || map.roster_end_row !== 21) {
    return { ok: false, error: "Šim kartējumam nav sagaidītās 8.–21. rindas struktūras." };
  }

  try {
    // Pirms 00009 migrācijas DB vēl glabā 24. rindu. Priekšskatījumā jau
    // parādām īsto 23. rindu, nemainot DB vai Sheets.
    const previewMap = { ...map, queue_start_row: 23 } as GoogleSheetTrainingMap;
    const values = await readGoogleSheetColumnValues(previewMap);
    const entries = parseGoogleSheetColumnValues(previewMap, values);
    const normalizedNames = [...new Set(entries.map((entry) => normalizeGoogleSheetAlias(entry.displayName)))];
    const [aliasResult, guestResult, registrationResult] = await Promise.all([
      normalizedNames.length
        ? supabase.from("google_sheet_player_aliases").select("normalized_alias, user_id").in("normalized_alias", normalizedNames)
        : Promise.resolve({ data: [], error: null }),
      normalizedNames.length
        ? supabase.from("users")
            .select("id, google_sheet_normalized_name")
            .eq("identity_status", "unidentified")
            .eq("google_sheet_spreadsheet_id", map.spreadsheet_id)
            .in("google_sheet_normalized_name", normalizedNames)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("registrations")
        .select("user_id, status, user:users(name, nickname, identity_status)")
        .eq("training_id", map.training_id),
    ]);
    const { data: aliases, error: aliasesError } = aliasResult;
    if (aliasesError) return { ok: false, error: aliasesError.message };
    const userByAlias = new Map((aliases ?? []).map((alias) => [alias.normalized_alias, alias.user_id]));
    const { data: guests, error: guestsError } = guestResult;
    if (guestsError) return { ok: false, error: guestsError.message };
    const guestByName = new Map((guests ?? []).map((guest) => [guest.google_sheet_normalized_name, guest.id]));
    const { data: registrations, error: registrationsError } = registrationResult;
    if (registrationsError) return { ok: false, error: registrationsError.message };
    const registrationRows = (registrations ?? []) as unknown as RegistrationForSheetComparison[];
    const userIds = [...new Set([
      ...(aliases ?? []).map((alias) => alias.user_id),
      ...(guests ?? []).map((guest) => guest.id),
    ])];
    const { data: users, error: usersError } = userIds.length
      ? await supabase.from("users").select("id, name, nickname, player_type, semester_paid_until").in("id", userIds)
      : { data: [], error: null };
    if (usersError) return { ok: false, error: usersError.message };

    const profiles = new Map((users ?? []).map((user) => [user.id, user]));
    const registrationByUser = new Map(registrationRows.map((registration) => [registration.user_id, registration.status]));
    const sheetUserIds = new Set<string>();
    const seen = new Set<string>();
    const today = new Date().toISOString().slice(0, 10);
    const rows: GoogleSheetPreviewRow[] = entries.map((entry) => {
      const normalizedName = normalizeGoogleSheetAlias(entry.displayName);
      const identifiedId = userByAlias.get(normalizedName);
      const userId = identifiedId ?? guestByName.get(normalizedName);
      if (userId) sheetUserIds.add(userId);
      const profile = userId ? profiles.get(userId) : null;
      const key = userId ?? `guest:${normalizedName}`;
      let state: GoogleSheetPreviewRow["state"];
      if (seen.has(key)) state = "duplicate";
      else if (!identifiedId && !userId) state = "new_guest";
      else if (!profile) state = "new_guest";
      else if (registrationByUser.get(userId) === "cancelled") state = "cancelled";
      else if (registrationByUser.has(userId)) state = identifiedId ? "registered" : "unidentified";
      else if (!identifiedId) state = "new_guest";
      else if (profile.player_type !== "core" || !profile.semester_paid_until || profile.semester_paid_until < today) state = "needs_payment";
      else state = "new";
      seen.add(key);
      return {
        cell: entry.cell,
        displayName: entry.displayName,
        sheetStatus: entry.status,
        playerName: profile?.nickname?.trim() || profile?.name?.trim() || null,
        state,
        siteStatusMismatch: sheetStatusMismatch(userId ? registrationByUser.get(userId) : undefined, entry.status),
      };
    });
    const siteOnly = findSiteOnlySheetRegistrations(registrationRows, sheetUserIds);
    const blocking = rows.some((row) => ["duplicate", "needs_payment"].includes(row.state));
    return { ok: true, rows, siteOnly, needsMigration: map.queue_start_row !== 23, canImport: !blocking && map.queue_start_row === 23 };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Kolonnu neizdevās nolasīt." };
  }
}

export async function saveGoogleSheetTrainingMap(formData: FormData): Promise<Result> {
  await requireAdmin();
  const trainingId = String(formData.get("training_id") ?? "");
  const spreadsheetId = String(formData.get("spreadsheet_id") ?? "").trim();
  const sheetName = String(formData.get("sheet_name") ?? "").trim();
  const gid = Number(formData.get("sheet_gid"));
  const column = String(formData.get("column") ?? "").trim().toUpperCase();
  const columnPosition = columnIndexFromA1(`${column}1`);

  if (!UUID_RE.test(trainingId)) return { ok: false, error: "Izvēlies derīgu treniņu." };
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(spreadsheetId)) {
    return { ok: false, error: "Nederīgs Google Sheets ID." };
  }
  if (!sheetName || sheetName.length > 100) {
    return { ok: false, error: "Norādi Google Sheets cilnes nosaukumu." };
  }
  if (!Number.isSafeInteger(gid) || gid < 0 || !columnPosition) {
    return { ok: false, error: "Nederīgs cilnes ID vai kolonna." };
  }

  const supabase = await createClient();
  const { data: training } = await supabase
    .from("trainings")
    .select("id")
    .eq("id", trainingId)
    .maybeSingle();
  if (!training) return { ok: false, error: "Treniņš nav atrasts." };

  const { error } = await supabase.from("google_sheet_training_maps").upsert(
    {
      training_id: trainingId,
      spreadsheet_id: spreadsheetId,
      sheet_gid: gid,
      sheet_name: sheetName,
      column_index: columnPosition.columnIndex,
      enabled: true,
    },
    { onConflict: "training_id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/integrations/google-sheets");
  return { ok: true };
}

export async function addGoogleSheetPlayerAlias(formData: FormData): Promise<Result> {
  await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const aliases = parseGoogleSheetAliases(String(formData.get("display_alias") ?? ""));
  if (!UUID_RE.test(userId)) return { ok: false, error: "Izvēlies spēlētāju." };
  if (aliases.length === 0) {
    return { ok: false, error: "Norādi vismaz vienu spēlētāja vārdu no Sheets." };
  }
  if (aliases.length > 20 || aliases.some((alias) => alias.display_alias.length > 120)) {
    return { ok: false, error: "Vienā reizē drīkst pievienot līdz 20 variantiem, katru līdz 120 rakstzīmēm." };
  }

  const supabase = await createClient();
  const { data: selectedUser, error: userError } = await supabase
    .from("users")
    .select("id, identity_status")
    .eq("id", userId)
    .maybeSingle();
  if (userError) return { ok: false, error: userError.message };
  if (!selectedUser || selectedUser.identity_status !== "identified") {
    return { ok: false, error: "Vārdu drīkst sasaistīt tikai ar identificētu 3SM profilu." };
  }
  const { data: existing, error: lookupError } = await supabase
    .from("google_sheet_player_aliases")
    .select("normalized_alias, user_id")
    .in("normalized_alias", aliases.map((alias) => alias.normalized_alias));
  if (lookupError) return { ok: false, error: lookupError.message };
  const existingByName = new Map((existing ?? []).map((alias) => [alias.normalized_alias, alias.user_id]));
  const conflictingAlias = aliases.find((alias) => {
    const owner = existingByName.get(alias.normalized_alias);
    return owner && owner !== userId;
  });
  if (conflictingAlias) {
    return { ok: false, error: `Vārds “${conflictingAlias.display_alias}” jau ir sasaistīts ar citu spēlētāju.` };
  }

  const newAliases = aliases.filter((alias) => !existingByName.has(alias.normalized_alias));
  if (newAliases.length > 0) {
    // INSERT ar unikālo ierobežojumu neļauj sacensības gadījumā pārņemt cita
    // spēlētāja vārdu (atšķirībā no UPSERT uz normalized_alias).
    const { error } = await supabase.from("google_sheet_player_aliases").insert(
      newAliases.map((alias) => ({ ...alias, user_id: userId }))
    );
    if (error) return { ok: false, error: error.message };
  }

  const admin = createAdminClient();
  for (const alias of aliases) {
    const { error } = await admin.rpc("link_google_sheet_guest_to_user", {
      p_spreadsheet_id: process.env.GOOGLE_SHEETS_TEST_SPREADSHEET_ID ?? TEST_SPREADSHEET_ID,
      p_normalized_name: alias.normalized_alias,
      p_user_id: userId,
    });
    if (error) return { ok: false, error: `Vārds saglabāts, bet viesa pieteikumus neizdevās sasaistīt: ${error.message}` };
  }

  revalidatePath("/admin/integrations/google-sheets");
  revalidatePath("/");
  return { ok: true };
}
