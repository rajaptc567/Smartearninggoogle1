import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        // Mongoose will throw an error if the MONGO_URI is not set in the environment variables
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in the environment variables.');
        }
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        // Log a more detailed error message to help with debugging connection issues.
        console.error(`Error connecting to MongoDB: ${error.message}`);
        console.error('Check your MONGO_URI in the Settings > Secrets menu.');
    }
};

export default connectDB;