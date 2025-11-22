
import User from '../models/User.js';
import InvestmentPlan from '../models/InvestmentPlan.js';
import Transaction from '../models/Transaction.js';
import PasswordResetRequest from '../models/PasswordResetRequest.js';
import Notification from '../models/Notification.js';
import Setting from '../models/Setting.js'; // Import Setting model
import createLog from '../utils/logger.js';
import { randomBytes, createHash } from 'crypto';

// @desc    Register a new user
// @route   POST /api/v1/users
// @access  Public
export const createUser = async (req, res, next) => {
    try {
        const { fullName, username, email, password, phone, sponsor } = req.body;

        if (sponsor) {
            const sponsorExists = await User.findOne({ username: { $regex: new RegExp(`^${sponsor}$`, 'i') } });
            if (!sponsorExists) {
                return res.status(400).json({ success: false, error: `Sponsor with username '${sponsor}' not found.` });
            }
            req.body.sponsor = sponsorExists.username;
        }

        // Initialize activePlans as empty array
        req.body.activePlans = [];

        const user = await User.create(req.body);
        
        // Create Welcome Notification
        await Notification.create({
            userId: user._id,
            message: `Welcome to SmartEarning, ${user.fullName}! Your account has been successfully created.`
        });

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({ success: true, data: userResponse });
    } catch (err) {
        let errorMessage = 'An unexpected error occurred.';
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue)[0];
            errorMessage = `An account with that ${field} already exists.`;
        } else if (err.name === 'ValidationError') {
            errorMessage = Object.values(err.errors).map(val => val.message).join(', ');
        } else {
            errorMessage = err.message;
        }
        res.status(400).json({ success: false, error: errorMessage });
    }
};

// @desc    Auth user & get token
// @route   POST /api/v1/users/login
// @access  Public
export const loginUser = async (req, res, next) => {
    const { email, password } = req.body;
    try {
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Please provide an email and password' });
        }
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({ success: true, data: userResponse });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};


// @desc    Get all users
// @route   GET /api/v1/users
export const getUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Get single user
// @route   GET /api/v1/users/:id
export const getUser = async (req, res) => {
     try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Update user
// @route   PUT /api/v1/users/:id
export const updateUser = async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!user) return res.status(404).json({ success: false, error: `User not found` });
        res.status(200).json({ success: true, data: user });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Delete user
// @route   DELETE /api/v1/users/:id
export const deleteUser = async (req, res) => {
    try {
        // Cascade Delete: Find the user first to get IDs needed for cleanup
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: `User not found` });

        // Import models dynamically or ensure they are imported at top.
        // Assuming models are imported at top: Deposit, Withdrawal, Transaction, Notification, Transfer, PasswordResetRequest
        const { default: Deposit } = await import('../models/Deposit.js');
        const { default: Withdrawal } = await import('../models/Withdrawal.js');
        const { default: Transaction } = await import('../models/Transaction.js');
        const { default: Notification } = await import('../models/Notification.js');
        const { default: Transfer } = await import('../models/Transfer.js');
        const { default: PasswordResetRequest } = await import('../models/PasswordResetRequest.js');

        // 1. Delete Deposits
        await Deposit.deleteMany({ userId: user._id });

        // 2. Delete Withdrawals
        await Withdrawal.deleteMany({ userId: user._id });

        // 3. Delete Transactions
        await Transaction.deleteMany({ userId: user._id });

        // 4. Delete Notifications
        await Notification.deleteMany({ userId: user._id });
        
        // 5. Delete Password Reset Requests
        await PasswordResetRequest.deleteMany({ userId: user._id });

        // 6. Delete Transfers (Sent and Received)
        await Transfer.deleteMany({ $or: [{ senderId: user._id }, { recipientId: user._id }] });

        // 7. Finally, delete the user
        await User.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    Admin manually adjusts user wallet
