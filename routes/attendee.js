/**
 * attendee.js
 * Routes for member-side class browsing and booking.
 */

const express = require("express");
const router = express.Router();

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
 * getSingaporeDateTimeString
 * Purpose: Gets the current Singapore date and time in YYYY-MM-DD HH:MM:SS format.
 * Inputs: None.
 * Outputs: Current Singapore date and time as a string.
 */
function getSingaporeDateTimeString() {
    const dateTimeParts = getSingaporeDateTimeParts();

    return `${dateTimeParts.year}-${dateTimeParts.month}-${dateTimeParts.day} ${dateTimeParts.hour}:${dateTimeParts.minute}:${dateTimeParts.second}`;
}

/**
 * GET /attendee
 * Purpose: Displays the Class Booking Portal.
 * Inputs: None.
 * Outputs: Renders attendee-home.ejs with site settings, upcoming classes, past classes and ticket availability from the database.
 */
router.get("/", (req, res, next) => {
    const todayDate = getTodayDateString();

    // Query the database to retrieve the current site name and description.
    const settingsQuery = "SELECT * FROM site_settings WHERE setting_id = 1;";

    global.db.get(settingsQuery, function (err, settings) {
        if (err) {
            next(err);
        } else {
            // Query the database to retrieve upcoming published classs and calculate remaining tickets.
            const upcomingEventsQuery = `
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

            global.db.all(upcomingEventsQuery, [todayDate], function (err, upcomingEvents) {
                if (err) {
                    next(err);
                } else {
                    // Query the database to retrieve past published classs and calculate remaining tickets.
                    const pastEventsQuery = `
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
                        AND events.event_date < ?
                        GROUP BY events.event_id
                        ORDER BY events.event_date DESC;
                    `;

                    global.db.all(pastEventsQuery, [todayDate], function (err, pastEvents) {
                        if (err) {
                            next(err);
                        } else {
                            res.render("attendee-home", {
                                settings: settings,
                                upcomingEvents: upcomingEvents,
                                pastEvents: pastEvents,
                                todayDate: todayDate
                            });
                        }
                    });
                }
            });
        }
    });
});

/**
 * getEventWithAvailability
 * Purpose: Retrieves one published class and calculates how many tickets are still available.
 * Inputs: Class ID and callback function.
 * Outputs: Returns the class with booked and remaining ticket quantities.
 */
function getEventWithAvailability(eventId, callback) {
    // Query the database to retrieve the class and calculate booked tickets using the bookings table.
    const eventQuery = `
        SELECT
            events.*,
            COALESCE(SUM(bookings.full_price_quantity), 0) AS full_price_booked,
            COALESCE(SUM(bookings.concession_quantity), 0) AS concession_booked
        FROM events
        LEFT JOIN bookings ON events.event_id = bookings.event_id
        WHERE events.event_id = ?
        AND events.status = 'published'
        GROUP BY events.event_id;
    `;

    global.db.get(eventQuery, [eventId], function (err, event) {
        if (err) {
            callback(err);
        } else if (!event) {
            callback(null, null);
        } else {
            event.full_price_remaining =
                event.full_price_ticket_quantity - event.full_price_booked;

            event.concession_remaining =
                event.concession_ticket_quantity - event.concession_booked;

            callback(null, event);
        }
    });
}

/**
 * GET /attendee/events/:id
 * Purpose: Displays the Class Details Page for one published class.
 * Inputs: Class ID from the URL.
 * Outputs: Renders attendee-event.ejs with class details and ticket availability.
 */
router.get("/events/:id", (req, res, next) => {
    const eventId = req.params.id;

    getEventWithAvailability(eventId, function (err, event) {
        if (err) {
            next(err);
        } else if (!event) {
            res.status(404).send("Published class not found");
        } else {
            const eventIsPast = event.event_date < getTodayDateString();

            res.render("attendee-event", {
                event: event,
                eventIsPast: eventIsPast,
                error: null,
                success: null,
                formData: {
                    attendee_name: "",
                    full_price_quantity: 0,
                    concession_quantity: 0
                }
            });
        }
    });
});

/**
 * POST /attendee/events/:id/book
 * Purpose: Books tickets for a published class.
 * Inputs: Class ID from the URL, member name and ticket quantities from the submitted form.
 * Outputs: Inserts a booking into the database if tickets are available, then re-renders the class page.
 */
router.post("/events/:id/book", (req, res, next) => {
    const eventId = req.params.id;

    const attendeeName = req.body.attendee_name
        ? req.body.attendee_name.trim()
        : "";

    const fullPriceQuantity =
        req.body.full_price_quantity === undefined ||
        req.body.full_price_quantity === ""
            ? 0
            : Number(req.body.full_price_quantity);

    const concessionQuantity =
        req.body.concession_quantity === undefined ||
        req.body.concession_quantity === ""
            ? 0
            : Number(req.body.concession_quantity);

    getEventWithAvailability(eventId, function (err, event) {
        if (err) {
            next(err);
        } else if (!event) {
            res.status(404).send("Published class not found");
        } else {
            const eventIsPast = event.event_date < getTodayDateString();

            const formHasInvalidName = attendeeName === "";

            const formHasInvalidNumbers =
                Number.isNaN(fullPriceQuantity) ||
                Number.isNaN(concessionQuantity) ||
                fullPriceQuantity < 0 ||
                concessionQuantity < 0 ||
                !Number.isInteger(fullPriceQuantity) ||
                !Number.isInteger(concessionQuantity);

            const noTicketsSelected =
                fullPriceQuantity === 0 && concessionQuantity === 0;

            const bookingExceedsAvailability =
                fullPriceQuantity > event.full_price_remaining ||
                concessionQuantity > event.concession_remaining;

            const eventIsSoldOut =
                event.full_price_remaining <= 0 &&
                event.concession_remaining <= 0;

            if (
                eventIsPast ||
                formHasInvalidName ||
                formHasInvalidNumbers ||
                noTicketsSelected ||
                bookingExceedsAvailability ||
                eventIsSoldOut
            ) {
                let errorMessage = "Please enter your name and select at least one valid ticket.";

                if (eventIsPast) {
                    errorMessage = "This class has already taken place and is no longer available for booking.";
                } else if (eventIsSoldOut) {
                    errorMessage = "Sorry, this class is sold out.";
                } else if (bookingExceedsAvailability) {
                    errorMessage = "Sorry, there are not enough tickets available for this booking.";
                }

                res.render("attendee-event", {
                    event: event,
                    eventIsPast: eventIsPast,
                    error: errorMessage,
                    success: null,
                    formData: {
                        attendee_name: attendeeName,
                        full_price_quantity: req.body.full_price_quantity || 0,
                        concession_quantity: req.body.concession_quantity || 0
                    }
                });
            } else {
                const bookingDate = getSingaporeDateTimeString();

                // Insert the member booking into the bookings table.
                const insertBookingQuery = `
                    INSERT INTO bookings (
                        event_id,
                        attendee_name,
                        full_price_quantity,
                        concession_quantity,
                        booking_date
                    )
                    VALUES (?, ?, ?, ?, ?);
                `;

                global.db.run(
                    insertBookingQuery,
                    [
                        eventId,
                        attendeeName,
                        fullPriceQuantity,
                        concessionQuantity,
                        bookingDate
                    ],
                    function (err) {
                        if (err) {
                            next(err);
                        } else {
                            getEventWithAvailability(eventId, function (err, updatedEvent) {
                                if (err) {
                                    next(err);
                                } else {
                                    res.render("attendee-event", {
                                        event: updatedEvent,
                                        eventIsPast: updatedEvent.event_date < getTodayDateString(),
                                        error: null,
                                        success: "Booking successful.",
                                        formData: {
                                            attendee_name: "",
                                            full_price_quantity: 0,
                                            concession_quantity: 0
                                        }
                                    });
                                }
                            });
                        }
                    }
                );
            }
        }
    });
});

module.exports = router;