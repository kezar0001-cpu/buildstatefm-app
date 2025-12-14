import test from 'node:test';
import assert from 'node:assert/strict';

import inspectionsRouter from '../src/routes/inspections.js';

function countRoute(router, method, path) {
  const targetMethod = method.toLowerCase();

  return router.stack.filter((layer) => {
    const route = layer.route;
    if (!route) return false;
    if (route.path !== path) return false;
    return Boolean(route.methods?.[targetMethod]);
  }).length;
}

test('inspections router should not register duplicate routes', () => {
  assert.equal(countRoute(inspectionsRouter, 'GET', '/calendar'), 1);
  assert.equal(countRoute(inspectionsRouter, 'GET', '/analytics'), 1);
  assert.equal(countRoute(inspectionsRouter, 'PATCH', '/:id/rooms/:roomId'), 1);
});
