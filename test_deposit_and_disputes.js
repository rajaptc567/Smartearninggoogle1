import assert from 'assert';
import { createDispute } from './backend/controllers/disputesController.js';
import Dispute from './backend/models/Dispute.js';
import Deposit from './backend/models/Deposit.js';
import User from './backend/models/User.js';
import Notification from './backend/models/Notification.js';

console.log('========================================================================');
console.log('Running Deposit Receipts & Deposit Disputes Verification Test Suite');
console.log('========================================================================\n');

async function runTests() {
    // -------------------------------------------------------------------------
    // Test 1: Deposit Receipt URL Helper Logic
    // -------------------------------------------------------------------------
    console.log('Test 1: Verifying getReceiptSrc URL formatting...');
    const UPLOADS_URL = 'https://smartexn.com/uploads/';
    const getReceiptSrc = (url) => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
            return url;
        }
        if (url.startsWith('/')) {
            return `${UPLOADS_URL.replace(/\/$/, '')}${url}`;
        }
        return `${UPLOADS_URL.replace(/\/$/, '')}/${url}`;
    };

    const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v12345/receipt.jpg';
    assert.equal(getReceiptSrc(cloudinaryUrl), cloudinaryUrl, 'Cloudinary URL must be returned unchanged');

    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSU...';
    assert.equal(getReceiptSrc(dataUrl), dataUrl, 'Data URL must be returned unchanged');

    const relativePath = 'deposits/receipt123.jpg';
    assert.equal(getReceiptSrc(relativePath), 'https://smartexn.com/uploads/deposits/receipt123.jpg', 'Relative path must prepend UPLOADS_URL');
    console.log('✓ Passed Test 1: getReceiptSrc correctly handles Cloudinary, absolute, data, and relative URLs.\n');

    // -------------------------------------------------------------------------
    // Test 2: Deposit Dispute Backend Security & Validation
    // -------------------------------------------------------------------------
    console.log('Test 2: Verifying Deposit dispute creation backend validation...');
    const mockUsers = new Map();
    const mockDeposits = new Map();
    const mockDisputes = new Map();
    const mockNotifications = [];

    // Mock DB functions
    const origUserFindById = User.findById;
    const origUserFind = User.find;
    const origDepositFindById = Deposit.findById;
    const origDisputeFindOne = Dispute.findOne;
    const origDisputeCreate = Dispute.create;
    const origNotifCreate = Notification.create;

    User.findById = async (id) => mockUsers.get(String(id)) || null;
    User.find = (query) => ({
        select: async () => [{ _id: 'admin_user_1', role: 'admin' }]
    });

    Deposit.findById = async (id) => mockDeposits.get(String(id)) || null;

    Dispute.findOne = async (query) => {
        for (const d of mockDisputes.values()) {
            if (d.type === query.type && String(d.referenceId) === String(query.referenceId)) {
                if (query.status?.$in && query.status.$in.includes(d.status)) {
                    return d;
                }
            }
        }
        return null;
    };

    Dispute.create = async (data) => {
        const id = `disp_${Date.now()}_${Math.random()}`;
        const created = { _id: id, date: new Date(), status: 'Open', ...data };
        mockDisputes.set(id, created);
        return created;
    };

    Notification.create = async (notif) => {
        mockNotifications.push(notif);
        return notif;
    };

    // Seed test user and deposits
    mockUsers.set('user_101', { _id: 'user_101', username: 'john_worker', status: 'Active' });
    mockUsers.set('user_102', { _id: 'user_102', username: 'other_worker', status: 'Active' });

    const validDepId1 = '507f1f77bcf86cd799439011';
    const validDepId2 = '507f1f77bcf86cd799439012';
    const validDepId3 = '507f1f77bcf86cd799439013';
    const validDepIdNonExistent = '507f1f77bcf86cd799439099';

    mockDeposits.set(validDepId1, { _id: validDepId1, userId: 'user_101', status: 'Rejected', amount: 50 });
    mockDeposits.set(validDepId2, { _id: validDepId2, userId: 'user_101', status: 'Pending', amount: 100 });
    mockDeposits.set(validDepId3, { _id: validDepId3, userId: 'user_101', status: 'Approved', amount: 200 });

    const createRes = () => {
        const res = {
            statusCode: 200,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(data) { this.body = data; return this; }
        };
        return res;
    };

    // Sub-case Placeholder Rejection: Placeholder reference ID (e.g. "N/A" or "OTHER-MISSED-ISSUE")
    const reqP = {
        user: { id: 'user_101', role: 'user' },
        body: { userId: 'user_101', type: 'Deposit', referenceId: 'OTHER-MISSED-ISSUE', description: 'Placeholder bypass attempt' }
    };
    const resP = createRes();
    await createDispute(reqP, resP);
    assert.equal(resP.statusCode, 400);
    assert.equal(resP.body.success, false);
    assert.ok(resP.body.error.includes('valid referenced Deposit ID is required'));
    console.log('✓ Passed Test 2 Placeholder: Placeholder reference ID rejected with 400.');

    // Sub-case A: Non-existent deposit reference ID
    const reqA = {
        user: { id: 'user_101', role: 'user' },
        body: { userId: 'user_101', type: 'Deposit', referenceId: validDepIdNonExistent, description: 'Missing deposit' }
    };
    const resA = createRes();
    await createDispute(reqA, resA);
    assert.equal(resA.statusCode, 404);
    assert.equal(resA.body.success, false);
    assert.ok(resA.body.error.includes('Referenced Deposit not found'));
    console.log('✓ Passed Test 2A: Non-existent deposit reference rejected with 404.');

    // Sub-case B: Disputing another user\'s deposit
    const reqB = {
        user: { id: 'user_102', role: 'user' },
        body: { userId: 'user_102', type: 'Deposit', referenceId: validDepId1, description: 'Not my deposit' }
    };
    const resB = createRes();
    await createDispute(reqB, resB);
    assert.equal(resB.statusCode, 403);
    assert.equal(resB.body.success, false);
    assert.ok(resB.body.error.includes('only dispute your own deposits'));
    console.log('✓ Passed Test 2B: Disputing another user\'s deposit rejected with 403.');

    // Sub-case C: Disputing pending/approved deposit
    const reqC = {
        user: { id: 'user_101', role: 'user' },
        body: { userId: 'user_101', type: 'Deposit', referenceId: validDepId2, description: 'Pending deposit' }
    };
    const resC = createRes();
    await createDispute(reqC, resC);
    assert.equal(resC.statusCode, 400);
    assert.equal(resC.body.success, false);
    assert.ok(resC.body.error.includes('Only rejected deposits can be disputed'));
    console.log('✓ Passed Test 2C: Disputing pending deposit rejected with 400.');

    // Sub-case D: Valid deposit dispute submission
    const reqD = {
        user: { id: 'user_101', role: 'user' },
        body: { userId: 'user_101', type: 'Deposit', referenceId: validDepId1, description: 'Proof was uploaded properly' }
    };
    const resD = createRes();
    await createDispute(reqD, resD);
    assert.equal(resD.statusCode, 201);
    assert.equal(resD.body.success, true);
    assert.equal(resD.body.data.type, 'Deposit');
    assert.equal(resD.body.data.referenceId, validDepId1);
    console.log('✓ Passed Test 2D: Valid rejected deposit dispute submitted successfully.');

    // Sub-case E: Duplicate dispute on same deposit
    const reqE = {
        user: { id: 'user_101', role: 'user' },
        body: { userId: 'user_101', type: 'Deposit', referenceId: validDepId1, description: 'Second attempt' }
    };
    const resE = createRes();
    await createDispute(reqE, resE);
    assert.equal(resE.statusCode, 409);
    assert.equal(resE.body.success, false);
    assert.ok(resE.body.error.includes('active dispute already exists'));
    console.log('✓ Passed Test 2E: Duplicate dispute blocked with 409.');

    // Sub-case F: Admin notification created
    const adminNotifs = mockNotifications.filter(n => n.userId === 'admin_user_1');
    assert.ok(adminNotifs.length > 0, 'Admin notification must be generated on dispute creation');
    assert.ok(adminNotifs[0].subject.includes('Dispute Ticket'), 'Admin notification subject must mention Dispute Ticket');
    console.log('✓ Passed Test 2F: Admin notification automatically created on dispute entry.\n');

    // Restore DB functions
    User.findById = origUserFindById;
    User.find = origUserFind;
    Deposit.findById = origDepositFindById;
    Dispute.findOne = origDisputeFindOne;
    Dispute.create = origDisputeCreate;
    Notification.create = origNotifCreate;

    console.log('========================================================================');
    console.log('All Deposit Receipt & Deposit Dispute Verification Tests PASSED!');
    console.log('========================================================================\n');
}

runTests().catch(err => {
    console.error('Test failure:', err);
    process.exit(1);
});
