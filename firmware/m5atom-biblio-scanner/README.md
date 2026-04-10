# M5 Atom Scanner para Biblioteca

Este firmware conecta un `M5 Atom` con el lector `QR-Code2` al endpoint de SIA para disparar los modales de biblioteca que ya probaste en el dashboard.

## Flujo operativo

- `visita`:
  escaneas la credencial o QR del estudiante y SIA abre el modal de visita.
- `prestamo`:
  escaneas estudiante y libro en cualquier orden; SIA acumula ambos y abre el modal correspondiente.
- `devolucion`:
  igual que prestamo, pero para devolucion.

## Acciones del boton superior

- `1 clic`: cambia de modo `visita -> prestamo -> devolucion`
- `mantener 1.2s`: vuelve al modo `visita`

## Colores

- `azul`: visita
- `amarillo`: prestamo
- `verde`: devolucion
- `rojo`: sin WiFi o error al enviar
- `blanco`: confirmacion corta de cambio de modo de escaneo

## Archivos

- `m5atom-biblio-scanner.ino`: sketch principal
- `config.example.h`: plantilla de configuracion

## Antes de compilar

1. Duplica `config.example.h` como `config.h`
2. Llena:
   - `WIFI_SSID`
   - `WIFI_PASSWORD`
   - `SCANNER_DEVICE_KEY`
3. La clave la tomas de:
   - [functions/.env.sia-tecnm](c:\Users\larr_\Documents\SIA-tecnm-main\functions\.env.sia-tecnm)

## Librerias Arduino

Instala estas librerias en Arduino IDE:

- `M5UnitQRCode`
- `Adafruit NeoPixel`

Y usa una placa compatible con `ESP32 Atom`, normalmente `m5stack-atom`.

## Conexion fisica

### Si usas Atom QRCode Kit clasico con Atom Lite

Ese es el hardware que aparece en tus fotos: el lector QR va montado sobre el Atom Lite y usa `PORT.A` del Atom, no el Grove inferior.

En este sketch:

- `QR_UART_RX_PIN = 19`
- `QR_UART_TX_PIN = 22`

Eso coincide con el pinmap oficial de `Atom QRCode Kit`, donde `UART_RX/UART_TX` del lector quedan conectados a `PORT.A` del Atom Lite. En Atom Lite, `PORT.A` es `G22/G19`.

### Si algun dia usas un Atomic QRCode2 Base con AtomS3R

Ese es otro hardware. Ahi M5Stack documenta `UART_TX=5` y `UART_RX=6`.

### Si algun dia usas un Unit QRCode externo por Grove en Atom Lite

En `PORT.C` normalmente seria:

- `QR_UART_RX_PIN = 26`
- `QR_UART_TX_PIN = 32`

### USB a PC

- El `USB-C` del Atom sirve para programar y tambien para alimentar el equipo.
- En tu casa puedes dejarlo conectado a la PC mientras haces pruebas.
- En biblioteca lo normal es dejarlo con un cargador USB de 5V estable o a una mini PC.

## Prueba rapida

1. Carga el firmware.
2. Abre el monitor serial a `115200`.
3. Verifica que conecte a WiFi.
4. Abre el dashboard de biblioteca.
5. Deja modo `visita` y escanea tu QR.
6. Cambia a `prestamo` y prueba luego con alumno + libro.

## Sobre LoRa

No lo usaria en esta primera fase del lector de biblioteca. Aqui ya tienes WiFi y el payload completo del QR viaja mejor por HTTPS. LoRa te sirve despues para nodos remotos que manden eventos cortos a un gateway.

## Referencias oficiales

- M5Stack documenta `Atom QRCode Kit` con `PORT.A -> UART_RX/UART_TX`: [Atom QRCode Kit](https://docs.m5stack.com/en/atom/ATOM%20QR-CODE%20Kit)
- M5Stack dice que `Atomic QRCode2 Base` con `AtomS3R` usa `UART_TX=5` y `UART_RX=6`: [Atomic QRCode2 Base Arduino Tutorial](https://docs.m5stack.com/en/arduino/projects/atomic/atomic_qrcode2_base)
- M5Stack documenta que en Atom Lite/Matrix el boton programable esta en `GPIO39` y el LED RGB en `GPIO27`: [M5Unified Appendix](https://docs.m5stack.com/en/arduino/m5unified/m5unified_appendix?id=m5.config)
- M5Stack documenta el Grove del Atom con `G26` y `G32`: [Atom Matrix PinMap](https://docs.m5stack.com/en/core/ATOM%20Matrix)
