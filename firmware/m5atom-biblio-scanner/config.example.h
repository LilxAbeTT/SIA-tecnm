#ifndef BIBLIO_SCANNER_CONFIG_H
#define BIBLIO_SCANNER_CONFIG_H

// Renombra este archivo a config.h antes de compilar.

#define WIFI_SSID "TU_WIFI"
#define WIFI_PASSWORD "TU_PASSWORD"

#define SCANNER_FUNCTION_URL "https://us-central1-sia-tecnm.cloudfunctions.net/ingestScannerEvent"
#define SCANNER_DEVICE_KEY "PEGA_AQUI_LA_CLAVE_DE_functions/.env.sia-tecnm"

#define SCANNER_MODULE "biblio"
#define SCANNER_STATION_ID "biblio-entrada-1"
#define SCANNER_STATION_NAME "Biblioteca Entrada 1"
#define SCANNER_DEVICE_ID "atom-biblio-entrada-1"
#define SCANNER_DEVICE_TYPE "m5atom_qrcode2"
#define SCANNER_SOURCE "atom_qrcode2"

// Atom QRCode Kit clasico con Atom Lite:
// El pinmap oficial indica que el lector usa PORT.A del Atom Lite.
// En Atom Lite, PORT.A corresponde a G22 (TX del host) y G19 (RX del host).
// No usar GPIO5/GPIO6 en Atom Lite clasico para este kit.
#define QR_UART_RX_PIN 19
#define QR_UART_TX_PIN 22
#define QR_UART_BAUD 115200

// Boton y LED del Atom Lite / Matrix.
#define BUTTON_PIN 39
#define RGB_PIN 27
#define LED_BRIGHTNESS 28

#define WIFI_RETRY_MS 10000UL
#define POST_TIMEOUT_MS 8000UL
#define SCAN_DEDUP_MS 2500UL
#define BUTTON_LONG_PRESS_MS 1200UL
#endif
