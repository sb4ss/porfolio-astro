# Contacto y Resend

El formulario usa `POST /api/contact`, un endpoint de servidor del mismo proyecto Astro. La página sigue prerenderizada y el adaptador de Vercel genera la función. No hace falta un backend separado en Railway; esta implementación no despliega un servicio Railway ni expone la clave al frontend.

## Configuración pendiente

Copiar `.env.example` a `.env` y completar `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` (remitente de un dominio verificado) y `CONTACT_TO_EMAIL` (destinatario fijo). No compartir ni versionar la clave. Reiniciar el servidor después de cambiar variables. En Vercel, configurar las mismas variables en el entorno correspondiente y desplegar.

Usar Node 22: `npm run dev` para desarrollo, `npm run build` para compilar y `node --test tests/contact.test.mjs` para pruebas. La previsualización estática no ejecuta el endpoint de Vercel; usar desarrollo local o un despliegue de preview.

## Controles implementados

- Solo POST y JSON; origen igual al sitio, sin CORS abierto. Origin no autentica clientes y puede ser falsificado fuera del navegador.
- Esquema estricto: rechaza campos adicionales, tipos inesperados, email inválido, inyección de cabeceras y caracteres de control.
- Máximo 32 KiB de cuerpo y 5 segundos para leerlo; mensaje de 10 a 5000 caracteres. No se aceptan cuerpos comprimidos.
- Cinco intentos por dirección de cliente en diez minutos por instancia; cuenta también cuerpos inválidos. La tabla tiene capacidad acotada.
- Destinatario y remitente definidos en servidor. El visitante solo establece Reply-To. URL de Resend fija, sin redirección/control del destino desde el formulario.
- Correo de texto plano, sin interpretar HTML o comandos. No hay eval, shell, acceso a archivos ni plantillas ejecutables a partir de campos.
- Mensajes de estado insertados mediante textContent; no se refleja HTML enviado por el usuario en la página.
- Timeout del proveedor, idempotencia para reintentos, errores genéricos sin datos internos. El formulario conserva el texto al fallar y solo muestra éxito si Resend acepta la solicitud.

## Alcance de la verificación

Once pruebas automatizadas con proveedor simulado cubren envío, errores, payloads extraños, HTML/comandos como texto, límites, timeout de lectura y throttling. No equivalen a una auditoría de penetración ni acreditan entrega real de correo. Sin credenciales no se ha realizado un envío real.

El límite en memoria se reinicia y no se comparte entre instancias. Antes de exposición pública con riesgo de spam, configurar limitación persistente/WAF y, si hace falta, verificación de bots. La validación de origen y el honeypot no sustituyen esas medidas. La protección del handler tampoco corrige vulnerabilidades del framework o sus dependencias; su actualización requiere una revisión aparte.

Referencias: https://resend.com/docs/api-reference/emails/send-email y https://docs.astro.build/en/guides/endpoints/.
