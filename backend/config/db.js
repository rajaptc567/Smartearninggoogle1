
import mongoose from 'mongoose';

// Export bucket for use in controllers
export let bucket;

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in the environment variables.');
        }
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Initialize GridFS bucket
        const db = mongoose.connection.db;
        bucket = new mongoose.mongo.GridFSBucket(db, {
            bucketName: 'uploads'
        });
        
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
