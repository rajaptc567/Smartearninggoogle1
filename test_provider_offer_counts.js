import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import {
    clearOfferCountCache,
    fetchVerifiedOfferCountForProvider,
    isSafePublicHttpsUrl,
    summarizeTabOfferCounts
} from './backend/utils/providerOfferCountService.js';
import { getTabOfferCounts } from './backend/controllers/providerPlacementController.js';
import User from './backend/models/User.js';
import Setting from './backend/models/Setting.js';
import ProviderPlacement from './backend/models/ProviderPlacement.js';
import OfferwallProvider from './backend/models/OfferwallProvider.js';

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
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
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

    await test('1. computeTabOfferCountSummary combines verified API counts honestly and marks partial coverage with +', () => {
        const partial = countHelper.computeTabOfferCountSummary([
            {
                providerKey: 'cpx_research',
                offerCountSource: 'verified_api',
                verifiedOfferCount: 5,
                verifiedOfferIds: ['s1', 's2', 's3', 's4', 's5']
            },
            {
                providerKey: 'offerwall_gg',
                offerCountSource: 'verified_api',
                verifiedOfferCount: 42
            },
            {
                providerKey: 'theoremreach',
                offerCountSource: 'unsupported_no_api',
                verifiedOfferCount: null
            }
        ]);
        assert.equal(partial.verifiedTotal, 47);
        assert.equal(partial.verifiedProvidersCount, 2);
        assert.equal(partial.unverifiedProvidersCount, 1);
        assert.equal(partial.hasPartialCoverage, true);
        assert.equal(partial.displayBadge, '47+');

        const full = countHelper.computeTabOfferCountSummary([
            { providerKey: 'cpx_research', offerCountSource: 'verified_api', verifiedOfferCount: 6 },
            { providerKey: 'offerwall_gg', offerCountSource: 'verified_api', verifiedOfferCount: 14 }
        ]);
        assert.equal(full.displayBadge, '20');
        assert.equal(full.hasPartialCoverage, false);

        // Deduplicates repeated providerKey + ignores historical postbacks
        const deduped = countHelper.computeTabOfferCountSummary([
            { providerKey: 'cpx_research', offerCountSource: 'verified_api', verifiedOfferCount: 4 },
            { providerKey: 'cpx_research', offerCountSource: 'verified_api', verifiedOfferCount: 4 },
            { providerKey: 'theoremreach', totalPostbackCount: 999, verifiedOfferCount: 99 }
        ]);
        assert.equal(deduped.verifiedTotal, 4);
        assert.equal(deduped.displayBadge, '4+');

        assert.equal(countHelper.formatPartnerCountLabel(3, 0, '47+'), '47+ Offers · 3 Partners');
    });

    await test('2. isSafePublicHttpsUrl blocks HTTP, localhost, private IPv4/IPv6, and metadata endpoints', () => {
        assert.equal(isSafePublicHttpsUrl('https://live-api.cpx-research.com/api/get-surveys.php'), true);
        assert.equal(isSafePublicHttpsUrl('https://offerwall.gg/api/v1/offers'), true);
        assert.equal(isSafePublicHttpsUrl('http://offerwall.gg/api/v1/offers'), false);
        assert.equal(isSafePublicHttpsUrl('https://localhost/api'), false);
        assert.equal(isSafePublicHttpsUrl('https://127.0.0.1/api'), false);
        assert.equal(isSafePublicHttpsUrl('https://169.254.169.254/latest/meta-data'), false);
        assert.equal(isSafePublicHttpsUrl('https://10.0.0.5/api'), false);
        assert.equal(isSafePublicHttpsUrl('https://192.168.1.10/api'), false);
    });

    await test('3. fetchVerifiedOfferCountForProvider fetches CPX, Offerwall.GG, TheoremReach, and custom auto-added feeds with caching', async () => {
        clearOfferCountCache();
        const origFetch = globalThis.fetch;
        const calls = [];

        globalThis.fetch = async (url, init) => {
            calls.push({ url: String(url), headers: init?.headers || {} });
            const u = String(url);
            if (u.startsWith('https://live-api.cpx-research.com/api/get-surveys.php')) {
                return {
                    ok: true,
                    status: 200,
                    text: async () => JSON.stringify({
                        status: 'success',
                        count_available_surveys: 3,
                        surveys: [{ id: '101' }, { id: '102' }, { id: '103' }]
                    })
                };
            }
            if (u.startsWith('https://offerwall.gg/api/v1/offers')) {
                return {
                    ok: true,
                    status: 200,
                    text: async () => JSON.stringify({
                        success: true,
                        data: {
                            offers: [{ id: 1 }, { id: 2 }],
                            pagination: { total: 38, page: 1, pages: 1, perPage: 50 }
                        }
                    })
                };
            }
            if (u.startsWith('https://partner-new.example.com/offers.json')) {
                return {
                    ok: true,
                    status: 200,
                    text: async () => JSON.stringify({
                        offers: [{ id: 'a' }, { id: 'b' }]
                    })
                };
            }
            throw new Error(`Unexpected URL: ${u}`);
        };

        try {
            const cpxProvider = {
                providerKey: 'cpx_research',
                appId: '37470',
                secretKey: 'cpx_secret_123'
            };
            const cpx1 = await fetchVerifiedOfferCountForProvider({
                provider: cpxProvider,
                userId: 'user_abc',
                clientIp: '8.8.8.8',
                userAgent: 'Mozilla/5.0'
            });
            assert.equal(cpx1.offerCountSource, 'verified_api');
            assert.equal(cpx1.verifiedOfferCount, 3);
            assert.deepEqual(cpx1.verifiedOfferIds, ['101', '102', '103']);
            assert.equal(cpx1.cached, false);

            const expectedHash = crypto.createHash('md5').update('user_abc-cpx_secret_123').digest('hex');
            assert.ok(calls[0].url.includes(`secure_hash=${expectedHash}`));
            assert.ok(calls[0].url.includes('ip_user=8.8.8.8'));

            // Second call hits 3-min cache without calling fetch again
            const cpx2 = await fetchVerifiedOfferCountForProvider({
                provider: cpxProvider,
                userId: 'user_abc',
                clientIp: '8.8.8.8',
                userAgent: 'Mozilla/5.0'
            });
            assert.equal(cpx2.cached, true);
            assert.equal(calls.length, 1);

            const owgg = await fetchVerifiedOfferCountForProvider({
                provider: {
                    providerKey: 'offerwall_gg',
                    secretKey: 'owgg_secret_xyz',
                    iframeUrlTemplate: 'https://offerwall.gg/wall/44e2f34845f41e2de70f39b9c3b5a543?userId={userId}'
                },
                userId: 'user_abc',
                clientIp: '8.8.8.8'
            });
            assert.equal(owgg.offerCountSource, 'verified_api');
            assert.equal(owgg.verifiedOfferCount, 38);
            assert.ok(calls[1].url.includes('appId=44e2f34845f41e2de70f39b9c3b5a543'));
            assert.equal(calls[1].headers['X-Api-Key'], 'owgg_secret_xyz');

            const tr = await fetchVerifiedOfferCountForProvider({
                provider: { providerKey: 'theoremreach', apiKey: 'tr_key', secretKey: 'tr_sec' },
                userId: 'user_abc'
            });
            assert.equal(tr.offerCountSource, 'unsupported_no_api');
            assert.equal(tr.verifiedOfferCount, null);

            const custom = await fetchVerifiedOfferCountForProvider({
                provider: {
                    providerKey: 'custom_partner_new',
                    appId: 'app1',
                    customConfig: { offerCountApiUrl: 'https://partner-new.example.com/offers.json?uid={userId}' }
                },
                userId: 'user_abc'
            });
            assert.equal(custom.offerCountSource, 'verified_api');
            assert.equal(custom.verifiedOfferCount, 2);
        } finally {
            globalThis.fetch = origFetch;
            clearOfferCountCache();
        }
    });

    await test('4. getTabOfferCounts controller enforces eligibility, computes combined badge, and never leaks provider secrets', async () => {
        clearOfferCountCache();
        const origUserFindById = User.findById;
        const origGetSettings = Setting.getSettings;
        const origPlacementFind = ProviderPlacement.find;
        const origProviderFind = OfferwallProvider.find;
        const origFetch = globalThis.fetch;

        User.findById = async () => ({
            _id: '507f1f77bcf86cd799439011',
            status: 'Active',
            country: 'US',
            restrictions: {}
        });
        Setting.getSettings = async () => ({
            customEarnTabs: [{ id: 'other_tasks', title: 'Other Tasks', enabled: true, subTabs: [] }],
            modulePagesConfig: { workAndEarn: { otherTasks: { isEnabled: true, isHiddenInNav: false } } }
        });
        ProviderPlacement.find = () => ({
            lean: async () => [
                {
                    _id: 'p_cpx',
                    providerKey: 'cpx_research',
                    parentTabId: 'other_tasks',
                    subTabId: '',
                    placementEnabled: true,
                    availableTasksVisibility: true,
                    targetingMode: 'all',
                    rolloutPercentage: 100
                },
                {
                    _id: 'p_owgg',
                    providerKey: 'offerwall_gg',
                    parentTabId: 'other_tasks',
                    subTabId: '',
                    placementEnabled: true,
                    availableTasksVisibility: true,
                    targetingMode: 'all',
                    rolloutPercentage: 100
                },
                {
                    _id: 'p_tr',
                    providerKey: 'theoremreach',
                    parentTabId: 'other_tasks',
                    subTabId: '',
                    placementEnabled: true,
                    availableTasksVisibility: true,
                    targetingMode: 'all',
                    rolloutPercentage: 100
                }
            ]
        });
        OfferwallProvider.find = () => ({
            select: () => ({
                lean: async () => [
                    {
                        providerKey: 'cpx_research',
                        enabled: true,
                        status: 'ACTIVE',
                        approvalStatus: 'Approved',
                        appId: '37470',
                        secretKey: 'SUPER_SECRET_CPX'
                    },
                    {
                        providerKey: 'offerwall_gg',
                        enabled: true,
                        status: 'ACTIVE',
                        approvalStatus: 'Approved',
                        secretKey: 'SUPER_SECRET_OWGG',
                        iframeUrlTemplate: 'https://offerwall.gg/wall/44e2f34845f41e2de70f39b9c3b5a543?userId={userId}'
                    },
                    {
                        providerKey: 'theoremreach',
                        enabled: true,
                        status: 'ACTIVE',
                        approvalStatus: 'Approved',
                        apiKey: 'SUPER_SECRET_TR',
                        secretKey: 'SUPER_SECRET_TR_SEC'
                    }
                ]
            })
        });
        globalThis.fetch = async (url) => {
            if (String(url).includes('cpx-research')) {
                return { ok: true, status: 200, text: async () => JSON.stringify({ surveys: [{ id: '1' }, { id: '2' }] }) };
            }
            return {
                ok: true,
                status: 200,
                text: async () => JSON.stringify({ success: true, data: { offers: [{ id: 9 }], pagination: { total: 10 } } })
            };
        };

        try {
            const req = {
                user: { id: '507f1f77bcf86cd799439011' },
                params: {},
                query: { tabIds: 'other_tasks' },
                headers: { 'x-forwarded-for': '8.8.4.4', 'user-agent': 'TestAgent' }
            };
            const res = createMockRes();
            await getTabOfferCounts(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            const tabData = res.body.tabs.other_tasks;
            assert.equal(tabData.placements.p_cpx.verifiedOfferCount, 2);
            assert.equal(tabData.placements.p_owgg.verifiedOfferCount, 10);
            assert.equal(tabData.placements.p_tr.verifiedOfferCount, null);
            assert.equal(tabData.summary.displayBadge, '12+');

            const serialized = JSON.stringify(res.body);
            assert.ok(!serialized.includes('SUPER_SECRET'));
        } finally {
            User.findById = origUserFindById;
            Setting.getSettings = origGetSettings;
            ProviderPlacement.find = origPlacementFind;
            OfferwallProvider.find = origProviderFind;
            globalThis.fetch = origFetch;
            clearOfferCountCache();
        }
    });

    await test('5. Frontend triggers non-blocking background offer counts after front & placements load and wires badges', () => {
        const svcSrc = fs.readFileSync(path.join(ROOT, 'services/providerPlacementService.ts'), 'utf8');
        const dashSrc = fs.readFileSync(path.join(ROOT, 'pages/user/UserWorkAndEarnDashboard.tsx'), 'utf8');
        const panelSrc = fs.readFileSync(path.join(ROOT, 'components/ProviderPlacementPanel.tsx'), 'utf8');
        const otherSrc = fs.readFileSync(path.join(ROOT, 'components/OtherTasksCard.tsx'), 'utf8');

        assert.ok(svcSrc.includes('/offer-counts?tabIds='));
        assert.ok(svcSrc.includes('getHeaders(false, isBackgroundSync)'));
        assert.ok(svcSrc.indexOf('fetchAndCacheAvailablePlacements(normalizedUserId, tabId)') < svcSrc.indexOf('fetchAndCacheTabOfferCounts(normalizedUserId, uniqueTabs'));

        assert.ok(dashSrc.includes('earn-tab-offer-badge-${tab.id}') || dashSrc.includes('`earn-tab-offer-badge-${tab.id}`'));
        assert.ok(dashSrc.includes('subscribeOfferCountUpdates('));
        assert.ok(panelSrc.includes('computeTabOfferCountSummary('));
        assert.ok(panelSrc.includes('fetchAndCacheTabOfferCounts('));
        assert.ok(otherSrc.includes('onVerifiedBadgeChange'));
    });

    console.log(`\nALL ${passed} PROVIDER OFFER COUNT REGRESSION TESTS PASSED.`);
}

runTests().catch((err) => {
    console.error(err);
    process.exit(1);
});
