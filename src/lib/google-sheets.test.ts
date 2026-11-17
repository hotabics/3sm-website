import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTrainingSheetValues,
  chooseGoogleSheetExportName,
  columnIndexFromA1,
  normalizeGoogleSheetAlias,
  parseGoogleSheetAliases,
  parseGoogleSheetColumnValues,
} from "./google-sheets";

test("atpazīst Google Sheets šūnas kolonnu un rindu", () => {
  assert.deepEqual(columnIndexFromA1("B8"), { columnIndex: 2, row: 8 });
  assert.deepEqual(columnIndexFromA1("AA24"), { columnIndex: 27, row: 24 });
  assert.equal(columnIndexFromA1("8B"), null);
});

test("normalizē Sheets iesauku bez liekām atstarpēm", () => {
  assert.equal(normalizeGoogleSheetAlias("  Hugo   Ozols "), "hugo ozols");
  assert.equal(normalizeGoogleSheetAlias("Mu\u0304zis"), "mūzis");
});

test("pieņem vairākus skaidri sasaistītus viena spēlētāja vārda variantus", () => {
  assert.deepEqual(parseGoogleSheetAliases("Jānis Mūzis, Mūzis; Muzis\n Mūzis "), [
    { display_alias: "Jānis Mūzis", normalized_alias: "jānis mūzis" },
    { display_alias: "Mūzis", normalized_alias: "mūzis" },
    { display_alias: "Muzis", normalized_alias: "muzis" },
  ]);
});

test("eksportā saglabā Sheets pierakstu vai izmanto apstiprinātu aliasu", () => {
  const aliases = [
    { display_alias: "Muzis", normalized_alias: "muzis" },
    { display_alias: "Mūzis", normalized_alias: "mūzis" },
  ];
  assert.equal(chooseGoogleSheetExportName("Muzis", "Mūzis", aliases), "Muzis");
  assert.equal(chooseGoogleSheetExportName(undefined, "Mūzis", aliases), "Mūzis");
  assert.equal(chooseGoogleSheetExportName(undefined, "Jānis Mūzis", aliases), "Muzis");
  assert.equal(chooseGoogleSheetExportName(undefined, "Jauns spēlētājs", []), null);
});

test("izveido testa mēneša kolonnas momentuzņēmumu", () => {
  const values = buildTrainingSheetValues(
    {
      spreadsheet_id: "test-sheet",
      sheet_name: "Oktobris 26",
      column_index: 2,
      count_row: 7,
      roster_start_row: 8,
      roster_end_row: 9,
      queue_start_row: 12,
      queue_end_row: 13,
    },
    {
      confirmedNames: ["Hugo", "Mūzis", "Artis"],
      queueNames: ["Zach"],
    }
  );

  assert.deepEqual(values, [
    { range: "'Oktobris 26'!B7", values: [["2"]] },
    { range: "'Oktobris 26'!B8:B9", values: [["Hugo"], ["Mūzis"]] },
    { range: "'Oktobris 26'!B12:B13", values: [["Artis"], ["Zach"]] },
  ]);
});

test("nolasa visu datuma kolonnu: 22. rindu izlaiž, no 23. rindas ir rezerve", () => {
  const map = {
    spreadsheet_id: "test-sheet",
    sheet_name: "Oktobris 26",
    column_index: 3,
    count_row: 7,
    roster_start_row: 8,
    roster_end_row: 21,
    queue_start_row: 23,
    queue_end_row: 40,
  };
  const values = Array.from({ length: 19 }, () => "");
  values[0] = "Ivo";      // C8
  values[4] = "Hugo";     // C12
  values[14] = "Baltie";  // C22 — rezultāts, nevis spēlētājs
  values[15] = "Mūzis";   // C23 — rezerve
  values[18] = "Zach";    // C26 — rezerve

  assert.deepEqual(parseGoogleSheetColumnValues(map, values), [
    { row: 8, cell: "C8", displayName: "Ivo", status: "confirmed" },
    { row: 12, cell: "C12", displayName: "Hugo", status: "confirmed" },
    { row: 23, cell: "C23", displayName: "Mūzis", status: "queue" },
    { row: 26, cell: "C26", displayName: "Zach", status: "queue" },
  ]);
  assert.equal(buildTrainingSheetValues(map, {
    confirmedNames: ["Ivo", "Hugo"],
    queueNames: ["Mūzis", "Zach"],
  }, 26)[2].range, "'Oktobris 26'!C23:C40");

  const extendedValues = Array.from({ length: 43 }, () => "");
  extendedValues[42] = "Artūrs"; // C50 — arī rezerve
  assert.deepEqual(parseGoogleSheetColumnValues(map, extendedValues), [
    { row: 50, cell: "C50", displayName: "Artūrs", status: "queue" },
  ]);
  assert.equal(buildTrainingSheetValues(map, {
    confirmedNames: [],
    queueNames: ["Artūrs"],
  }, 50)[2].range, "'Oktobris 26'!C23:C50");
});
