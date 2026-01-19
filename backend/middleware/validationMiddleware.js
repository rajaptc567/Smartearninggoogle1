
import { z } from 'zod';

const schemas = {
    login: z.object({
        email: z.string().email(),
        password: z.string().min(6)
    }),
    register: z.object({
        fullName: z.string().min(3),
        username: z.string().min(3).regex(/^[a-zA-Z0-9_]+$/),
        email: z.string().email(),
        phone: z.string().min(7),
        country: z.string().min(2),
        password: z.string().min(6),
        sponsor: z.string().optional()
    }),
    deposit: z.object({
        amount: z.string().or(z.number()).transform(v => parseFloat(v.toString())),
        method: z.string(),
        transactionId: z.string().min(3),
        senderAccountTitle: z.string().optional(),
        userNotes: z.string().optional()
    }),
    withdrawal: z.object({
        amount: z.number().positive(),
        method: z.string(),
        accountTitle: z.string(),
        accountNumber: z.string(),
        userNotes: z.string().optional()
    }),
    transfer: z.object({
        recipientId: z.string(),
        amount: z.number().positive()
    })
};

export const validate = (schemaName) => (req, res, next) => {
    try {
        const schema = schemas[schemaName];
        if (!schema) return next();
        
        // Handle multipart/form-data for deposits/registrations
        const dataToValidate = req.body;
        schema.parse(dataToValidate);
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.errors ? error.errors[0].message : 'Invalid input data' 
        });
    }
};
