-- ============================================
-- Migración: Arreglar tabla viaje
-- ============================================
-- Este script actualiza la tabla viaje para agregar el campo alcance
-- y renombrar fecha_salida a fecha_hora_salida

USE rutacontrol;

-- Agregar columna alcance si no existe
ALTER TABLE viaje 
ADD COLUMN IF NOT EXISTS alcance ENUM('nacional','internacional') NOT NULL DEFAULT 'nacional' 
AFTER servicio_id;

-- Renombrar fecha_salida a fecha_hora_salida si existe
ALTER TABLE viaje 
CHANGE COLUMN fecha_salida fecha_hora_salida DATETIME NOT NULL;

-- Verificar cambios
DESCRIBE viaje;
