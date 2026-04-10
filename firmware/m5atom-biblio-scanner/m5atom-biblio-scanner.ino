#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Adafruit_NeoPixel.h>
#include <M5UnitQRCode.h>

#include "config.h"

enum BusinessMode {
  MODE_VISITA = 0,
  MODE_PRESTAMO = 1,
  MODE_DEVOLUCION = 2
};

struct RgbColor {
  uint8_t r;
  uint8_t g;
  uint8_t b;
};

static const RgbColor COLOR_VISITA = {0, 90, 255};
static const RgbColor COLOR_PRESTAMO = {255, 160, 0};
static const RgbColor COLOR_DEVOLUCION = {0, 180, 90};
static const RgbColor COLOR_OK = {0, 180, 0};
static const RgbColor COLOR_ERROR = {180, 0, 0};
static const RgbColor COLOR_INFO = {180, 180, 180};

Adafruit_NeoPixel rgb(1, RGB_PIN, NEO_GRB + NEO_KHZ800);
M5UnitQRCodeUART qrcode;

BusinessMode currentMode = MODE_VISITA;

bool buttonPressed = false;
bool longPressHandled = false;
unsigned long pressStartedAt = 0;

unsigned long lastWifiAttemptAt = 0;
String lastSentCode;
String lastSentMode;
unsigned long lastSentAt = 0;

String trimText(const String& value) {
  String text = value;
  text.trim();
  return text;
}

const char* modeToApiValue(BusinessMode mode) {
  switch (mode) {
    case MODE_PRESTAMO:
      return "prestamo";
    case MODE_DEVOLUCION:
      return "devolucion";
    case MODE_VISITA:
    default:
      return "visita";
  }
}

RgbColor colorForMode(BusinessMode mode) {
  switch (mode) {
    case MODE_PRESTAMO:
      return COLOR_PRESTAMO;
    case MODE_DEVOLUCION:
      return COLOR_DEVOLUCION;
    case MODE_VISITA:
    default:
      return COLOR_VISITA;
  }
}

void setLed(const RgbColor& color) {
  rgb.setBrightness(LED_BRIGHTNESS);
  rgb.setPixelColor(0, rgb.Color(color.r, color.g, color.b));
  rgb.show();
}

void showBaseLed() {
  if (WiFi.status() == WL_CONNECTED) {
    setLed(colorForMode(currentMode));
    return;
  }
  setLed(COLOR_ERROR);
}

void flashLed(const RgbColor& color, uint8_t times, uint16_t onMs, uint16_t offMs) {
  for (uint8_t i = 0; i < times; i++) {
    setLed(color);
    delay(onMs);
    rgb.clear();
    rgb.show();
    delay(offMs);
  }
  showBaseLed();
}

String escapeJson(const String& input) {
  String output;
  output.reserve(input.length() + 16);
  for (size_t i = 0; i < input.length(); i++) {
    const char c = input.charAt(i);
    switch (c) {
      case '\\':
        output += "\\\\";
        break;
      case '"':
        output += "\\\"";
        break;
      case '\n':
        output += "\\n";
        break;
      case '\r':
        output += "\\r";
        break;
      case '\t':
        output += "\\t";
        break;
      default:
        output += c;
        break;
    }
  }
  return output;
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  const unsigned long now = millis();
  if (lastWifiAttemptAt != 0 && (now - lastWifiAttemptAt) < WIFI_RETRY_MS) return;

  lastWifiAttemptAt = now;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("[WiFi] Connecting...");

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startedAt) < 10000UL) {
    delay(250);
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WiFi] Connected. IP: ");
    Serial.println(WiFi.localIP());
    flashLed(COLOR_OK, 2, 90, 70);
  } else {
    Serial.println("[WiFi] Connection failed.");
    showBaseLed();
  }
}

bool beginScanner() {
  Serial.println("[QR] Initializing...");
  Serial.printf("[QR] Trying TX=%d RX=%d\n", QR_UART_TX_PIN, QR_UART_RX_PIN);
  if (!qrcode.begin(&Serial1, QR_UART_BAUD, QR_UART_TX_PIN, QR_UART_RX_PIN)) {
    if (QR_UART_TX_PIN != QR_UART_RX_PIN) {
      Serial.printf("[QR] Retry TX=%d RX=%d\n", QR_UART_RX_PIN, QR_UART_TX_PIN);
      if (!qrcode.begin(&Serial1, QR_UART_BAUD, QR_UART_RX_PIN, QR_UART_TX_PIN)) {
        Serial.println("[QR] Init failed.");
        return false;
      }
    } else {
      Serial.println("[QR] Init failed.");
      return false;
    }
  }

  Serial.println("[QR] Init success.");

  qrcode.setTriggerMode(AUTO_SCAN_MODE);
  Serial.println("[QR] Auto scan mode.");

  return true;
}

