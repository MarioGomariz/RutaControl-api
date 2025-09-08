-- Opcional: crea y usa la base
-- CREATE DATABASE IF NOT EXISTS rutacontrol CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
-- USE rutacontrol;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================
-- Tabla: Roles
-- =========================
CREATE TABLE IF NOT EXISTS roles (
  id INT NOT NULL AUTO_INCREMENT,
  rol VARCHAR(50) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Tabla: Usuario
-- =========================
CREATE TABLE IF NOT EXISTS usuario (
  id INT NOT NULL AUTO_INCREMENT,
  usuario VARCHAR(150) NOT NULL,           -- email de login
  contrasena VARCHAR(255) NOT NULL,        -- hash (bcrypt/argon2)
  rol_id INT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario_usuario (usuario),
  KEY idx_usuario_rol_id (rol_id),
  CONSTRAINT fk_usuario_rol
    FOREIGN KEY (rol_id) REFERENCES roles(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Tabla: Chofer
-- =========================
CREATE TABLE IF NOT EXISTS chofer (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  dni VARCHAR(20) NOT NULL,
  telefono VARCHAR(20),
  email VARCHAR(150) NOT NULL,
  licencia VARCHAR(50),
  fecha_vencimiento_licencia DATE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_chofer_dni (dni),
  UNIQUE KEY uq_chofer_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Tabla: Semirremolque
-- =========================
CREATE TABLE IF NOT EXISTS semirremolque (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  dominio VARCHAR(20) NOT NULL,                        -- patente
  anio SMALLINT,
  estado ENUM('disponible','en uso','en reparacion','fuera de servicio') NOT NULL DEFAULT 'disponible',
  tipo_servicio VARCHAR(100),
  alcance_servicio VARCHAR(100),
  vencimiento_rto DATE,
  vencimiento_visual_externa DATE,
  vencimiento_visual_interna DATE,
  vencimiento_espesores DATE,
  vencimiento_prueba_hidraulica DATE,
  vencimiento_mangueras DATE,
  vencimiento_valvula_flujo DATE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_semirremolque_dominio (dominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Tabla: Tractores
-- =========================
CREATE TABLE IF NOT EXISTS tractores (
  id INT NOT NULL AUTO_INCREMENT,
  marca VARCHAR(100) NOT NULL,
  modelo VARCHAR(100) NOT NULL,
  dominio VARCHAR(20) NOT NULL,                        -- patente
  anio SMALLINT,
  vencimiento_rto DATE,
  estado ENUM('disponible','en uso','en reparacion','fuera de servicio') NOT NULL DEFAULT 'disponible',
  tipo_servicio VARCHAR(100),
  alcance_servicio VARCHAR(100),
  PRIMARY KEY (id),
  UNIQUE KEY uq_tractores_dominio (dominio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Tabla: Servicios
-- =========================
CREATE TABLE IF NOT EXISTS servicios (
  id INT NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  requiere_prueba_hidraulica BOOLEAN NOT NULL DEFAULT FALSE,
  requiere_visuales BOOLEAN NOT NULL DEFAULT FALSE,
  requiere_valvula_y_mangueras BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_servicios_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Tabla: Viaje
-- =========================
CREATE TABLE IF NOT EXISTS viaje (
  id INT NOT NULL AUTO_INCREMENT,
  chofer_id INT NOT NULL,
  tractor_id INT NOT NULL,
  semirremolque_id INT NOT NULL,
  servicio_id INT NOT NULL,
  origen VARCHAR(150) NOT NULL,
  cantidad_destinos INT NOT NULL DEFAULT 0,            -- opcional: puede derivarse de Destinos
  fecha_salida DATETIME NOT NULL,
  estado ENUM('programado','en curso','finalizado') NOT NULL DEFAULT 'programado',
  PRIMARY KEY (id),
  KEY idx_viaje_chofer_id (chofer_id),
  KEY idx_viaje_tractor_id (tractor_id),
  KEY idx_viaje_semirremolque_id (semirremolque_id),
  KEY idx_viaje_servicio_id (servicio_id),
  CONSTRAINT fk_viaje_chofer
    FOREIGN KEY (chofer_id) REFERENCES chofer(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_viaje_tractor
    FOREIGN KEY (tractor_id) REFERENCES tractores(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_viaje_semirremolque
    FOREIGN KEY (semirremolque_id) REFERENCES semirremolque(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_viaje_servicio
    FOREIGN KEY (servicio_id) REFERENCES servicios(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- Tabla: Destinos
-- =========================
CREATE TABLE IF NOT EXISTS destinos (
  id INT NOT NULL AUTO_INCREMENT,
  ubicacion VARCHAR(150) NOT NULL,
  viaje_id INT NOT NULL,
  orden INT NOT NULL,                                  -- define la secuencia de paradas
  PRIMARY KEY (id),
  UNIQUE KEY uq_destinos_viaje_orden (viaje_id, orden),
  KEY idx_destinos_viaje_id (viaje_id),
  CONSTRAINT fk_destinos_viaje
    FOREIGN KEY (viaje_id) REFERENCES viaje(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- Datos iniciales
-- =========================

-- Roles (ids explícitos)
INSERT INTO roles (id, rol) VALUES
  (1, 'admin'),
  (2, 'chofer')
ON DUPLICATE KEY UPDATE rol = VALUES(rol);

-- Usuario admin
INSERT INTO usuario (usuario, contrasena, rol_id, activo) VALUES
  ('admin@rutacontrol.com',
   '$10$Wj5Sg4eLSP7ouWA6AryxKuW/s8drJ7ZCQwiLTwnmtF0zxODRINypC',
   1,
   1)
ON DUPLICATE KEY UPDATE
  contrasena = VALUES(contrasena),
  rol_id = VALUES(rol_id),
  activo = VALUES(activo);
