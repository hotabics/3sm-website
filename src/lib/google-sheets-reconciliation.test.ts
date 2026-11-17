import assert from "node:assert/strict";
import test from "node:test";
import {
  findSiteOnlySheetRegistrations,
  sheetStatusMismatch,
  type RegistrationForSheetComparison,
} from "./google-sheets-reconciliation";

const registrations: RegistrationForSheetComparison[] = [
  { user_id: "hugo", status: "confirmed", user: { name: "Hugo", nickname: null, identity_status: "identified" } },
  { user_id: "guest", status: "queue", user: { name: "srūtrA", nickname: null, identity_status: "unidentified" } },
  { user_id: "old", status: "cancelled", user: { name: "Atcelts", nickname: null, identity_status: "identified" } },
];

test("priekšskatījums atrod 3SM dalībnieku, kura vairs nav Sheets kolonnā", () => {
  assert.deepEqual(findSiteOnlySheetRegistrations(registrations, ["hugo"]), [
    { userId: "guest", displayName: "srūtrA", status: "queue", identityStatus: "unidentified" },
  ]);
});

test("tukša Sheets kolonna neuzskata jau atceltu pieteikumu par neatbilstību", () => {
  assert.deepEqual(findSiteOnlySheetRegistrations(registrations, []), [
    { userId: "hugo", displayName: "Hugo", status: "confirmed", identityStatus: "identified" },
    { userId: "guest", displayName: "srūtrA", status: "queue", identityStatus: "unidentified" },
  ]);
});

test("pamatsastāva un rezerves atšķirību rāda tikai aktīvam pieteikumam", () => {
  assert.equal(sheetStatusMismatch("queue", "confirmed"), "queue");
  assert.equal(sheetStatusMismatch("confirmed", "confirmed"), null);
  assert.equal(sheetStatusMismatch("cancelled", "confirmed"), null);
  assert.equal(sheetStatusMismatch(undefined, "confirmed"), null);
});
