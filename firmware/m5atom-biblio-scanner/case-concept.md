# Concepto de Case 3D

## Medidas base

- `Atom QRCode Kit`: `48 x 24 x 18 mm`
- `Atom-Lite`: `24.0 x 24.0 x 9.5 mm`
- `Powerbank STOLI PWRBNK`: `82.6 x 50.8 mm`
- `Grosor powerbank`: pendiente de confirmar en pieza real

## Propuesta principal

Tipo: `handheld wedge`

- frente angulado para el scanner
- espalda plana para la powerbank
- canal interno corto para cable `USB-A -> USB-C`
- ventilacion lateral y trasera
- acceso al boton superior del Atom
- ventana para `USB-C` del Atom
- ventana para `USB-A` y `micro-USB` de la powerbank

## Dimensiones preliminares del case

Estas dimensiones sirven para mockup inicial, no para impresion final:

- ancho exterior: `56 mm`
- alto exterior: `96 mm`
- grosor exterior estimado: `26 mm`
- pared: `2.0 mm`
- holgura por pieza: `0.6 mm`
- radio esquinas: `6 mm`

## Layout

```text
Vista lateral

   /======================\      <- scanner QR visible, inclinado 12 grados
  /   QRCode + Atom        \
 /__________________________\
 |   canal interno cable    |
 |--------------------------|
 |       powerbank          |
 |                          |
 |__________________________|
```

```text
Vista frontal

  ______________________________
 /                              \
|      [ ventana scanner ]      |
|                                |
|      carcasa limpia/frontal    |
|                                |
|________________________________|
```

```text
Vista trasera

  ______________________________
 /                              \
|   tapa trasera desmontable     |
|                                |
|   [powerbank encajada aqui]    |
|                                |
|  ranuras de ventilacion        |
|________________________________|
```

## Detalles mecanicos

- soporte del scanner con reborde frontal de `1.2 mm`
- pestañas de retencion para la powerbank
- tapa trasera con 2 tornillos `M2` o snap-fit
- canal de cable de `8 x 5 mm`
- salida de cable con curva suave, no a 90 grados
- apertura superior para ver el LED del Atom

## Recomendacion de UX fisica

- color cuerpo: negro mate o gris oscuro
- frente del scanner con bisel amarillo o azul
- icono grabado del modo en un costado
- base ligeramente plana para que pueda descansar sobre escritorio

## Versiones

### V1 fija

- batería integrada y cable oculto
- mejor limpieza visual
- peor mantenimiento

### V2 modular

- scanner en modulo superior
- battery sled trasero desmontable
- mejor mantenimiento
- un poco mas voluminosa

## Recomendacion

Para biblioteca: `V2 modular`.

Razones:

- si la powerbank falla, no rehaces todo
- puedes cambiar cable facilmente
- puedes dejar el scanner igual y cambiar solo alimentacion
- te da mejor acceso a puertos para pruebas y mantenimiento

## Siguiente paso de modelado

Para el STL final faltan estas medidas reales del powerbank:

- grosor total
- altura exacta del bloque de puertos
- ancho del recorte de `USB-A`
- ancho del recorte de `micro-USB`
- distancia del borde a cada puerto
