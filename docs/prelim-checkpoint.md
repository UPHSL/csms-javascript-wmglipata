# Preliminary Examination Developer Checkpoint

### Developer Information
Name: Wilmar G. Lipata
GitHub Username: wmglipata
Primary Technology Stack: JavaScript with Express.js
T03 Branch: feature/t03-resident-persistence

### My T03 Implementation
The database was implemented locally under db.js inside of the csms project. The ResidentRepository.js is responsible for handling saving and finding. When save() is called, it uses parameterized SQL to insert data and node:sqlite returns the lastInsertRowid. The findById() method uses a SELECT statement and returns null if no row is found.

### My Persistence Design Decision
I decided to place the database connection in a dedicated src/database/db.js file instead of app.js. This keeps the application architecture clean and separates database setup from server logic.

### My Database Initialization Design
Database initialization file or module: src/database/db.js
Where the database path comes from: node:path resolving 'csms.db' in the root directory
How the Resident table is initialized: Using a CREATE TABLE IF NOT EXISTS SQL query
How repeated initialization is handled: The IF NOT EXISTS clause prevents errors if the table is already there

I designed this automated setup to ensure that the application is immediately ready to run for any developer, eliminating the need for manual database configuration steps.

### Files I Changed
File: src/database/db.js
Purpose: Initializes the SQLite database and creates the residents table.

File: src/repositories/ResidentRepository.js
Purpose: Handles inserting and retrieving Resident records from the database.

File: test/residentRepository.test.js
Purpose: Tests the persistence layer using an isolated temporary database.

### SQL I Can Explain
SQL I USED:
    INSERT INTO residents (first_name, last_name, address, contact_number, email, status)
    VALUES (?, ?, ?, ?, ?, ?)

Explanation:
    This SQL statement is used inside the save() method of the ResidentRepository to add a new resident to the database. The question marks (?) act as placeholders for the actual values being inserted. This is a crucial security practice called parameterized queries, which prevents SQL injection attacks by ensuring user input is treated strictly as data and never as executable code.

### My Resident Mapping
In the SQLite database, the column names follow a snake_case naming convention, such as first_name and last_name. However, my JavaScript Resident domain model uses the standard camelCase convention, like firstName and lastName. To bridge this gap, the findById method manually maps the database row properties, like row.first_name, to the correct camelCase properties when passing the object payload to the Resident constructor.

### Problem I Encountered
Problem or error: ERR_INVALID_ARG_TYPE (Provided value cannot be bound to SQLite parameter 1)
Cause: In the tests and repository, I was passing individual string arguments to `new Resident()`, but my T01 model constructor actually required a single destructured object. This caused the properties to become undefined.
How I resolved it: I updated findById and my test file to pass a single object with curly braces `{ firstName: '...', lastName: '...' }` to match the constructor perfectly.

### My Student-Designed Test
Test name: Test 8: Handle Special Characters
What it verifies: It verifies that names with apostrophes (O'Brian) and addresses with hyphens are saved and retrieved safely.
Why I chose this scenario: It proves that the repository uses parameterized queries properly, as raw string concatenation would crash the SQL statement.

### Tools and References Used
During this implementation, I referenced the official Node.js documentation and the node:sqlite documentation to understand the built-in database module syntax. Additionally, I used Gemini to assist with debugging a constructor argument error, structuring the temporary test database for my unit tests, and writing safe parameterized SQL queries.