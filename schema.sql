DROP TABLE IF EXISTS fingerprints;
-- exclui tabela anterior --
CREATE TABLE fingerprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  -- HASHES REORDENADAS PARA CÁ --
  workerHash TEXT,
  frontHash TEXT,
  captureHash TEXT,
  -------------------------------
  ip TEXT,
  userAgent TEXT,
  country TEXT,
  colo TEXT,
  tlsVersion TEXT,
  tlsCipher TEXT,
  ja3Hash TEXT,
  -- Colunas de front-end
  frontUserAgent TEXT,
  frontLanguage TEXT,
  frontPlatform TEXT,
  frontScreenWidth INTEGER,
  frontScreenHeight INTEGER,
  frontColorDepth INTEGER,
  frontTimezone TEXT,
  frontPlugins TEXT,
  frontCookiesEnabled BOOLEAN,
  frontLocalStorage BOOLEAN,
  frontSessionStorage BOOLEAN,
  frontDoNotTrack BOOLEAN,
  frontHardwareConcurrency INTEGER,
  frontDeviceMemory INTEGER,
  frontFonts TEXT,
  frontWebGLVendor TEXT,
  frontWebGLRenderer TEXT,
  frontWebGLPixelSum REAL,
  frontWebGLShaderSum REAL,
  frontMediaAudio TEXT,
  frontMediaVideo TEXT,
  frontTouchMaxTouchPoints INTEGER,
  frontTouchPointerPrecision INTEGER,
  frontBatteryLevel REAL,
  frontBatteryCharging BOOLEAN,
  frontBatteryChargingTime INTEGER,
  frontBatteryDischargingTime INTEGER,
  frontAudioFingerprint TEXT,
  frontCanvas TEXT

);