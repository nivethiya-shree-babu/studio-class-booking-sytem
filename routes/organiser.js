/**
 * organiser.js
 * Routes for instructor-side authentication and class management.
 */

const crypto = require("crypto");
const express = require("express");
const router = express.Router();

const passwordHashIterations = 100000;
const passwordHashLength = 64;
const passwordHashDigest = "sha512";

/**
 * createPasswordHash
 * Purpose: Creates a salted password hash for storing instructor passwords safely.
 * Inputs: Plain text password from the sign-up form.
 * Outputs: An object containing the generated salt and password hash.
 */
function createPasswordHash(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto
        .pbkdf2Sync(password, salt, passwordHashIterations, passwordHashLength, passwordHashDigest)
        .toString("hex");

    return {
        salt: salt,
        passwordHash: passwordHash
    };
}

/**
 * passwordMatchesHash
 * Purpose: Checks whether a submitted password matches the stored salted hash.
 * Inputs: Submitted password, stored salt and stored password hash.
 * Outputs: True if the password matches, otherwise false.
 */
function passwordMatchesHash(password, salt, storedPasswordHash) {
    const submittedPasswordHash = crypto
        .pbkdf2Sync(password, salt, passwordHashIterations, passwordHashLength, passwordHashDigest)
        .toString("hex");

    const submittedPasswordBuffer = Buffer.from(submittedPasswordHash, "hex");
    const storedPasswordBuffer = Buffer.from(storedPasswordHash, "hex");

    if (submittedPasswordBuffer.length !== storedPasswordBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(submittedPasswordBuffer, storedPasswordBuffer);
}

/**
 * requireOrganiserLogin
 * Purpose: Protects instructor routes so only logged-in instructors can access them.
 * Inputs: Request, response and next middleware function.
 * Outputs: Allows the request to continue or redirects to the login page.
 */
function requireOrganiserLogin(req, res, next) {
    if (req.session && req.session.organiserId) {
        next();
    } else {
        res.redirect("/organiser/login");
    }
}

/**
 * getSingaporeDateTimeParts
 * Purpose: Gets the current Singapore date and time split into useful parts.
 * Inputs: None.
 * Outputs: An object containing year, month, day, hour, minute and second.
 */
function getSingaporeDateTimeParts() {
    const formatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Singapore",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });

    const formattedParts = formatter.formatToParts(new Date());
    const dateTimeParts = {};

    formattedParts.forEach(function (part) {
        if (part.type !== "literal") {
            dateTimeParts[part.type] = part.value;
        }
    });

    if (dateTimeParts.hour === "24") {
        dateTimeParts.hour = "00";
    }

    return dateTimeParts;
}

/**
 * getTodayDateString
 * Purpose: Gets today's Singapore date in YYYY-MM-DD format.
 * Inputs: None.
 * Outputs: Today's Singapore date as a string.
 */
function getTodayDateString() {
    const dateTimeParts = getSingaporeDateTimeParts();

    return `${dateTimeParts.year}-${dateTimeParts.month}-${dateTimeParts.day}`;
}

/**
 * getCurrentDateTimeString
 * Purpose: Gets the current Singapore date and time in YYYY-MM-DD HH:MM:SS format.
 * Inputs: None.
 * Outputs: Current Singapore date and time as a string.
 */
function getCurrentDateTimeString() {
    const dateTimeParts = getSingaporeDateTimeParts();

    return `${dateTimeParts.year}-${dateTimeParts.month}-${dateTimeParts.day} ${dateTimeParts.hour}:${dateTimeParts.minute}:${dateTimeParts.second}`;
}

/**
 * GET /organiser/login
 * Purpose: Displays the instructor login page.
 * Inputs: None.
 * Outputs: Renders organiser-login.ejs.
 */
router.get("/login", (req, res) => {
    if (req.session && req.session.organiserId) {
        res.redirect("/organiser");
    } else {
        res.render("organiser-login", {
            error: null
        });
    }
});

/**
 * POST /organiser/login
 * Purpose: Checks instructor login details against the organisers database table.
 * Inputs: Username and password from the submitted login form.
 * Outputs: Creates a session and redirects to the Instructor Dashboard if valid, or returns an error.
 */
router.post("/login", (req, res, next) => {
    const username = req.body.username ? req.body.username.trim() : "";
    const password = req.body.password || "";

    if (!username || !password) {
        res.render("organiser-login", {
            error: "Please enter both username and password."
        });
        return;
    }

    const organiserQuery = "SELECT * FROM organisers WHERE username = ?;";

    global.db.get(organiserQuery, [username], function (err, organiser) {
        if (err) {
            next(err);
        } else if (!organiser) {
            res.render("organiser-login", {
                error: "Incorrect username or password."
            });
        } else {
            const passwordIsCorrect = passwordMatchesHash(
                password,
                organiser.password_salt,
                organiser.password_hash
            );

            if (!passwordIsCorrect) {
                res.render("organiser-login", {
                    error: "Incorrect username or password."
                });
            } else {
                req.session.organiserId = organiser.organiser_id;
                req.session.organiserUsername = organiser.username;
                res.redirect("/organiser");
            }
        }
    });
});

/**
 * GET /organiser/signup
 * Purpose: Displays the instructor sign-up page.
 * Inputs: None.
 * Outputs: Renders organiser-signup.ejs.
 */
router.get("/signup", (req, res) => {
    if (req.session && req.session.organiserId) {
        res.redirect("/organiser");
    } else {
        res.render("organiser-signup", {
            error: null
        });
    }
});

/**
 * POST /organiser/signup
 * Purpose: Creates a new instructor account in the database.
 * Inputs: Username, password and confirm password from the submitted sign-up form.
 * Outputs: Creates a new account, starts a session and redirects to the Instructor Dashboard.
 */
router.post("/signup", (req, res, next) => {
    const username = req.body.username ? req.body.username.trim() : "";
    const password = req.body.password || "";
    const confirmPassword = req.body.confirm_password || "";

    const usernameHasInvalidCharacters = !/^[A-Za-z0-9_]+$/.test(username);

    let errorMessage = null;

    if (!username || !password || !confirmPassword) {
        errorMessage = "Please complete all sign-up fields.";
    } else if (username.length < 3) {
        errorMessage = "Username must be at least 3 characters long.";
    } else if (usernameHasInvalidCharacters) {
        errorMessage = "Username can only contain letters, numbers and underscores.";
    } else if (password.length < 6) {
        errorMessage = "Password must be at least 6 characters long.";
    } else if (password !== confirmPassword) {
        errorMessage = "Passwords do not match.";
    }

    if (errorMessage) {
        res.render("organiser-signup", {
            error: errorMessage
        });
        return;
    }

    const existingOrganiserQuery = "SELECT organiser_id FROM organisers WHERE username = ?;";

    global.db.get(existingOrganiserQuery, [username], function (err, existingOrganiser) {
        if (err) {
            next(err);
        } else if (existingOrganiser) {
            res.render("organiser-signup", {
                error: "That username is already taken. Please choose another username."
            });
        } else {
            const hashedPasswordDetails = createPasswordHash(password);
            const currentDateTime = getCurrentDateTimeString();

            const createOrganiserQuery = `
                INSERT INTO organisers (
                    username,
                    password_hash,
                    password_salt,
                    created_at
                )
                VALUES (?, ?, ?, ?);
            `;

            global.db.run(
                createOrganiserQuery,
                [
                    username,
                    hashedPasswordDetails.passwordHash,
                    hashedPasswordDetails.salt,
                    currentDateTime
                ],
                function (err) {
                    if (err) {
                        next(err);
                    } else {
                        req.session.organiserId = this.lastID;
                        req.session.organiserUsername = username;
                        res.redirect("/organiser");
                    }
                }
            );
        }
    });
});

/**
 * POST /organiser/logout
 * Purpose: Logs the instructor out by destroying the session.
 * Inputs: None.
 * Outputs: Redirects to the instructor login page.
 */
router.post("/logout", (req, res) => {
    req.session.destroy(function () {
        res.redirect("/organiser/login");
    });
});

// All instructor management routes below this line require login.
router.use(requireOrganiserLogin);

/**
 * GET /organiser
 * Purpose: Displays the Instructor Dashboard.
 * Inputs: Optional message from the query string.
 * Outputs: Renders organiser-home.ejs with site settings, upcoming classes, past classes, draft classes and an optional message.
 */
router.get("/", (req, res, next) => {
    const todayDate = getTodayDateString();

    // Query the database to retrieve the current site name and description.
    const settingsQuery = "SELECT * FROM site_settings WHERE setting_id = 1;";

    global.db.get(settingsQuery, function (err, settings) {
        if (err) {
            next(err);
        } else {
            // Query the database to retrieve upcoming published events and calculate remaining tickets.
            const upcomingPublishedEventsQuery = `
                SELECT
                    events.*,
                    COALESCE(SUM(bookings.full_price_quantity), 0) AS full_price_booked,
                    COALESCE(SUM(bookings.concession_quantity), 0) AS concession_booked,
                    (
                        events.full_price_ticket_quantity -
                        COALESCE(SUM(bookings.full_price_quantity), 0)
                    ) AS full_price_remaining,
                    (
                        events.concession_ticket_quantity -
                        COALESCE(SUM(bookings.concession_quantity), 0)
                    ) AS concession_remaining
                FROM events
                LEFT JOIN bookings ON events.event_id = bookings.event_id
                WHERE events.status = 'published'
                AND events.event_date >= ?
                GROUP BY events.event_id
                ORDER BY events.event_date ASC;
            `;

            global.db.all(upcomingPublishedEventsQuery, [todayDate], function (err, upcomingPublishedEvents) {
                if (err) {
                    next(err);
                } else {
                    // Query the database to retrieve past published events.
                    const pastPublishedEventsQuery = `
                        SELECT *
                        FROM events
                        WHERE status = 'published'
                        AND event_date < ?
                        ORDER BY event_date DESC;
                    `;

                    global.db.all(pastPublishedEventsQuery, [todayDate], function (err, pastPublishedEvents) {
                        if (err) {
                            next(err);
                        } else {
                            // Query the database to retrieve draft events.
                            const draftEventsQuery = `
                                SELECT *
                                FROM events
                                WHERE status = 'draft'
                                ORDER BY created_at DESC;
                            `;

                            global.db.all(draftEventsQuery, function (err, draftEvents) {
                                if (err) {
                                    next(err);
                                } else {
                                    res.render("organiser-home", {
                                        settings: settings,
                                        upcomingPublishedEvents: upcomingPublishedEvents,
                                        pastPublishedEvents: pastPublishedEvents,
                                        draftEvents: draftEvents,
                                        todayDate: todayDate,
                                        message: req.query.message || null,
                                        organiserUsername: req.session.organiserUsername
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

/**
 * POST /organiser/events/create
 * Purpose: Creates a new draft class and redirects the organiser to its edit page.
 * Inputs: None.
 * Outputs: Inserts a new draft class into the database and redirects to /organiser/events/:id/edit.
 */
router.post("/events/create", (req, res, next) => {
    const eventDate = getTodayDateString();
    const currentDateTime = getCurrentDateTimeString();

    // Insert a new draft class with default values so the instructor can edit it.
    const createEventQuery = `
        INSERT INTO events (
            event_title,
            event_description,
            event_date,
            full_price_ticket_quantity,
            full_price_ticket_price,
            concession_ticket_quantity,
            concession_ticket_price,
            status,
            created_at,
            last_modified_at,
            published_at
        )
        VALUES (
            'Untitled Class',
            'Add class description here.',
            ?,
            0,
            0,
            0,
            0,
            'draft',
            ?,
            ?,
            NULL
        );
    `;

    global.db.run(createEventQuery, [eventDate, currentDateTime, currentDateTime], function (err) {
        if (err) {
            next(err);
        } else {
            res.redirect(`/organiser/events/${this.lastID}/edit`);
        }
    });
});

/**
 * GET /organiser/events/:id/edit
 * Purpose: Displays the Instructor Edit Class Page for one class.
 * Inputs: Event ID from the URL.
 * Outputs: Renders edit-event.ejs with the selected class data.
 */
router.get("/events/:id/edit", (req, res, next) => {
    const eventId = req.params.id;

    // Query the database to retrieve the event being edited.
    const eventQuery = "SELECT * FROM events WHERE event_id = ?;";

    global.db.get(eventQuery, [eventId], function (err, event) {
        if (err) {
            next(err);
        } else if (!event) {
            res.status(404).send("Class not found");
        } else {
            res.render("edit-event", {
                event: event,
                error: null
            });
        }
    });
});

/**
 * POST /organiser/events/:id/edit
 * Purpose: Saves changes made to a class.
 * Inputs: Event ID from the URL and class form data from the request body.
 * Outputs: Updates the selected class in the database and redirects to the Instructor Dashboard.
 */
router.post("/events/:id/edit", (req, res, next) => {
    const eventId = req.params.id;

    const eventTitle = req.body.event_title ? req.body.event_title.trim() : "";
    const eventDescription = req.body.event_description ? req.body.event_description.trim() : "";
    const eventDate = req.body.event_date;

    const fullPriceTicketQuantity = Number(req.body.full_price_ticket_quantity);
    const fullPriceTicketPrice = Number(req.body.full_price_ticket_price);

    const concessionTicketQuantity = Number(req.body.concession_ticket_quantity);
    const concessionTicketPrice = Number(req.body.concession_ticket_price);

    // Query the database to retrieve the event and calculate existing bookings before allowing changes.
    const eventQuery = `
        SELECT
            events.*,
            COALESCE(SUM(bookings.full_price_quantity), 0) AS full_price_booked,
            COALESCE(SUM(bookings.concession_quantity), 0) AS concession_booked
        FROM events
        LEFT JOIN bookings ON events.event_id = bookings.event_id
        WHERE events.event_id = ?
        GROUP BY events.event_id;
    `;

    global.db.get(eventQuery, [eventId], function (err, existingEvent) {
        if (err) {
            next(err);
        } else if (!existingEvent) {
            res.status(404).send("Class not found");
        } else {
            const formHasEmptyFields =
                !eventTitle ||
                !eventDescription ||
                !eventDate ||
                req.body.full_price_ticket_quantity === "" ||
                req.body.full_price_ticket_price === "" ||
                req.body.concession_ticket_quantity === "" ||
                req.body.concession_ticket_price === "";

            const formHasInvalidNumbers =
                Number.isNaN(fullPriceTicketQuantity) ||
                Number.isNaN(fullPriceTicketPrice) ||
                Number.isNaN(concessionTicketQuantity) ||
                Number.isNaN(concessionTicketPrice) ||
                !Number.isInteger(fullPriceTicketQuantity) ||
                !Number.isInteger(concessionTicketQuantity) ||
                fullPriceTicketQuantity < 0 ||
                fullPriceTicketPrice < 0 ||
                concessionTicketQuantity < 0 ||
                concessionTicketPrice < 0;

            const eventHasNoTickets =
                fullPriceTicketQuantity === 0 &&
                concessionTicketQuantity === 0;

            const eventDateIsPast = eventDate < getTodayDateString();

            const concessionPriceIsMoreExpensive =
                concessionTicketPrice > fullPriceTicketPrice;

            const ticketQuantityBelowBooked =
                fullPriceTicketQuantity < existingEvent.full_price_booked ||
                concessionTicketQuantity < existingEvent.concession_booked;

            let errorMessage = null;

            if (formHasEmptyFields) {
                errorMessage = "Please complete all fields.";
            } else if (formHasInvalidNumbers) {
                errorMessage = "Ticket quantities must be whole numbers. Ticket quantities and prices must not be negative.";
            } else if (eventHasNoTickets) {
                errorMessage = "At least one ticket type must have tickets available.";
            } else if (concessionPriceIsMoreExpensive) {
                errorMessage = "Concession ticket price cannot be more expensive than the full-price ticket price.";
            } else if (eventDateIsPast) {
                errorMessage = "The class date cannot be in the past.";
            } else if (ticketQuantityBelowBooked) {
                errorMessage = "Ticket quantities cannot be reduced below the number of tickets already booked.";
            }

            if (errorMessage) {
                res.render("edit-event", {
                    event: {
                        ...existingEvent,
                        event_title: eventTitle,
                        event_description: eventDescription,
                        event_date: eventDate,
                        full_price_ticket_quantity: req.body.full_price_ticket_quantity,
                        full_price_ticket_price: req.body.full_price_ticket_price,
                        concession_ticket_quantity: req.body.concession_ticket_quantity,
                        concession_ticket_price: req.body.concession_ticket_price
                    },
                    error: errorMessage
                });
            } else {
                const currentDateTime = getCurrentDateTimeString();

                // Update the selected class using form values and refresh the last modified timestamp.
                const updateEventQuery = `
                    UPDATE events
                    SET
                        event_title = ?,
                        event_description = ?,
                        event_date = ?,
                        full_price_ticket_quantity = ?,
                        full_price_ticket_price = ?,
                        concession_ticket_quantity = ?,
                        concession_ticket_price = ?,
                        last_modified_at = ?
                    WHERE event_id = ?;
                `;

                global.db.run(
                    updateEventQuery,
                    [
                        eventTitle,
                        eventDescription,
                        eventDate,
                        fullPriceTicketQuantity,
                        fullPriceTicketPrice,
                        concessionTicketQuantity,
                        concessionTicketPrice,
                        currentDateTime,
                        eventId
                    ],
                    function (err) {
                        if (err) {
                            next(err);
                        } else {
                            res.redirect("/organiser");
                        }
                    }
                );
            }
        }
    });
});

/**
 * POST /organiser/events/:id/publish
 * Purpose: Publishes a draft class.
 * Inputs: Event ID from the URL.
 * Outputs: Publishes the class if valid, or redirects to the Instructor Dashboard with an error message if invalid.
 */
router.post("/events/:id/publish", (req, res, next) => {
    const eventId = req.params.id;

    // Query the database to retrieve the event before publishing it.
    const eventQuery = "SELECT * FROM events WHERE event_id = ?;";

    global.db.get(eventQuery, [eventId], function (err, event) {
        if (err) {
            next(err);
        } else if (!event) {
            res.status(404).send("Class not found");
        } else if (event.status === "published") {
            res.redirect("/organiser");
        } else if (event.event_date < getTodayDateString()) {
            const message = "This class cannot be published because the class date is in the past. Please edit the class date first.";
            res.redirect("/organiser?message=" + encodeURIComponent(message));
        } else if (
            Number(event.full_price_ticket_quantity) === 0 &&
            Number(event.concession_ticket_quantity) === 0
        ) {
            const message = "This class cannot be published because at least one ticket type must have tickets available. Please edit the class first.";
            res.redirect("/organiser?message=" + encodeURIComponent(message));
        } else if (
            Number(event.concession_ticket_price) > Number(event.full_price_ticket_price)
        ) {
            const message = "This class cannot be published because concession tickets cannot be more expensive than full-price tickets. Please edit the class first.";
            res.redirect("/organiser?message=" + encodeURIComponent(message));
        } else {
            const currentDateTime = getCurrentDateTimeString();

            // Update the selected class from draft to published and set the publication timestamp.
            const publishEventQuery = `
                UPDATE events
                SET
                    status = 'published',
                    published_at = ?,
                    last_modified_at = ?
                WHERE event_id = ?;
            `;

            global.db.run(publishEventQuery, [currentDateTime, currentDateTime, eventId], function (err) {
                if (err) {
                    next(err);
                } else {
                    res.redirect("/organiser");
                }
            });
        }
    });
});

/**
 * POST /organiser/events/:id/delete
 * Purpose: Deletes a class from the database.
 * Inputs: Event ID from the URL.
 * Outputs: Removes the class and redirects to the Instructor Dashboard.
 */
router.post("/events/:id/delete", (req, res, next) => {
    const eventId = req.params.id;

    // Delete the selected class. Related bookings will also be removed because of the foreign key cascade.
    const deleteEventQuery = "DELETE FROM events WHERE event_id = ?;";

    global.db.run(deleteEventQuery, [eventId], function (err) {
        if (err) {
            next(err);
        } else {
            res.redirect("/organiser");
        }
    });
});

/**
 * GET /organiser/settings
 * Purpose: Displays the Studio Class Settings.
 * Inputs: None.
 * Outputs: Renders site-settings.ejs with the current site settings from the database.
 */
router.get("/settings", (req, res, next) => {
    // Query the database to retrieve the current site settings.
    const settingsQuery = "SELECT * FROM site_settings WHERE setting_id = 1;";

    global.db.get(settingsQuery, function (err, settings) {
        if (err) {
            next(err);
        } else {
            res.render("site-settings", {
                settings: settings,
                error: null
            });
        }
    });
});

/**
 * POST /organiser/settings
 * Purpose: Updates the site name and description.
 * Inputs: Site name and site description from the submitted form.
 * Outputs: Updates the site_settings table and redirects to the Instructor Dashboard.
 */
router.post("/settings", (req, res, next) => {
    const siteName = req.body.site_name ? req.body.site_name.trim() : "";
    const siteDescription = req.body.site_description ? req.body.site_description.trim() : "";

    const formHasEmptyFields = !siteName || !siteDescription;

    if (formHasEmptyFields) {
        res.render("site-settings", {
            settings: {
                site_name: siteName,
                site_description: siteDescription
            },
            error: "Please complete both the site name and site description."
        });
    } else {
        // Update the database with the new site name and description.
        const updateSettingsQuery = `
            UPDATE site_settings
            SET
                site_name = ?,
                site_description = ?
            WHERE setting_id = 1;
        `;

        global.db.run(updateSettingsQuery, [siteName, siteDescription], function (err) {
            if (err) {
                next(err);
            } else {
                res.redirect("/organiser");
            }
        });
    }
});

/**
 * GET /organiser/events/:id/bookings
 * Purpose: Displays the booking dashboard extension for one class.
 * Inputs: Event ID from the URL.
 * Outputs: Renders booking-dashboard.ejs with class details, booking records, ticket totals, remaining tickets and revenue.
 */
router.get("/events/:id/bookings", (req, res, next) => {
    const eventId = req.params.id;

    // Query the database to retrieve the selected class and calculate booking totals.
    const eventSummaryQuery = `
        SELECT
            events.*,
            COALESCE(SUM(bookings.full_price_quantity), 0) AS full_price_booked,
            COALESCE(SUM(bookings.concession_quantity), 0) AS concession_booked,
            COALESCE(
                SUM(
                    (bookings.full_price_quantity * events.full_price_ticket_price) +
                    (bookings.concession_quantity * events.concession_ticket_price)
                ),
                0
            ) AS total_revenue
        FROM events
        LEFT JOIN bookings ON events.event_id = bookings.event_id
        WHERE events.event_id = ?
        GROUP BY events.event_id;
    `;

    global.db.get(eventSummaryQuery, [eventId], function (err, event) {
        if (err) {
            next(err);
        } else if (!event) {
            res.status(404).send("Class not found");
        } else {
            event.full_price_remaining =
                event.full_price_ticket_quantity - event.full_price_booked;

            event.concession_remaining =
                event.concession_ticket_quantity - event.concession_booked;

            event.total_tickets_booked =
                event.full_price_booked + event.concession_booked;

            // Query the database to retrieve all individual bookings and calculate the revenue from each booking.
            const bookingsQuery = `
                SELECT
                    bookings.*,
                    (
                        (bookings.full_price_quantity * events.full_price_ticket_price) +
                        (bookings.concession_quantity * events.concession_ticket_price)
                    ) AS booking_revenue
                FROM bookings
                INNER JOIN events ON bookings.event_id = events.event_id
                WHERE bookings.event_id = ?
                ORDER BY bookings.booking_date DESC, bookings.booking_id DESC;
            `;

            global.db.all(bookingsQuery, [eventId], function (err, bookings) {
                if (err) {
                    next(err);
                } else {
                    res.render("booking-dashboard", {
                        event: event,
                        bookings: bookings
                    });
                }
            });
        }
    });
});

module.exports = router;