// @route   POST /api/v1/users/:id/adjust-wallet
export const adjustWallet = async (req, res) => {
    const { amount, description } = req.body;
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });

        user.walletBalance += amount;
        await user.save();

        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            type: amount > 0 ? 'Manual Credit' : 'Manual Debit',
            amount: amount,
            description: description || 'Admin manual adjustment',
            status: 'Approved'
        });
        
        // Create Notification for the user
        const notifMessage = amount > 0 
            ? `Admin credited $${amount.toFixed(2)} to your wallet. Reason: ${description || 'Manual Adjustment'}`
            : `Admin debited $${Math.abs(amount).toFixed(2)} from your wallet. Reason: ${description || 'Manual Adjustment'}`;

        await Notification.create({
            userId: user._id,
            message: notifMessage
        });
        
        await createLog('Wallet Adjusted', user.username, `Adjusted balance by ${amount}. Reason: ${description}`, 'admin');

        res.status(200).json({ success: true, data: { user, transaction }});
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
}

// @desc    User purchases an investment plan
// @route   POST /api/v1/users/:id/purchase-plan
export const purchasePlan = async (req, res) => {
    const { planId } = req.body;
    try {
        const user = await User.findById(req.params.id);
        const plan = await InvestmentPlan.findById(planId);
        const settings = await Setting.getSettings(); // Fetch settings for commission logic

        if (!user || !plan) return res.status(404).json({ success: false, error: 'User or Plan not found'});
        
        // Check if user already owns this specific plan
        const alreadyOwnsPlan = user.activePlans && user.activePlans.some(p => p.planId.toString() === plan._id.toString());
        if (alreadyOwnsPlan) {
            return res.status(400).json({ success: false, error: `You have already purchased the ${plan.name} plan. You cannot purchase the same plan twice.` });
        }

        if (user.walletBalance < plan.price) return res.status(400).json({ success: false, error: 'Insufficient funds'});
        
        // 1. Deduct Balance
        user.walletBalance -= plan.price;
        
        // 2. Add to Active Plans
        // Update the legacy 'activePlan' string to the latest plan name for quick display
        user.activePlan = plan.name;
        
        // Add to the array of active plans
        if (!user.activePlans) user.activePlans = [];
        user.activePlans.push({
            planId: plan._id,
            planName: plan.name,
            price: plan.price,
            purchaseDate: new Date()
        });

        await user.save();
        
        const transaction = await Transaction.create({
            userId: user._id,
            userName: user.username,
            type: 'Plan Purchase',
            amount: -plan.price,
            description: `Purchased ${plan.name} plan`,
            status: 'Approved'
        });

        await Notification.create({
            userId: user._id,
            message: `You successfully purchased the ${plan.name} plan for $${plan.price.toFixed(2)}.`
        });

        // --- RELEASE HELD COMMISSIONS LOGIC ---
        
        let releasedCommissionsQuery = {
            userId: user._id,
            type: 'Commission',
            status: 'Pending',
        };

        // STRICT PLAN MATCHING RULE
        // If enabled, buying Plan X ONLY releases commissions held for Plan X.
        if (settings.requirePlanMatchForCommission) {
            releasedCommissionsQuery.relatedPlanId = plan._id;
        } else if (settings.requireActivePlanForCommission) {
            // General active rule: Release ALL pending commissions because user is now "Active" with at least one plan
            // No relatedPlanId filter applied
        } else {
            // Fallback: default behavior releases related plan commissions to be safe
            releasedCommissionsQuery.relatedPlanId = plan._id;
        }

        const heldCommissions = await Transaction.find(releasedCommissionsQuery);

        if (heldCommissions.length > 0) {
            let totalReleased = 0;
            for (const comm of heldCommissions) {
                comm.status = 'Approved';
                await comm.save();
                totalReleased += comm.amount;
            }
            
            // Re-add released amount to wallet
            user.walletBalance += totalReleased;
            await user.save(); 
            
            await Notification.create({
                userId: user._id,
                message: `Congratulations! Purchasing ${plan.name} has unlocked $${totalReleased.toFixed(2)} in previously held commissions.`
            });
        }

        // --- COMMISSION DISTRIBUTION LOGIC ---

        const calculateAmount = (commissionConfig, planPrice) => {
            if (!commissionConfig) return 0;
            const value = parseFloat(commissionConfig.value);
            if (isNaN(value)) return 0;

            if (commissionConfig.type === 'percentage') {
                return (planPrice * value) / 100;
            }
            return value; // Fixed amount
        };

        if (user.sponsor) {
            // A. Direct Commission (Level 1)
            const sponsor = await User.findOne({ username: { $regex: new RegExp(`^${user.sponsor}$`, 'i') } });
            
            // Helper to determine eligibility based on settings
            const checkEligibility = (uplineUser, purchasePlanId) => {
                let status = 'Approved';
                let message = '';

                const activePlans = uplineUser.activePlans || [];
                const hasAnyPlan = activePlans.length > 0;
                
                // Check Strict Match Rule: Sponsor must have the SAME plan
                if (settings.requirePlanMatchForCommission) {
                    const hasSamePlan = activePlans.some(p => p.planId.toString() === purchasePlanId.toString());
                    if (!hasSamePlan) {
                        return { 
                            status: 'Pending', 
                            message: `Commission Held! Purchase the ${plan.name} plan to start earning commissions from your referrals.`
                        };
                    }
                }
                // Check General Active Rule: Sponsor must have ANY plan
                else if (settings.requireActivePlanForCommission) {
                    if (!hasAnyPlan) {
                        return { 
                            status: 'Pending', 
                            message: `Commission Held! Purchase any plan to activate your earnings from ${user.username}.`
                        };
                    }
                }

                return { status, message };
            };

            if (sponsor && sponsor.status === 'Active') {
                let commissionAmount = 0;

                // Logic for Tiered vs Standard Direct Commission
                if (plan.directReferralLimit > 0) {
                    const directReferrals = await User.find({ sponsor: { $regex: new RegExp(`^${sponsor.username}$`, 'i') } }).sort({ registrationDate: 1 });
                    const referralIndex = directReferrals.findIndex(u => u._id.toString() === user._id.toString());
                    
                    if (referralIndex !== -1 && plan.directCommissions && referralIndex < plan.directCommissions.length) {
                        commissionAmount = calculateAmount(plan.directCommissions[referralIndex], plan.price);
                    }
                } else {
                    if (plan.directCommissions && plan.directCommissions.length > 0) {
                        commissionAmount = calculateAmount(plan.directCommissions[0], plan.price);
                    }
                }

                if (commissionAmount > 0) {
                    // Check Eligibility
                    const eligibility = checkEligibility(sponsor, plan._id);
                    
                    if (eligibility.status === 'Approved') {
                        sponsor.walletBalance += commissionAmount;
                        await sponsor.save();
                        await Notification.create({
                            userId: sponsor._id,
                            message: `You earned a direct commission of $${commissionAmount.toFixed(2)} from ${user.username}.`
                        });
                    } else {
                        // Send "Held" notification
                        await Notification.create({
                            userId: sponsor._id,
                            message: eligibility.message
                        });
                    }

                    await Transaction.create({
                        userId: sponsor._id,
                        userName: sponsor.username,
                        type: 'Commission',
                        amount: commissionAmount,
                        level: 1,
                        description: `Direct Commission From ${user.username} (${plan.name})`,
                        status: eligibility.status, // Approved or Pending
                        relatedPlanId: plan._id // Link to plan for future release
                    });
                }

                // B. Indirect Commissions (Level 2+)
                if (plan.indirectCommissions && plan.indirectCommissions.length > 0) {
                    let currentUplineUsername = sponsor.sponsor;
                    
                    for (let i = 0; i < plan.indirectCommissions.length; i++) {
                        if (!currentUplineUsername) break; 

                        const uplineUser = await User.findOne({ username: { $regex: new RegExp(`^${currentUplineUsername}$`, 'i') } });
                        if (!uplineUser) break; 

                        if (uplineUser.status === 'Active') {
                            const levelCommissionAmount = calculateAmount(plan.indirectCommissions[i], plan.price);

                            if (levelCommissionAmount > 0) {
                                // Check Eligibility for Indirect Upline too
                                const indirectEligibility = checkEligibility(uplineUser, plan._id);

                                if (indirectEligibility.status === 'Approved') {
                                    uplineUser.walletBalance += levelCommissionAmount;
                                    await uplineUser.save();
                                    await Notification.create({
                                        userId: uplineUser._id,
                                        message: `You earned a Level ${i + 2} commission of $${levelCommissionAmount.toFixed(2)} from ${user.username}.`
                                    });
                                } else {
                                     await Notification.create({
                                        userId: uplineUser._id,
                                        message: indirectEligibility.message
                                    });
                                }

                                await Transaction.create({
                                    userId: uplineUser._id,
                                    userName: uplineUser.username,
                                    type: 'Commission',
                                    amount: levelCommissionAmount,
                                    level: i + 2, // i=0 is Level 2
                                    description: `Level ${i + 2} Commission From ${user.username} (${plan.name})`,
                                    status: indirectEligibility.status,
                                    relatedPlanId: plan._id
                                });
                            }
                        }
                        currentUplineUsername = uplineUser.sponsor;
                    }
                }
            }
        }

        // --- END COMMISSION LOGIC ---
        
        res.status(200).json({ success: true, data: { user, transaction } });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
};

// @desc    User requests a password reset
// @route   POST /api/v1/users/request-password-reset
// @access  Public
export const userRequestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            // To prevent email enumeration, we send a generic success response.
            // The user is told a request is sent; if the user doesn't exist, no request is actually created.
            return res.status(200).json({ success: true, data: 'If a user with this email exists, a request has been sent to the admin.' });
        }

        const existingRequest = await PasswordResetRequest.findOne({ userId: user._id, status: 'Pending' });
        if (existingRequest) {
            return res.status(200).json({ success: true, data: 'A request is already pending for this user.' });
        }

        await PasswordResetRequest.create({
            userId: user._id,
            userEmail: user.email,
            userName: user.username,
        });

        res.status(200).json({ success: true, data: 'Your request has been sent to the administrator.' });
    } catch (err) {
        // Even on error, send a generic response to the client for security.
        console.error('Error in userRequestPasswordReset:', err);
        res.status(200).json({ success: true, data: 'If a user with this email exists, a request has been sent to the admin.' });
    }
};


