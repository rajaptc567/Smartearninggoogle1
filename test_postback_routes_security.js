import mongoose from 'mongoose';
import { createUser } from './backend/controllers/usersController.js';
import User from './backend/models/User.js';
import { isAuthorizedAdmin } from './backend/controllers/postbackController.js';

// Define the new middleware logic to test
const requireAdmin = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(403).json({ success: false, error: 'Admin authorization required' });
    }

    try {
        // ALWAYS fetch from DB
        const dbUser = await User.findById(req.user.id).select('role status restrictions');
        
        if (!dbUser || dbUser.status === 'Blocked' || dbUser.restrictions?.loginBlocked) {
            return res.status(403).json({ success: false, error: 'Admin authorization required' });
        }

        if (isAuthorizedAdmin(dbUser)) {
            req.user.role = dbUser.role; // Update role
            return next();
        }
    } catch (err) {
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }

    return res.status(403).json({ success: false, error: 'Admin authorization required' });
};

// Test Runner
async function runTests() {
    console.log('--- TEST GROUP: requireAdmin POSTBACK MIDDLEWARE SECURITY ---');

    const originalFindById = User.findById;
    let passed = 0;
    let failed = 0;
    
    function assert(cond, name) {
        if (cond) {
            passed++;
            console.log(`[PASS] ${name}`);
        } else {
            failed++;
            console.error(`[FAIL] ${name}`);
        }
    }

    // 1. Active Admin
    {
        User.findById = () => ({
            select: () => ({
                lean: async () => ({ role: 'admin', status: 'Active', restrictions: { loginBlocked: false } })
            })
        });
        const req = { user: { id: 'admin123', role: 'user' } };
        const res = { status: (c) => ({ json: (d) => ({ code: c, ...d }) }) };
        let nextCalled = false;
        await requireAdmin(req, res, () => { nextCalled = true; });
        assert(nextCalled === true, 'Active Admin allowed');
        assert(req.user.role === 'admin', 'Role updated');
    }

    // 2. Blocked Admin
    {
        User.findById = () => ({
            select: () => ({
                lean: async () => ({ role: 'admin', status: 'Blocked', restrictions: {} })
            })
        });
        const req = { user: { id: 'admin123', role: 'admin' } };
        const res = { status: (c) => ({ json: (d) => ({ code: c, ...d }) }) };
        const result = await requireAdmin(req, res, () => {});
        assert(result.code === 403, 'Blocked Admin denied');
    }

    // 3. Demoted Admin (JWT says admin, DB says user)
    {
        User.findById = () => ({
            select: () => ({
                lean: async () => ({ role: 'user', status: 'Active', restrictions: {} })
            })
        });
        const req = { user: { id: 'admin123', role: 'admin' } };
        const res = { status: (c) => ({ json: (d) => ({ code: c, ...d }) }) };
        const result = await requireAdmin(req, res, () => {});
        assert(result.code === 403, 'Demoted Admin denied');
    }

    // 4. MongoDB lookup failure
    {
        User.findById = () => ({
            select: () => ({
                lean: async () => { throw new Error('DB Error'); }
            })
        });
        const req = { user: { id: 'admin123', role: 'admin' } };
        const res = { status: (c) => ({ json: (d) => ({ code: c, ...d }) }) };
        const result = await requireAdmin(req, res, () => {});
        assert(result.code === 500, 'DB Error fails closed');
    }

    User.findById = originalFindById;
    console.log(`Total Passed: ${passed}, Failed: ${failed}`);
}

runTests();
