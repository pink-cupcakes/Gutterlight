// Markup is assembled from trusted fragments; escape every dynamic text value.
// This tag also lets the formatter indent HTML inside template literals.
export function html(strings, ...values) {
  return strings.reduce(
    (result, part, index) => result + part + (index < values.length ? values[index] : ''),
    '',
  );
}
export const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
