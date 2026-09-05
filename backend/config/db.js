import mongoose from 'mongoose';
import { sanitizeMongoUri } from './envValidator.js';

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in the environment variables.');
        }

        const mongooseOptions = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4
        };

        const conn = await mongoose.connect(process.env.MONGO_URI, mongooseOptions);
        console.log(`MongoDB Connected: ${conn.connection.host} (${conn.connection.name})`);

        // Ensure critical production indexes exist and are unique
        try {
            const db = conn.connection.db;
            if (db) {
                const logCol = db.collection('offerwallpostbacklogs');
                const logIndexes = await logCol.indexes();
                const legacyNonUnique = logIndexes.find(i => i.name === 'provider_1_externalTxId_1_isReversal_1' && !i.unique);
                if (legacyNonUnique) {
                    await logCol.dropIndex('provider_1_externalTxId_1_isReversal_1');
                }
                await logCol.createIndex(
                    { provider: 1, externalTxId: 1, isReversal: 1 },
                    { unique: true, background: true }
                );

                const txCol = db.collection('transactions');
                await txCol.createIndex(
                    { idempotencyKey: 1 },
                    { unique: true, sparse: true, background: true }
                );
            }
        } catch (idxErr) {
            console.warn('[DB] Index synchronization notice:', idxErr.message);
        }
    } catch (error) {
        const sanitizedUri = sanitizeMongoUri(process.env.MONGO_URI);
        console.error(`Error connecting to MongoDB [${sanitizedUri}]: ${error.message}`);
        console.error('Troubleshooting checklist:');
        console.error('1. Check username/password credentials in MONGO_URI.');
        console.error('2. Ensure database user has read/write permissions.');
        console.error('3. Whitelist server outbound IP addresses in MongoDB Atlas (Network Access).');
    }
};

export default connectDB;