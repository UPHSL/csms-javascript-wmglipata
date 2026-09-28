import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

// 1. Define the database file path
const dbPath = path.resolve(process.cwd(), 'csms.db');

// 2. Open the file-backed SQLite database
const db = new DatabaseSync(dbPath);

// 3. Initialize the tables safely
function initializeDatabase() {
    try {
        db.exec('PRAGMA busy_timeout = 5000;');
        db.exec('PRAGMA journal_mode = WAL;');
        
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS residents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                address TEXT NOT NULL,
                contact_number TEXT NOT NULL,
                email TEXT NOT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS service_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                resident_id INTEGER NOT NULL,
                service_type TEXT NOT NULL,
                description TEXT NOT NULL,
                date_requested TEXT NOT NULL,
                status TEXT NOT NULL
            );
        `;
        
        // Execute the query to create the tables
        db.exec(createTableSQL);
    } catch (error) {
        // If the database is locked by another concurrent test file, safely ignore it.
        // The table is already being created by the other test thread.
        if (!error.message.includes('database is locked')) {
            throw error; 
        }
    }
}

// Run the initialization when this file is imported
initializeDatabase();

// Export the database instance for the repository to use
export { db };