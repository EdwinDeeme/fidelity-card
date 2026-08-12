# Notas de ejecucion local

## URL correcta

La instancia validada del proyecto corre en:

- http://localhost:3005

## URLs que no debes usar para este proyecto

- http://localhost:3000
  - pertenece a otro proyecto del workspace/maquina
- http://localhost:3001
  - puede quedar una instancia vieja de este proyecto con variables antiguas

## Sintoma tipico

Si abres una instancia vieja, la activacion del dispositivo puede fallar con:
- "No se pudo activar el dispositivo"

Eso ocurre porque esa instancia puede estar conectando a una base distinta o a credenciales viejas.

## Credenciales locales de desarrollo

- Codigo de activacion: SALON-SETUP-2026
- PIN: 1234

## Base de datos local

La base valida de este proyecto corre por Docker en:
- localhost:5433

## Warning de hidratacion

El warning que muestra `cz-shortcut-listen` no viene del proyecto. Lo provoca una extension del navegador que inyecta atributos en el DOM antes de que React hidrate. Se mitigo agregando `suppressHydrationWarning` en el layout raiz.
