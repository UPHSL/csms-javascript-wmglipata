import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

// 1. Define the database file path
const dbPath = path.resolve(process.cwd(), 'csms.db');

// 2. Open the file-backed SQLite database
const db = new DatabaseSync(dbPath);

// 3. Initialize the table
function initializeDatabase() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS residents (
            id INTEGER PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            address TEXT NOT NULL,
            contact_number TEXT NOT NULL,
            email TEXT NOT NULL,
            status TEXT NOT NULL
        );
    `;
    
    // Execute the query to create the table
    db.exec(createTableSQL);
}

// Run the initialization when this file is imported
initializeDatabase();

// Export the database instance for the repository to use
export { db };