
/* Shared helper functions for RedRight portals */

/* Escape HTML special characters for safe injection into the DOM */
window.escapeHtml = function (str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\'/g, '&#039;');
};

/* Escape attribute values (alias of escapeHtml) */
window.escapeAttr = window.escapeHtml;
