// Small build introspections used by both the attention strip and the build
// page: what went wrong, and where.
(function (PK) {
  'use strict';
  const M = (PK.model = PK.model || {});

  function firstError(b) {
    for (const s of b.steps) for (const l of s.log) if (/FAIL|ERROR|Error /.test(l)) return l.trim();
    return '';
  }
  function firstFailStep(b) { return b.steps.findIndex(s => s.status === 'failed'); }

  Object.assign(M, { firstError, firstFailStep });
})(window.PK = window.PK || {});
