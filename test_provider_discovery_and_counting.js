import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { evaluatePlacementEligibility } from './backend/utils/providerPlacementEligibility.js';
import Setting from './backend/models/Setting.js';
import User from './backend/models/User.js';
import { authorize } from './backend/middleware/authMiddleware.js';
import {
    getSettings,
    getPublicSettings,
    updateSettings,
    normalizeWorkAndEarnPageExperience
} from './backend/controllers/settingsController.js';
import ProviderPlacement from './backend/models/ProviderPlacement.js';
import { validateAndNormalizeIconOverride } from './backend/controllers/providerPlacementController.js';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();

function loadTsModule(relPath) {
    const absPath = path.join(ROOT, relPath);
    const source = fs.readFileSync(absPath, 'utf8');
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true
        },
        fileName: absPath
    }).outputText;

    const mod = { exports: {} };
    const wrapped = `(function(exports, require, module, __filename, __dirname) { ${transpiled}\n})`;
    const fn = vm.runInThisContext(wrapped, { filename: absPath });
    fn(mod.exports, require, mod, absPath, path.dirname(absPath));
    return mod.exports;
}

function createMockRes() {
    const res = {
        statusCode: 200,
        body: null,
        headers: {},
        setHeader(k, v) {
            this.headers[k] = v;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
    return res;
}

async function runTests() {
    let passed = 0;
    const test = async (name, fn) => {
        try {
            await fn();
            passed += 1;
            console.log(`PASS: ${name}`);
        } catch (err) {
            console.error(`FAIL: ${name}`);
            throw err;
        }
    };

    const countHelper = loadTsModule('utils/providerCountHelper.ts');
    const pageExperienceHelper = loadTsModule('utils/pageExperienceHelper.ts');

    await test('1. getVerifiedProviderOfferCount rejects historical postbacks, clicks, conversions, and unverified numbers', () => {
        const historicalOnly = countHelper.getVerifiedProviderOfferCount({
            providerKey: 'cpx_research',
            totalPostbackCount: 420,
            totalReversalCount: 12,
            clicks: 99,
            conversions: 31,
            exchangeRateMultiplier: 1.0,
            verifiedOfferCount: 25
        });
        assert.equal(historicalOnly.count, null);
        assert.equal(historicalOnly.isVerifiedNumeric, false);
        assert.equal(historicalOnly.label, 'Available');

        const verified = countHelper.getVerifiedProviderOfferCount({
            providerKey: 'cpx_research',
            offerCountSource: 'verified_api',
            verifiedOfferCount: 14.9,
            totalPostbackCount: 420
        });
        assert.equal(verified.count, 14);
        assert.equal(verified.isVerifiedNumeric, true);
        assert.equal(verified.label, '14');
    });

    await test('2. computeSelectAllSummary never fabricates or blindly sums unverified provider counts', () => {
        const unverifiedSummary = countHelper.computeSelectAllSummary([
            { providerKey: 'cpx_research', totalPostbackCount: 50 },
            { providerKey: 'theoremreach', offerCountSource: 'verified_api', verifiedOfferCount: 6 }
        ], 3);
        assert.equal(unverifiedSummary.providerCount, 2);
        assert.equal(unverifiedSummary.nativeItemsCount, 3);
        assert.equal(unverifiedSummary.verifiedProvidersCount, 1);
        assert.equal(unverifiedSummary.hasDeduplicatedTotal, false);
        assert.equal(unverifiedSummary.combinedVerifiedOfferCount, null);

        const dedupedSummary = countHelper.computeSelectAllSummary([
            {
                providerKey: 'cpx_research',
                offerCountSource: 'verified_api',
                verifiedOfferCount: 3,
                verifiedOfferIds: ['o1', 'o2', 'o1']
            },
            {
                providerKey: 'theoremreach',
                offerCountSource: 'verified_api',
                verifiedOfferCount: 1,
                verifiedOfferIds: ['o1']
            }
        ], 2);
        assert.equal(dedupedSummary.hasDeduplicatedTotal, true);
        assert.equal(dedupedSummary.combinedVerifiedOfferCount, 2 + 3);
    });

    await test('3. formatPartnerCountLabel clearly separates partner count from available offer count', () => {
        assert.equal(countHelper.formatPartnerCountLabel(0, 0), '0 Partners Available');
        assert.equal(countHelper.formatPartnerCountLabel(1, 0), '1 Partner Available');
        assert.equal(countHelper.formatPartnerCountLabel(3, 0), '3 Partners Available');
        assert.equal(countHelper.formatPartnerCountLabel(2, 5), '5 Offers · 2 Partners');
        assert.equal(countHelper.formatPartnerCountLabel(0, 4), '4 Offers Available');
    });

    await test('4. Eligibility helper strictly hides ineligible country/user/rollout placements', () => {
        const userUS = { _id: '507f1f77bcf86cd799439011', country: 'US' };
        const userPK = { _id: '507f1f77bcf86cd799439012', country: 'PK' };
        const userNoCountry = { _id: '507f1f77bcf86cd799439011', country: '' };
        const restrictedPlacement = {
            _id: '607f1f77bcf86cd799439099',
            placementEnabled: true,
            availableTasksVisibility: true,
            targetingMode: 'selected_users',
            selectedUserIds: ['507f1f77bcf86cd799439011'],
            allowedCountries: ['US'],
            excludedCountries: [],
            rolloutPercentage: 100
        };
        assert.equal(evaluatePlacementEligibility(userUS, restrictedPlacement).eligible, true);
        assert.equal(evaluatePlacementEligibility(userPK, restrictedPlacement).eligible, false);
        assert.equal(evaluatePlacementEligibility(userNoCountry, restrictedPlacement).eligible, false);

        const zeroRollout = {
            ...restrictedPlacement,
            targetingMode: 'all',
            allowedCountries: [],
            rolloutPercentage: 0
        };
        assert.equal(evaluatePlacementEligibility(userUS, zeroRollout).eligible, false);
    });

    await test('5. resolvePageExperience defaults missing/corrupt configs to new (+ otherTasksNavStyle tabs), respects explicit legacy/new/icons, and ignores localStorage', () => {
        assert.deepEqual(pageExperienceHelper.resolvePageExperience(null), {
            dashboardAvailableTasks: 'new',
            otherTasks: 'new',
            offerwall: 'new',
            otherTasksNavStyle: 'tabs'
        });
        assert.deepEqual(pageExperienceHelper.resolvePageExperience(undefined), {
            dashboardAvailableTasks: 'new',
            otherTasks: 'new',
            offerwall: 'new',
            otherTasksNavStyle: 'tabs'
        });
        assert.deepEqual(pageExperienceHelper.resolvePageExperience({
            workAndEarnPageExperience: {
                dashboardAvailableTasks: 'invalid',
                otherTasks: 'legacy',
                offerwall: 123,
                otherTasksNavStyle: 'icons'
            }
        }), {
            dashboardAvailableTasks: 'new',
            otherTasks: 'legacy',
            offerwall: 'new',
            otherTasksNavStyle: 'icons'
        });
        assert.deepEqual(pageExperienceHelper.resolvePageExperience({
            workAndEarnPageExperience: {
                dashboardAvailableTasks: 'legacy',
                otherTasks: 'legacy',
                offerwall: 'legacy'
            }
        }), {
            dashboardAvailableTasks: 'legacy',
            otherTasks: 'legacy',
            offerwall: 'legacy',
            otherTasksNavStyle: 'tabs'
        });

        // Simulate stale localStorage override attempting to force 'legacy' when server is uninitialized
        const prevLocalStorage = globalThis.localStorage;
        globalThis.localStorage = {
            getItem: () => JSON.stringify({
                dashboardAvailableTasks: 'legacy',
                otherTasks: 'legacy',
                offerwall: 'legacy',
                otherTasksNavStyle: 'icons'
            }),
            setItem: () => {},
            removeItem: () => {}
        };
        try {
            assert.deepEqual(pageExperienceHelper.resolvePageExperience({}), {
                dashboardAvailableTasks: 'new',
                otherTasks: 'new',
                offerwall: 'new',
                otherTasksNavStyle: 'tabs'
            });
            assert.deepEqual(pageExperienceHelper.resolvePageExperience({
                workAndEarnPageExperience: {
                    dashboardAvailableTasks: 'legacy',
                    otherTasks: 'new',
                    offerwall: 'legacy',
                    otherTasksNavStyle: 'icons'
                }
            }), {
                dashboardAvailableTasks: 'legacy',
                otherTasks: 'new',
                offerwall: 'legacy',
                otherTasksNavStyle: 'icons'
            });
        } finally {
            globalThis.localStorage = prevLocalStorage;
        }
    });

    await test('6. Setting model schema defines workAndEarnPageExperience enums and otherTasksNavStyle defaulting to tabs', () => {
        const dashPath = Setting.schema.path('workAndEarnPageExperience.dashboardAvailableTasks');
        const otherPath = Setting.schema.path('workAndEarnPageExperience.otherTasks');
        const hubPath = Setting.schema.path('workAndEarnPageExperience.offerwall');
        const navStylePath = Setting.schema.path('workAndEarnPageExperience.otherTasksNavStyle');

        assert.ok(dashPath && otherPath && hubPath && navStylePath, 'Schema paths must exist on Setting model');
        assert.deepEqual(dashPath.enumValues, ['legacy', 'new']);
        assert.deepEqual(otherPath.enumValues, ['legacy', 'new']);
        assert.deepEqual(hubPath.enumValues, ['legacy', 'new']);
        assert.deepEqual(navStylePath.enumValues, ['tabs', 'icons', 'cards']);
        assert.equal(dashPath.defaultValue, 'new');
        assert.equal(otherPath.defaultValue, 'new');
        assert.equal(hubPath.defaultValue, 'new');
        assert.equal(navStylePath.defaultValue, 'tabs');
    });

    await test('7. Backend settingsController defaults missing configs to new, preserves explicit legacy, supports partial updates, and persists across logout/login', async () => {
        const origGetSettings = Setting.getSettings;
        const origFindOne = Setting.findOne;
        const origFindOneAndUpdate = Setting.findOneAndUpdate;
        const origUserFindById = User.findById;

        const storedDoc = {
            _id: 'settings_1',
            siteName: 'SmartExn',
            adminCampaignBudget: { enabled: false, allocatedBudgetUSD: 0, remainingBudgetUSD: 0 },
            workAndEarnPageExperience: {
                dashboardAvailableTasks: 'legacy',
                otherTasks: 'legacy',
                offerwall: 'legacy'
            },
            toObject() {
                return { ...this };
            }
        };

        Setting.getSettings = async () => storedDoc;
        Setting.findOne = async () => storedDoc;
        Setting.findOneAndUpdate = async (_query, update) => {
            if (update.$set?.workAndEarnPageExperience) {
                storedDoc.workAndEarnPageExperience = update.$set.workAndEarnPageExperience;
            }
            return storedDoc;
        };
        User.findById = async (id) => ({ _id: id, role: 'admin', status: 'Active' });

        const mockApp = { get: () => null };

        try {
            // Existing explicit Legacy config in DB is NEVER overwritten when read
            const initialRead = createMockRes();
            await getSettings({ query: {} }, initialRead);
            assert.equal(initialRead.statusCode, 200);
            assert.deepEqual(initialRead.body.data.workAndEarnPageExperience, {
                dashboardAvailableTasks: 'legacy',
                otherTasks: 'legacy',
                offerwall: 'legacy',
                otherTasksNavStyle: 'tabs'
            });

            // Invalid mode string must return HTTP 400
            const badReq = {
                app: mockApp,
                user: { _id: 'admin1', role: 'admin' },
                body: { workAndEarnPageExperience: { otherTasks: 'modern_v2' } }
            };
            const badRes = createMockRes();
            await updateSettings(badReq, badRes);
            assert.equal(badRes.statusCode, 400);
            assert.equal(badRes.body.success, false);

            // Invalid otherTasksNavStyle must return HTTP 400
            const badNavReq = {
                app: mockApp,
                user: { _id: 'admin1', role: 'admin' },
                body: { workAndEarnPageExperience: { otherTasksNavStyle: 'carousel_xyz' } }
            };
            const badNavRes = createMockRes();
            await updateSettings(badNavReq, badNavRes);
            assert.equal(badNavRes.statusCode, 400);
            assert.equal(badNavRes.body.success, false);

            // Non-object payload must return HTTP 400
            const arrReq = {
                app: mockApp,
                user: { _id: 'admin1', role: 'admin' },
                body: { workAndEarnPageExperience: ['new'] }
            };
            const arrRes = createMockRes();
            await updateSettings(arrReq, arrRes);
            assert.equal(arrRes.statusCode, 400);

            // Valid partial update merges safely against explicit Legacy without clobbering siblings
            const goodReq = {
                app: mockApp,
                user: { _id: 'admin1', role: 'admin' },
                body: { workAndEarnPageExperience: { otherTasks: 'new', otherTasksNavStyle: 'icons' } }
            };
            const goodRes = createMockRes();
            await updateSettings(goodReq, goodRes);
            assert.equal(goodRes.statusCode, 200);
            assert.deepEqual(goodRes.body.data.workAndEarnPageExperience, {
                dashboardAvailableTasks: 'legacy',
                otherTasks: 'new',
                offerwall: 'legacy',
                otherTasksNavStyle: 'icons'
            });

            // Simulate user logout (public fetch without auth user) -> saved selection persists
            const logoutPubRes = createMockRes();
            await getPublicSettings({ query: {} }, logoutPubRes);
            assert.equal(logoutPubRes.statusCode, 200);
            assert.equal(logoutPubRes.body.success, true);
            assert.deepEqual(logoutPubRes.body.data.workAndEarnPageExperience, {
                dashboardAvailableTasks: 'legacy',
                otherTasks: 'new',
                offerwall: 'legacy',
                otherTasksNavStyle: 'icons'
            });

            // Simulate user re-login (authenticated settings fetch) -> saved selection persists
            const reloginRes = createMockRes();
            await getSettings({ query: {}, user: { id: 'admin1', role: 'admin' } }, reloginRes);
            assert.equal(reloginRes.statusCode, 200);
            assert.equal(reloginRes.body.success, true);
            assert.deepEqual(reloginRes.body.data.workAndEarnPageExperience, {
                dashboardAvailableTasks: 'legacy',
                otherTasks: 'new',
                offerwall: 'legacy',
                otherTasksNavStyle: 'icons'
            });

            // Missing/uninitialized config normalizes to all 'new' + otherTasksNavStyle 'tabs'
            assert.deepEqual(normalizeWorkAndEarnPageExperience(null), {
                dashboardAvailableTasks: 'new',
                otherTasks: 'new',
                offerwall: 'new',
                otherTasksNavStyle: 'tabs'
            });
        } finally {
            Setting.getSettings = origGetSettings;
            Setting.findOne = origFindOne;
            Setting.findOneAndUpdate = origFindOneAndUpdate;
            User.findById = origUserFindById;
        }
    });

    await test('8. PUT /api/v1/settings route restricts updates strictly to admin and super_admin', async () => {
        const routeSrc = fs.readFileSync(path.join(ROOT, 'backend/routes/settingRoutes.js'), 'utf8');
        assert.ok(routeSrc.includes("authorize(['super_admin', 'admin'])"), 'PUT /settings must authorize admin & super_admin');

        const origFindById = User.findById;
        const rolesById = {
            u_user: { _id: 'u_user', role: 'user', status: 'Active' },
            u_admin: { _id: 'u_admin', role: 'admin', status: 'Active' },
            u_super: { _id: 'u_super', role: 'super_admin', status: 'Active' }
        };
        User.findById = (id) => ({
            select: () => ({
                lean: async () => rolesById[id] || null
            })
        });

        try {
            const mw = authorize(['super_admin', 'admin']);
            let nextCalled = false;
            const userRes = createMockRes();
            await mw({ user: { id: 'u_user', role: 'user' } }, userRes, () => { nextCalled = true; });
            assert.equal(nextCalled, false);
            assert.equal(userRes.statusCode, 403);

            const adminRes = createMockRes();
            await mw({ user: { id: 'u_admin', role: 'admin' } }, adminRes, () => { nextCalled = true; });
            assert.equal(nextCalled, true);

            nextCalled = false;
            await mw({ user: { id: 'u_super', role: 'super_admin' } }, createMockRes(), () => { nextCalled = true; });
            assert.equal(nextCalled, true);
        } finally {
            User.findById = origFindById;
        }
    });

    await test('9. Admin UI settings component persists via backend updateSettings without localStorage and is mounted in Admin pages', () => {
        const uiSrc = fs.readFileSync(path.join(ROOT, 'components/WorkAndEarnPageExperienceSettings.tsx'), 'utf8');
        const adminEditorSrc = fs.readFileSync(path.join(ROOT, 'pages/admin/AdminWorkAndEarnEditor.tsx'), 'utf8');
        const managerSrc = fs.readFileSync(path.join(ROOT, 'components/AdminModulePagesManager.tsx'), 'utf8');
        const helperSrc = fs.readFileSync(path.join(ROOT, 'utils/pageExperienceHelper.ts'), 'utf8');

        assert.ok(uiSrc.includes('Work & Earn') && uiSrc.includes('Page Experience Settings'));
        assert.ok(uiSrc.includes('Dashboard') && uiSrc.includes('Available Tasks') && uiSrc.includes('Other Tasks') && uiSrc.includes('Offerwall'));
        assert.ok(uiSrc.includes('await updateSettings(') && uiSrc.includes('workAndEarnPageExperience:'));
        const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        assert.ok(!/localStorage|sessionStorage/.test(stripComments(uiSrc)));
        assert.ok(!/localStorage|sessionStorage/.test(stripComments(helperSrc)));
        assert.ok(adminEditorSrc.includes('<WorkAndEarnPageExperienceSettings'));
        assert.ok(!managerSrc.includes('<WorkAndEarnPageExperienceSettings'));
    });

    await test('10. Dashboard Available Tasks keeps internal tasks always visible and gates external ProviderNavRow on pageExperience', () => {
        const dashSrc = fs.readFileSync(path.join(ROOT, 'pages/user/UserWorkAndEarnDashboard.tsx'), 'utf8');

        assert.ok(dashSrc.includes('resolvePageExperience(state.settings)'));
        assert.ok(dashSrc.includes("availableTasksExperience === 'new'"));
        assert.ok(dashSrc.includes("fetchAndCacheAvailablePlacements(targetUserId, 'available_jobs')"));
        assert.ok(dashSrc.includes("label: 'SmartExn Tasks'"));
        assert.ok(dashSrc.includes('<ProviderNavRow'));
        assert.ok(dashSrc.includes('jobPlacementReqSeqRef') && dashSrc.includes('activeJobPlacementUserRef'));
        assert.ok(dashSrc.includes('id="smartexn-internal-tasks-section"'));
        assert.ok(dashSrc.includes('data-page-experience={availableTasksExperience}'));
        assert.ok(dashSrc.includes('<Modal') && dashSrc.includes('activeJobLaunchSession'));
        assert.ok(dashSrc.indexOf('closeJobLaunchSession();') < dashSrc.indexOf('setActiveJobLaunchSession({'));
    });

    await test('11. Other Tasks toggles Legacy grid vs New SELECT ALL vertical providers and isolates single-provider tab', () => {
        const panelSrc = fs.readFileSync(path.join(ROOT, 'components/ProviderPlacementPanel.tsx'), 'utf8');
        const otherSrc = fs.readFileSync(path.join(ROOT, 'components/OtherTasksCard.tsx'), 'utf8');
        const navSrc = fs.readFileSync(path.join(ROOT, 'components/ProviderNavRow.tsx'), 'utf8');

        assert.ok(otherSrc.includes('formatPartnerCountLabel('));
        assert.ok(!otherSrc.includes('Offers Available</span>'));

        assert.ok(panelSrc.includes('resolvePageExperience(dataContext?.state?.settings).otherTasks'));
        assert.ok(panelSrc.includes('{isNewExperience && filteredPlacements.length > 0 && ('));
        assert.ok(panelSrc.includes("label: 'SELECT ALL'"));
        assert.ok(panelSrc.includes('<ProviderNavRow'));
        assert.ok(panelSrc.includes('handleLaunchPlacement(p, { forceInline: true })'));
        assert.ok(panelSrc.includes('data-testid="other-tasks-select-all-vertical"'));
        assert.ok(panelSrc.includes('data-testid="other-tasks-legacy-grid"'));
        assert.ok(panelSrc.includes('Open Main Offerwall'));
        assert.ok(panelSrc.includes('clearSelectAllSessions()'));
        assert.ok(panelSrc.indexOf('clearSelectAllSessions();') < panelSrc.indexOf('setActiveLaunchSession({'));
        assert.ok(panelSrc.indexOf('closeLaunchSession();') < panelSrc.indexOf('setActiveLaunchSession({'));
        assert.ok(navSrc.includes('overflow-x-auto') && navSrc.includes('role="tablist"') && navSrc.includes('role="tab"'));
    });

    await test('12. OfferwallHub supports Admin-controlled Legacy vs New layout without changing CPX, Torox, or offerwall_gg integrations', () => {
        const hubSrc = fs.readFileSync(path.join(ROOT, 'pages/user/OfferwallHub.tsx'), 'utf8');

        assert.ok(hubSrc.includes('resolvePageExperience(settings).offerwall'));
        assert.ok(hubSrc.includes('data-page-experience={offerwallExperience}'));
        assert.ok(hubSrc.includes("'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3'"));
        assert.ok(hubSrc.includes('overflow-x-auto') && hubSrc.includes('getVerifiedProviderOfferCount('));
        assert.ok(hubSrc.includes("providerKey === 'cpx_research'"));
        assert.ok(hubSrc.includes("providerKey === 'torox'"));
        assert.ok(hubSrc.includes("providerKey === 'theoremreach'"));
        assert.ok(hubSrc.includes("providerKey === 'offerwall_gg'"));
    });

    await test('13. OtherTasksCard removes duplicate top header card while keeping Search Bar and conditional subTabs unified', () => {
        const otherSrc = fs.readFileSync(path.join(ROOT, 'components/OtherTasksCard.tsx'), 'utf8');

        assert.ok(!otherSrc.includes('Select a category or provider to browse available opportunities.'), 'Duplicate top header card copy must be removed');
        assert.ok(!otherSrc.includes('Partner Networks & External Tasks'), 'Duplicate Partner Networks heading must be removed');
        assert.ok(otherSrc.includes('placeholder="Search tasks..."'), 'Search bar must remain present inside unified OtherTasksCard');
        assert.ok(otherSrc.includes('{subTabs.length > 0 && ('), 'Sub-tabs must only render when subTabs exist');
        assert.ok(otherSrc.includes('activeNetworkName} Offers & External Tasks'), 'Single unified header heading must remain');
    });

    await test('14. Other Tasks supports Admin-selected tabs, icons, and cards nav styles with SELECT ALL and safe picture/emoji icons', () => {
        const uiSrc = fs.readFileSync(path.join(ROOT, 'components/WorkAndEarnPageExperienceSettings.tsx'), 'utf8');
        const navSrc = fs.readFileSync(path.join(ROOT, 'components/ProviderNavRow.tsx'), 'utf8');
        const panelSrc = fs.readFileSync(path.join(ROOT, 'components/ProviderPlacementPanel.tsx'), 'utf8');

        assert.ok(uiSrc.includes('otherTasksNavStyle'));
        assert.ok(
            uiSrc.includes('exp-otherTasksNavStyle-tabs') &&
            uiSrc.includes('exp-otherTasksNavStyle-icons') &&
            uiSrc.includes('exp-otherTasksNavStyle-cards')
        );
        assert.ok(navSrc.includes("variant: 'cards' | 'tabs' | 'icons'"));
        assert.ok(navSrc.includes("if (variant === 'icons')") && navSrc.includes('data-nav-variant="icons"'));
        assert.ok(navSrc.includes("if (variant === 'cards')") && navSrc.includes('data-nav-variant="cards"'));
        assert.ok(navSrc.includes('isSafeImageIcon('));
        assert.ok(panelSrc.includes("otherTasksNavStyle === 'cards' ? 'cards' : 'tabs'"));
        assert.equal(pageExperienceHelper.normalizeOtherTasksNavStyle('cards'), 'cards');
    });

    await test('15. ProviderPlacement iconOverride supports Auto/Emoji/HTTPS/Raster-Upload and strictly rejects XSS/SVG URIs', () => {
        const iconPath = ProviderPlacement.schema.path('iconOverride');
        assert.ok(iconPath, 'ProviderPlacement schema must define iconOverride');
        assert.equal(iconPath.defaultValue, '');

        // Auto / empty
        assert.deepEqual(validateAndNormalizeIconOverride(''), { valid: true, value: '' });
        assert.deepEqual(validateAndNormalizeIconOverride(null), { valid: true, value: '' });
        // Emoji
        assert.deepEqual(validateAndNormalizeIconOverride('🎯'), { valid: true, value: '🎯' });
        // Safe HTTPS image URL & raster PNG base64
        assert.equal(validateAndNormalizeIconOverride('https://cdn.example.com/icon.png').valid, true);
        assert.equal(validateAndNormalizeIconOverride('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==').valid, true);
        // XSS & SVG & javascript: rejections
        assert.equal(validateAndNormalizeIconOverride('javascript:alert(1)').valid, false);
        assert.equal(validateAndNormalizeIconOverride('data:image/svg+xml;base64,PHN2Zz4=').valid, false);
        assert.equal(validateAndNormalizeIconOverride('<script>alert(1)</script>').valid, false);

        // Frontend helper parity
        assert.equal(pageExperienceHelper.isSafeImageIcon('https://cdn.example.com/icon.png'), true);
        assert.equal(pageExperienceHelper.isSafeImageIcon('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='), true);
        assert.equal(pageExperienceHelper.isSafeImageIcon('data:image/svg+xml;base64,PHN2Zz4='), false);
        assert.equal(pageExperienceHelper.isSafeImageIcon('javascript:alert(1)'), false);

        // Admin UI manager controls
        const mgrSrc = fs.readFileSync(path.join(ROOT, 'pages/admin/ProviderPlacementManager.tsx'), 'utf8');
        assert.ok(mgrSrc.includes('iconOverride'));
        assert.ok(mgrSrc.includes('Auto (Default)'));
        assert.ok(mgrSrc.includes('accept="image/png,image/jpeg,image/webp,image/gif"'));
    });

    console.log(`\nALL ${passed} PROVIDER DISCOVERY, COUNTING & PAGE EXPERIENCE REGRESSION TESTS PASSED.`);
}

runTests().catch((err) => {
    console.error(err);
    process.exit(1);
});
