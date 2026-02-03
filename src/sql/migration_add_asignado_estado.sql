-- Migración: Agregar estado 'asignado' a la columna estado de tractores
-- Fecha: 2026-02-03
-- Descripción: Agrega el estado 'asignado' al ENUM de la columna estado en la tabla tractores

USE rutacontrol;

-- Modificar la columna estado para incluir 'asignado'
ALTER TABLE tractores 
MODIFY COLUMN estado ENUM('disponible', 'asignado', 'en uso', 'en reparacion', 'fuera de servicio') 
NOT NULL DEFAULT 'disponible';

-- Verificar el cambio
SELECT COLUMN_NAME, COLUMN_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'rutacontrol' 
  AND TABLE_NAME = 'tractores' 
  AND COLUMN_NAME = 'estado';
