PRAGMA foreign_keys=ON;

BEGIN TRANSACTION;

DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS organisers;

CREATE TABLE organisers (
    organiser_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE site_settings (
    setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_name TEXT NOT NULL,
    site_description TEXT NOT NULL
);

CREATE TABLE events (
    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_title TEXT NOT NULL,
    event_description TEXT NOT NULL,
    event_date TEXT NOT NULL,

    full_price_ticket_quantity INTEGER NOT NULL DEFAULT 0,
    full_price_ticket_price REAL NOT NULL DEFAULT 0,

    concession_ticket_quantity INTEGER NOT NULL DEFAULT 0,
    concession_ticket_price REAL NOT NULL DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    last_modified_at TEXT,
    published_at TEXT
);

CREATE TABLE bookings (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    attendee_name TEXT NOT NULL,
    full_price_quantity INTEGER NOT NULL DEFAULT 0,
    concession_quantity INTEGER NOT NULL DEFAULT 0,
    booking_date TEXT NOT NULL,

    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE
);

INSERT INTO site_settings (site_name, site_description)
VALUES (
    'Studio Class',
    'Browse, book and manage workout classes in one simple place.'
);

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
    'Sample Draft Class',
    'This is a draft class that can be edited and published by the instructor.',
    '2027-05-01',
    20,
    15.00,
    10,
    8.00,
    'draft',
    datetime('now', '+8 hours'),
    datetime('now', '+8 hours'),
    NULL
);

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
    'Sample Published Class',
    'This is a published workout class that members can view and book.',
    '2027-06-01',
    30,
    20.00,
    15,
    10.00,
    'published',
    datetime('now', '+8 hours'),
    datetime('now', '+8 hours'),
    datetime('now', '+8 hours')
);

COMMIT;