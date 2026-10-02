/** Critical permission policy shared by the dialog and the 100% branch Gate. */
export function isDangerConfirmationValid(phrase: string, expectedPhrase: string, mfaRequired: boolean, mfaCode: string): boolean {
  return phrase === expectedPhrase && (!mfaRequired || /^\d{6}$/.test(mfaCode));
}