void cycleMode() {
  currentMode = static_cast<BusinessMode>((static_cast<int>(currentMode) + 1) % 3);
  Serial.print("[Mode] ");
  Serial.println(modeToApiValue(currentMode));
  flashLed(colorForMode(currentMode), 2, 120, 80);
}

void resetModeToVisit() {
  currentMode = MODE_VISITA;
  Serial.println("[Mode] visita");
  flashLed(COLOR_VISITA, 3, 100, 60);
}

bool shouldSkipDuplicate(const String& rawCode, const String& mode) {
  const unsigned long now = millis();
  if (rawCode == lastSentCode && mode == lastSentMode && (now - lastSentAt) < SCAN_DEDUP_MS) {
    return true;
  }
  lastSentCode = rawCode;
  lastSentMode = mode;
  lastSentAt = now;
  return false;
}

bool postScan(const String& rawCode) {
  ensureWifi();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[POST] No WiFi.");
    flashLed(COLOR_ERROR, 2, 120, 80);
    return false;
  }

  const String mode = modeToApiValue(currentMode);
  if (shouldSkipDuplicate(rawCode, mode)) {
    Serial.println("[POST] Duplicate ignored.");
    flashLed(COLOR_INFO, 1, 50, 40);
    return true;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, SCANNER_FUNCTION_URL)) {
    Serial.println("[POST] HTTP begin failed.");
    flashLed(COLOR_ERROR, 3, 80, 60);
    return false;
  }

  http.setTimeout(POST_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-SIA-Device-Key", SCANNER_DEVICE_KEY);

  String payload = "{";
  payload += "\"module\":\"" + escapeJson(SCANNER_MODULE) + "\",";
  payload += "\"mode\":\"" + escapeJson(mode) + "\",";
  payload += "\"stationId\":\"" + escapeJson(SCANNER_STATION_ID) + "\",";
  payload += "\"stationName\":\"" + escapeJson(SCANNER_STATION_NAME) + "\",";
  payload += "\"deviceId\":\"" + escapeJson(SCANNER_DEVICE_ID) + "\",";
  payload += "\"deviceType\":\"" + escapeJson(SCANNER_DEVICE_TYPE) + "\",";
  payload += "\"source\":\"" + escapeJson(SCANNER_SOURCE) + "\",";
  payload += "\"format\":\"auto\",";
  payload += "\"rawCode\":\"" + escapeJson(rawCode) + "\"";
  payload += "}";

  Serial.print("[POST] ");
  Serial.println(payload);

  const int status = http.POST(payload);
  const String response = http.getString();
  http.end();

  Serial.print("[POST] Status: ");
  Serial.println(status);
  Serial.print("[POST] Response: ");
  Serial.println(response);

  if (status >= 200 && status < 300) {
    flashLed(COLOR_OK, 1, 160, 60);
    return true;
  }

  flashLed(COLOR_ERROR, 3, 90, 60);
  return false;
}

void handleButton() {
  const bool pressedNow = digitalRead(BUTTON_PIN) == LOW;
  const unsigned long now = millis();

  if (pressedNow && !buttonPressed) {
    buttonPressed = true;
    longPressHandled = false;
    pressStartedAt = now;
  }

  if (pressedNow && buttonPressed && !longPressHandled && (now - pressStartedAt) >= BUTTON_LONG_PRESS_MS) {
    longPressHandled = true;
    resetModeToVisit();
  }

  if (!pressedNow && buttonPressed) {
    buttonPressed = false;
    const unsigned long heldMs = now - pressStartedAt;

    if (!longPressHandled && heldMs < BUTTON_LONG_PRESS_MS) {
      cycleMode();
    }
  }
}

void setup() {
  pinMode(BUTTON_PIN, INPUT);

  rgb.begin();
  rgb.clear();
  rgb.show();

  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("SIA Biblio Scanner Boot");

  ensureWifi();

  while (!beginScanner()) {
    flashLed(COLOR_ERROR, 2, 120, 120);
    delay(800);
  }

  showBaseLed();
}

void loop() {
  ensureWifi();
  handleButton();

  if (qrcode.available()) {
    String rawCode = trimText(qrcode.getDecodeData());
    if (!rawCode.isEmpty()) {
      Serial.print("[QR] ");
      Serial.println(rawCode);
      postScan(rawCode);
    }
  }

  delay(20);
}
