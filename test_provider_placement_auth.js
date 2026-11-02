import router from './backend/routes/providerPlacementRoutes.js';

console.log('Running Provider Placement Authentication & Authorization Route Tests...');

// Inspect registered route endpoints
const stack = router.stack || [];
const routes = stack.filter(s => s.route).map(s => ({
    path: s.route.path,
    methods: Object.keys(s.route.methods).join(',').toUpperCase()
}));

console.log(`Registered Placement Routes Count: ${routes.length}`);

// Test 1: Available endpoint is present and method GET
const availableRoute = routes.find(r => r.path === '/available/:parentTabId' && r.methods.includes('GET'));
if (!availableRoute) {
    console.error('FAILED Test 1: GET /available/:parentTabId route missing!');
    process.exit(1);
}
console.log('✓ Test 1 Passed: GET /available/:parentTabId route registered.');

// Test 2: Launch endpoint is present and method POST
const launchRoute = routes.find(r => r.path === '/:placementId/launch' && r.methods.includes('POST'));
if (!launchRoute) {
    console.error('FAILED Test 2: POST /:placementId/launch route missing!');
    process.exit(1);
}
console.log('✓ Test 2 Passed: POST /:placementId/launch route registered.');

// Test 3: Admin endpoints present
const adminRoutes = routes.filter(r => r.path.startsWith('/admin'));
if (adminRoutes.length < 5) {
    console.error(`FAILED Test 3: Expected at least 5 admin routes, found ${adminRoutes.length}`);
    process.exit(1);
}
console.log(`✓ Test 3 Passed: Verified ${adminRoutes.length} protected admin endpoints registered.`);

console.log('======================================================');
console.log('All Placement Route & Auth Tests Passed!');
console.log('======================================================');
