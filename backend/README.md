# SmartEarning Backend

This is the backend server for the SmartEarning platform, built with Node.js, Express, and MongoDB.

## Prerequisites

-   [Node.js](https://nodejs.org/) (v14 or higher)
-   [MongoDB](https://www.mongodb.com/try/download/community) installed and running locally, or a MongoDB Atlas account for a cloud database.

## Getting Started

Follow these steps to get the backend server up and running on your local machine.

### 1. Navigate to the Backend Directory
From the root of the project, move into the `backend` folder:
```bash
cd backend
```

### 2. Install Dependencies
Install all the required npm packages:
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the `backend` directory by copying the example file:
```bash
cp .env.example .env
```
Open the newly created `.env` file and add your MongoDB connection string. Replace `your_mongodb_connection_string_here` with your actual URI (e.g., `mongodb://127.0.0.1:27017/smartearning` for a local database).
```
NODE_ENV=development
PORT=5000
MONGO_URI=your_mongodb_connection_string_here
```

### 4. Start the Server
You can run the server in two modes:

**Development Mode:**
This uses `nodemon` to automatically restart the server whenever you save a file.
```bash
npm run dev
```

**Production Mode:**
This runs the server using `node`.
```bash
npm start
```

The server should now be running on `http://localhost:5000`. You can test it by visiting this URL in your browser or API client.

## API Structure

The API is structured using a standard Model-View-Controller (MVC) pattern (though without the 'View' on the backend):

-   **`config/`**: Contains configuration files, such as the database connection logic (`db.js`).
-   **`models/`**: Contains all Mongoose schemas and models, which define the structure of the data in your MongoDB collections.
-   **`routes/`**: Defines the API endpoints (e.g., `/api/v1/users`) and maps them to the appropriate controller functions.
-   **`controllers/`**: Contains the business logic that handles incoming requests, interacts with the models to perform database operations, and sends back a response.

The **Users API** is provided as a complete example. To add more functionality (e.g., for Deposits, Withdrawals), you can follow the same pattern:
1.  Create a new model file in the `models` directory (e.g., `Deposit.js`).
2.  Create a new controller file in `controllers` (e.g., `depositsController.js`).
3.  Create a new route file in `routes` (e.g., `depositRoutes.js`).
4.  Import and mount the new route in the main `server.js` file.
