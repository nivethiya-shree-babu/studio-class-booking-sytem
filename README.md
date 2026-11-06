# Studio Class

## Installation Requirements

Before running the application, make sure the following are installed:

- Node.js
- npm
- SQLite3

## Setup Instructions

Open a terminal in the project folder and run:

```bash
npm install
```

Create the database on Mac or Linux:

```bash
npm run build-db
```

Create the database on Windows:

```bash
npm run build-db-win
```

Start the web application:

```bash
npm start
```

Then open the application in a browser:

```text
http://localhost:3000/
```

## Resetting the Database

To remove the existing database on Mac or Linux before rebuilding it, run:

```bash
npm run clean-db
npm run build-db
```

To remove the existing database on Windows before rebuilding it, run:

```bash
npm run clean-db-win
npm run build-db-win
```

## Additional Libraries Used

The project uses the following additional npm libraries:

- express
- ejs
- sqlite3
- express-session

The project also uses the built-in Node.js crypto module for password hashing.