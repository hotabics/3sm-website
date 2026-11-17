import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildTrainingSheetValues,
  chooseGoogleSheetExportName,
  getGoogleSheetsConfigurationError,
  normalizeGoogleSheetAlias,
  parseGoogleSheetColumnValues,
  readGoogleSheetColumnValues,
  type GoogleSheetTrainingMap,
  writeGoogleSheetValues,
} from "@/lib/google-sheets";

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MS = 10 * 60 * 1000;

type OutboxEvent = { id: string; training_id: string; attempts: number };

type MapRow = GoogleSheetTrainingMap & {
  id: string;
  training_id: string;
  sheet_gid: number;
  enabled: boolean;
};

type RegistrationRow = {
  user_id: string;
  status: "confirmed" | "queue" | "cancelled";
  registered_at: string;
  user: { name: string | null; nickname: string | null; identity_status: "identified" | "unidentified" } | null;
};

function nextAttemptAt(attempts: number) {
  const delayMinutes = [1, 5, 15, 60][Math.min(Math.max(attempts - 1, 0), 3)];
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function playerName(row: RegistrationRow) {
  return row.user?.nickname?.trim() || row.user?.name?.trim() || "Spēlētājs";
}

async function getSnapshot(trainingId: string, sheetNamesByUser: Map<string, string>) {
  const admin = createAdminClient();
  const { data: registrations, error } = await admin
    .from("registrations")
    .select(
      `user_id, status, registered_at,
       user:users(name, nickname, identity_status)`
    )
    .eq("training_id", trainingId)
    .in("status", ["confirmed", "queue"])
    .order("registered_at", { ascending: true });

  if (error) throw new Error(error.message);

  // Arī neapmaksāti pieteikumi ieņem vietu (parādu modelis), tāpēc Sheets
  // rāda visus aktīvos pieteikumus.
  const eligible = (registrations ?? []) as unknown as RegistrationRow[];
  if (eligible.length === 0) return { confirmedNames: [], queueNames: [] };

  // Eksportā lietojam jau apstiprinātu Sheets aliasu. Esošajā kolonnā
  // ierakstīto variantu saglabājam precīzi; citādi nākamais scans to varētu
  // kļūdaini uzskatīt par nesasaistītu vārdu.
  const { data: aliases, error: aliasesError } = await admin
    .from("google_sheet_player_aliases")
    .select("user_id, display_alias, normalized_alias")
    .in("user_id", eligible.map((row) => row.user_id))
    .order("created_at", { ascending: true });
  if (aliasesError) throw new Error(aliasesError.message);
  const aliasesByUser = new Map<string, { display_alias: string; normalized_alias: string }[]>();
  for (const alias of aliases ?? []) {
    const list = aliasesByUser.get(alias.user_id) ?? [];
    list.push(alias);
    aliasesByUser.set(alias.user_id, list);
  }
  const exportName = (row: RegistrationRow) => {
    if (row.user?.identity_status === "unidentified") {
      return sheetNamesByUser.get(row.user_id) ?? playerName(row);
    }
    const name = chooseGoogleSheetExportName(
      sheetNamesByUser.get(row.user_id),
      playerName(row),
      aliasesByUser.get(row.user_id) ?? []
    );
    if (!name) {
      throw new Error(`Spēlētājam “${playerName(row)}” nav apstiprināta Sheets vārda varianta. Pievieno to integrācijas lapā.`);
    }
    return name;
  };
  return {
    confirmedNames: eligible
      .filter((row) => row.status === "confirmed")
      .map(exportName),
    queueNames: eligible.filter((row) => row.status === "queue").map(exportName),
  };
}

async function mark(
  id: string,
  values: Record<string, string | number | null>
) {
  const admin = createAdminClient();
  await admin
    .from("google_sheets_sync_outbox")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/**
 * Pirms eksportēšanas nolasa visu datuma kolonnu. Nesasaistītam vārdam
 * izveido neidentificētu profilu bez Auth konta. Skenēšana importē jaunus
 * pieteikumus; atcelšanu joprojām apstrādā Apps Script.
 */
async function importNewPlayersFromColumn(map: MapRow) {
  if (map.roster_start_row !== 8 || map.roster_end_row !== 21 || map.queue_start_row !== 23) {
    throw new Error("Kartējumam jābūt: spēlētāji 8.–21. rindā, 22. rinda izlaižama, rezerve no 23. rindas. Vispirms piemēro 00011 migrāciju.");
  }
  const testSpreadsheetId = process.env.GOOGLE_SHEETS_TEST_SPREADSHEET_ID;
  if (testSpreadsheetId && map.spreadsheet_id !== testSpreadsheetId) {
    throw new Error("Šī nav atļautā Google Sheets testa kopija.");
  }

  const admin = createAdminClient();
  const values = await readGoogleSheetColumnValues(map);
  const entries = parseGoogleSheetColumnValues(map, values);
  const lastQueueRow = Math.max(
    map.queue_end_row,
    map.queue_start_row,
    ...entries.filter((entry) => entry.status === "queue").map((entry) => entry.row)
  );
  if (entries.length === 0) return { imported: 0, unidentified: 0, lastQueueRow, sheetNamesByUser: new Map<string, string>() };

  const normalizedNames = [...new Set(entries.map((entry) => normalizeGoogleSheetAlias(entry.displayName)))];
  const { data: aliases, error: aliasesError } = await admin
    .from("google_sheet_player_aliases")
    .select("normalized_alias, user_id")
    .in("normalized_alias", normalizedNames);
  if (aliasesError) throw new Error(aliasesError.message);
  const userByAlias = new Map((aliases ?? []).map((alias) => [alias.normalized_alias, alias.user_id]));
  const { data: guests, error: guestsError } = await admin
    .from("users")
    .select("id, google_sheet_normalized_name")
    .eq("identity_status", "unidentified")
    .eq("google_sheet_spreadsheet_id", map.spreadsheet_id)
    .in("google_sheet_normalized_name", normalizedNames);
  if (guestsError) throw new Error(guestsError.message);
  const guestByName = new Map((guests ?? []).map((guest) => [guest.google_sheet_normalized_name, guest.id]));

  // Ja administrators vēlāk sasaistījis viesa vārdu ar īstu profilu,
  // vispirms atomāri pārvietojam agrāk importētos pieteikumus.
  for (const [normalizedName, userId] of userByAlias) {
    if (!guestByName.has(normalizedName)) continue;
    const { error } = await admin.rpc("link_google_sheet_guest_to_user", {
      p_spreadsheet_id: map.spreadsheet_id,
      p_normalized_name: normalizedName,
      p_user_id: userId,
    });
    if (error) throw new Error(`Viesa sasaistes kļūda (${normalizedName}): ${error.message}`);
  }

  const seenUsers = new Set<string>();
  const resolved = entries.map((entry) => ({
    ...entry,
    normalizedName: normalizeGoogleSheetAlias(entry.displayName),
    userId: userByAlias.get(normalizeGoogleSheetAlias(entry.displayName))
      ?? guestByName.get(normalizeGoogleSheetAlias(entry.displayName))
      ?? null,
    isGuest: !userByAlias.has(normalizeGoogleSheetAlias(entry.displayName)),
  }));
  for (const entry of resolved) {
    const key = entry.userId ?? `guest:${entry.normalizedName}`;
    if (seenUsers.has(key)) {
      throw new Error(`Viens spēlētājs kolonnā ir ierakstīts vairāk nekā vienreiz (piemēram, ${entry.cell}).`);
    }
    seenUsers.add(key);
  }
  const sheetNamesByUser = new Map(
    resolved.filter((entry) => entry.userId).map((entry) => [entry.userId!, entry.displayName])
  );

  const { data: registrations, error: registrationsError } = await admin
    .from("registrations")
    .select("user_id, status")
    .eq("training_id", map.training_id);
  if (registrationsError) throw new Error(registrationsError.message);
  const statusByUser = new Map((registrations ?? []).map((row) => [row.user_id, row.status]));
  // Jau atcelta pieteikuma vecu Sheet kopiju neuzskatām par jaunu pieteikumu.
  // Jauna pieteikšanās pēc atcelšanas jāveic ar Apps Script vai 3SM lapā.
  const toAdd = resolved.filter((entry) => !entry.userId || !statusByUser.has(entry.userId));
  if (toAdd.length === 0) return { imported: 0, unidentified: 0, lastQueueRow, sheetNamesByUser };

  const { data: training, error: trainingError } = await admin
    .from("trainings")
    .select("status, registration_closes_at")
    .eq("id", map.training_id)
    .single();
  if (trainingError) throw new Error(trainingError.message);
  if (training.status !== "open" || new Date(training.registration_closes_at).getTime() <= Date.now()) {
    throw new Error("Sheets kolonnā ir jauni spēlētāji, bet treniņa reģistrācija ir slēgta.");
  }

  // Apmaksa nav priekšnoteikums: neapmaksāti spēlētāji tiek importēti, un
  // sastāva fiksēšanas cron viņiem uzliek parādu.

  let imported = 0;
  let unidentified = 0;
  for (const entry of toAdd) {
    const { data, error } = entry.isGuest
      ? await admin.rpc("process_google_sheet_guest_command", {
          p_event_id: randomUUID(),
          p_map_id: map.id,
          p_column_index: map.column_index,
          p_cell_a1: entry.cell,
          p_action: "join",
          p_requested_name: entry.displayName,
          p_normalized_name: entry.normalizedName,
        })
      : await admin.rpc("process_google_sheet_reservation_command", {
          p_event_id: randomUUID(),
          p_map_id: map.id,
          p_user_id: entry.userId,
          p_training_id: map.training_id,
          p_spreadsheet_id: map.spreadsheet_id,
          p_sheet_gid: map.sheet_gid,
          p_cell_a1: entry.cell,
          p_action: "join",
          p_requested_name: entry.displayName,
        });
    if (error) throw new Error(error.message);
    const result = data as { state?: string; message?: string; user_id?: string } | null;
    if (result?.state === "accepted") {
      imported += 1;
      if (entry.isGuest) unidentified += 1;
    }
    else if (result?.state !== "duplicate") {
      throw new Error(`${entry.cell}: ${result?.message ?? "Pieteikumu neizdevās importēt."}`);
    }
    const userId = entry.userId ?? result?.user_id;
    if (userId) sheetNamesByUser.set(userId, entry.displayName);
  }
  return { imported, unidentified, lastQueueRow, sheetNamesByUser };
}

export async function deliverGoogleSheetsTrainingSync(limit = 20) {
  const admin = createAdminClient();
  const configurationError = getGoogleSheetsConfigurationError();
  const now = new Date();
  const staleLockAt = new Date(now.getTime() - STALE_LOCK_MS).toISOString();

  await admin
    .from("google_sheets_sync_outbox")
    .update({
      status: "failed",
      locked_at: null,
      last_error: "Sinhronizācija tika pārtraukta pirms rezultāta saglabāšanas.",
      next_attempt_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("status", "processing")
    .lt("locked_at", staleLockAt);

  const { data: mapData, error: mapsError } = await admin
    .from("google_sheet_training_maps")
    .select("id, training_id, spreadsheet_id, sheet_gid, sheet_name, column_index, count_row, roster_start_row, roster_end_row, queue_start_row, queue_end_row, enabled")
    .eq("enabled", true);
  if (mapsError) throw new Error(mapsError.message);
  const maps = (mapData ?? []) as MapRow[];
  const mapByTraining = new Map(maps.map((map) => [map.training_id, map]));
  const scanned = new Map<string, { lastQueueRow: number; sheetNamesByUser: Map<string, string>; error?: string }>();
  const scanErrors: { trainingId: string; error: string }[] = [];
  let imported = 0;
  let unidentified = 0;
  if (!configurationError) {
    for (const map of maps) {
      try {
        const result = await importNewPlayersFromColumn(map);
        imported += result.imported;
        unidentified += result.unidentified;
        scanned.set(map.training_id, { lastQueueRow: result.lastQueueRow, sheetNamesByUser: result.sheetNamesByUser });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        scanned.set(map.training_id, { lastQueueRow: map.queue_start_row, sheetNamesByUser: new Map(), error: message });
        scanErrors.push({ trainingId: map.training_id, error: message });
      }
    }
  }

  const { data } = await admin
    .from("google_sheets_sync_outbox")
    .select("id, training_id, attempts")
    .in("status", ["pending", "failed"])
    .lte("next_attempt_at", now.toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);

  const events = ((data ?? []) as unknown) as OutboxEvent[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let held = 0;

  for (const event of events) {
    const map = mapByTraining.get(event.training_id);
    if (map && scanned.get(event.training_id)?.error) {
      held += 1;
      continue;
    }
    if (configurationError) {
      held += 1;
      continue;
    }
    const lockedAt = new Date().toISOString();
    const { data: claimed } = await admin
      .from("google_sheets_sync_outbox")
      .update({
        status: "processing",
        attempts: event.attempts + 1,
        locked_at: lockedAt,
        updated_at: lockedAt,
      })
      .eq("id", event.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    if (!map) {
      skipped += 1;
      await mark(event.id, {
        status: "skipped",
        locked_at: null,
        last_error: "Treniņam nav aktīva Google Sheets kartējuma.",
      });
      continue;
    }

    try {
      const snapshot = await getSnapshot(event.training_id, scanned.get(event.training_id)?.sheetNamesByUser ?? new Map());
      await writeGoogleSheetValues(
        map.spreadsheet_id,
        buildTrainingSheetValues(map, snapshot, scanned.get(event.training_id)?.lastQueueRow ?? 40)
      );
      sent += 1;
      await mark(event.id, {
        status: "sent",
        locked_at: null,
        last_error: null,
        synced_at: new Date().toISOString(),
      });
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await mark(event.id, {
        status: "failed",
        locked_at: null,
        last_error: message.slice(0, 500),
        next_attempt_at: nextAttemptAt(event.attempts + 1),
      });
    }
  }

  return { imported, unidentified, sent, failed, skipped, held, scanErrors, configurationError };
}
