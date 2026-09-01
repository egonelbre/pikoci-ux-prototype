// Teams and users — who exists and what they can do.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day } = D;

  // ---------- teams / users / workers / audit ------------------------------
  const TEAMS = [
    { name: 'main', desc: 'PikoCI core', members: [{ user: 'egon', role: 'admin' }, { user: 'maria', role: 'maintain' }, { user: 'sam', role: 'write' }, { user: 'riho', role: 'read' }] },
    { name: 'platform', desc: 'Infrastructure', members: [{ user: 'egon', role: 'admin' }, { user: 'maria', role: 'admin' }] },
    { name: 'oss', desc: 'Public demos', members: [{ user: 'egon', role: 'admin' }] },
    { name: 'payments', desc: 'Payments & billing services', members: [{ user: 'anna', role: 'admin' }, { user: 'kris', role: 'write' }, { user: 'egon', role: 'read' }] },
    { name: 'web', desc: 'Storefront & admin', members: [{ user: 'liis', role: 'admin' }, { user: 'marko', role: 'write' }] },
    { name: 'data', desc: 'Data platform', members: [{ user: 'jt', role: 'admin' }, { user: 'tanel', role: 'write' }] },
    { name: 'mobile', desc: 'iOS & Android apps', members: [{ user: 'kris', role: 'admin' }, { user: 'liis', role: 'write' }] },
    { name: 'qa', desc: 'Quality engineering', members: [{ user: 'riho', role: 'admin' }, { user: 'sam', role: 'write' }] },
  ];
  const USERS = [
    { username: 'egon', name: 'Egon', gitAuthors: ['egon'], role: 'admin' },
    { username: 'maria', name: 'Maria K', gitAuthors: ['maria'], role: 'maintain' },
    { username: 'sam', name: 'Sam T', gitAuthors: ['sam'], role: 'write' },
    { username: 'riho', name: 'Riho V', gitAuthors: [], role: 'read' },
  ];

  D.TEAMS = TEAMS;
  D.USERS = USERS;
})();
