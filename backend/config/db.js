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
        console.error('This can happen if:');
        console.error('1. The MONGO_URI environment variable is incorrect (check username, password, and cluster URL).');
        console.error('2. The database user does not have the correct permissions (should be "Read and write to any database").');
        console.error('3. The IP address of the Render server is not whitelisted in MongoDB Atlas (you have already done this with 0.0.0.0/0, which is correct).');
        process.exit(1);
    }
};

export default connectDB;