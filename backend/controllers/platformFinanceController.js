import { isUserAdmin } from '../middleware/authMiddleware.js';
import {
    getPlatformFinanceSummary,
    getPlatformLedgerHistory,
    topUpPlatformBalance
} from '../services/platformFinanceService.js';

/**
 * @desc Get Platform Treasury Financial Summary
 * @route GET /api/v1/platform-finance/summary or /api/v1/user-tasks/platform-finance/summary
 * @access Admin/Super Admin only
 */
export const getPlatformSummary = async (req, res) => {
    try {
        if (!req.user || !isUserAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required.' });
        }

        const summary = await getPlatformFinanceSummary();
        return res.status(200).json({ success: true, data: summary });
    } catch (error) {
        console.error('Error fetching platform finance summary:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to fetch platform summary.' });
    }
};

/**
 * @desc Get Platform Immutable Ledger History
 * @route GET /api/v1/platform-finance/ledger or /api/v1/user-tasks/platform-finance/ledger
 * @access Admin/Super Admin only
 */
export const getPlatformLedger = async (req, res) => {
    try {
        if (!req.user || !isUserAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required.' });
        }

        const { page, limit, type, campaignId } = req.query;
        const result = await getPlatformLedgerHistory({
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 50,
            type,
            campaignId
        });

        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetching platform ledger:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to fetch platform ledger.' });
    }
};

/**
 * @desc Admin manual top-up of Platform Treasury Available Balance
 * @route POST /api/v1/platform-finance/top-up or /api/v1/user-tasks/platform-finance/top-up
 * @access Admin/Super Admin only
 */
export const topUpPlatformTreasury = async (req, res) => {
    try {
        if (!req.user || !isUserAdmin(req.user)) {
            return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required.' });
        }

        const { amount, currency = 'USD', description, idempotencyKey } = req.body;
        const numericAmount = Number(amount);

        if (isNaN(numericAmount) || numericAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Top-up amount must be a positive number.' });
        }

        const result = await topUpPlatformBalance({
            amount: numericAmount,
            currency,
            performedBy: req.user._id,
            performedByUsername: req.user.username || req.user.fullName || 'Admin',
            description: description || 'Manual Platform Treasury Top-Up',
            idempotencyKey
        });

        return res.status(200).json({
            success: true,
            message: `Platform Treasury topped up successfully: +$${numericAmount.toFixed(2)} USD`,
            data: result
        });
    } catch (error) {
        console.error('Error topping up platform treasury:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to top up platform treasury.' });
    }
};

export default {
    getPlatformSummary,
    getPlatformLedger,
    topUpPlatformTreasury
};
