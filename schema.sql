DROP TABLE IF EXISTS fingerprints;
CREATE TABLE fingerprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  ip TEXT,
  userAgent TEXT,
  country TEXT,
  colo TEXT,
  tlsVersion TEXT,
  tlsCipher TEXT,
  ja3Hash TEXT NOT NULL,
  fingerprintHash TEXT NOT NULL
);