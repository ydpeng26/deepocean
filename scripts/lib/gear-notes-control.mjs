// Serialized into the isolated fixture page. Compare the control value, not
// parent-label textContent, which can include a textarea's text-node content.
export function gearNotesMatch(expected) {
  const controls = document.querySelectorAll("fieldset textarea");
  return controls.length === 1 && controls[0].value === expected;
}
