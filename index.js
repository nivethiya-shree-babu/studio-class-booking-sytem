/**
 * index.js
 * Main application entry point for the Studio Class web application.
 */

// Set up Express, sessions and EJS.
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");
const app = express();
const port = 3000;

// Allows Express to read data submitted from HTML forms.
app.use(express.urlencoded({ extended: true }));

// Set the app to use EJS templates for server-side rendering.
app.set("view engine", "ejs");

// Serve static files from the public folder, such as CSS.
app.use(express.static(__dirname + "/public"));

// Set up sessions so the instructor can stay logged in between requests.
const sessionSecret =
    process.env.SESSION_SECRET ||
    crypto.randomBytes(32).toString("hex");

app.use(
    session({
        name: "event.manager.sid",
        secret: sessionSecret,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 2 * 60 * 60 * 1000
        }
    })
);

// Set up SQLite.
// Items in the global namespace are accessible throughout the node application.
const sqlite3 = require("sqlite3").verbose();

global.db = new sqlite3.Database("./database.db", function (err) {
    if (err) {
        console.error(err);
        process.exit(1);
    } else {
        console.log("Database connected");
        global.db.run("PRAGMA foreign_keys=ON");
    }
});

// GET /
// Purpose: Displays the main home page of the application.
// Inputs: None.
// Outputs: Renders main-home.ejs with links to the instructor login and class booking pages.
app.get("/", (req, res) => {
    res.render("main-home");
});

// Add all instructor route handlers under the /organiser path.
const organiserRoutes = require("./routes/organiser");
app.use("/organiser", organiserRoutes);

// Add all class booking route handlers under the /attendee path.
const attendeeRoutes = require("./routes/attendee");
app.use("/attendee", attendeeRoutes);

// Make the web application listen for HTTP requests.
app.listen(port, () => {
    console.log(`Studio Class app listening on port ${port}`);
});