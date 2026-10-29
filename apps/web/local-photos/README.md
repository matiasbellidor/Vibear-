# Tus fotos para la landing

Poné acá las fotos que quieras ver en la landing mientras desarrollás:

- `destacada/`: la foto del centro de la portada (la que se escanea con la animación). Vibear detecta sus prendas
  y ordena tus otras fotos por parecido, así las de alrededor siguen la misma estética
- `mujer/` y `hombre/`: outfits (fotos de cuerpo entero o medio cuerpo)
- `productos/`: prendas sueltas (mejor sobre fondo claro)

Después corré `npm run photos` desde la raíz y `npm run dev`.

**Estas fotos no se suben a GitHub** (la carpeta está en `.gitignore`, salvo este archivo) y la versión publicada de la web usa las fotos con licencia libre. Si traés fotos de Pinterest, quedan solo en tu compu: son de sus autores. Para publicar fotos propias o con permiso, pasalas al generador por defecto (`apps/api/scripts/build_landing_assets.py`).