// @desc    Admin initiates password reset for a user
// @route   POST /api/v1/users/:id/admin-reset-password
// @access  Private/Admin
export const adminInitiatePasswordReset = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const resetToken = randomBytes(20).toString('hex');

        user.passwordResetToken = createHash('sha256')
            .update(resetToken)
            .digest('hex');

        // Set token to expire in 48 hours
        user.passwordResetExpires = Date.now() + 48 * 60 * 60 * 1000;
        
        await user.save();
        
        await createLog('Password Reset Initiated', user.username, `Admin generated a password reset link.`, 'admin');

        res.status(200).json({ success: true, data: { resetToken } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// @desc    Verify token and start 10-minute timer
// @route   POST /api/v1/users/verify-reset-token/:token
// @access  Public
export const verifyAndStartResetTimer = async (req, res) => {
    try {
        const resetToken = req.params.token;
        const hashedToken = createHash('sha256')
            .update(resetToken)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'Invalid or expired token.' });
        }

        // Token is valid, now start the 10-minute timer for the actual reset
        user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        res.status(200).json({ success: true, data: 'Token verified. You have 10 minutes to reset your password.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// @desc    Reset password using a token
// @route   PUT /api/v1/users/reset-password/:token
// @access  Public
export const resetPasswordWithToken = async (req, res) => {
    try {
        const resetToken = req.params.token;
        const hashedToken = createHash('sha256')
            .update(resetToken)
            .digest('hex');

        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ success: false, error: 'Invalid or expired token.' });
        }

        // Set new password
        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(200).json({ success: true, data: 'Password reset successful.' });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
