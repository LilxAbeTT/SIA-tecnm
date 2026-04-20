#ifndef BIBLIO_SCANNER_CONFIG_H
#define BIBLIO_SCANNER_CONFIG_H

// Renombra este archivo a config.h antes de compilar.

#define WIFI_SSID "14+"
#define WIFI_PASSWORD "soytuperra"

#define SCANNER_FUNCTION_URL "https://us-central1-sia-tecnm.cloudfunctions.net/ingestScannerEvent"
#define SCANNER_DEVICE_KEY "ej4Ir8pDfgq4422JBxec8BAebNeqfX3BOBd_DohPk6o"

#define SCANNER_MODULE "biblio"
#define SCANNER_STATION_ID "biblio-entrada-1"
#define SCANNER_STATION_NAME "Biblioteca Entrada 1"
#define SCANNER_DEVICE_ID "atom-biblio-entrada-1"
#define SCANNER_DEVICE_TYPE "m5atom_qrcode2"
#define SCANNER_SOURCE "atom_qrcode2"

// Atom Lite / Matrix:
// Yellow = G26, White = G32 en el puerto Grove.
// M5UnitQRCodeUART.begin() recibe los pines en orden (tx, rx).
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
#define BUTTON_DOUBLE_CLICK_MS 350UL

#endif
