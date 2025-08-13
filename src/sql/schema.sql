-- Crear base de datos (si no existe)
CREATE DATABASE IF NOT EXISTS railway;
USE railway;

-- Tabla Roles
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rol VARCHAR(50) NOT NULL
);

-- Tabla Usuarios
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(100) NOT NULL UNIQUE,
    contrasena VARCHAR(255) NOT NULL,
    rol_id INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (rol_id) REFERENCES roles(id)
);

-- Tabla Choferes
CREATE TABLE choferes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    dni VARCHAR(20) NOT NULL UNIQUE,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    licencia VARCHAR(100) NOT NULL,
    fecha_vencimiento_licencia DATE NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    usuario_id INT UNIQUE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Tabla Servicios
CREATE TABLE servicios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    requierePruebaHidraulica BOOLEAN NOT NULL,
    requiereVisuales BOOLEAN NOT NULL,
    requiereValvulaYMangueras BOOLEAN NOT NULL,
    observaciones TEXT
);

-- Tabla Tractores
CREATE TABLE tractores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    marca VARCHAR(100) NOT NULL,
    modelo VARCHAR(100) NOT NULL,
    dominio VARCHAR(20) NOT NULL UNIQUE,
    anio INT NOT NULL,
    vencimientoRTO DATE NOT NULL,
    estado VARCHAR(50) NOT NULL,
    tipoServicio VARCHAR(100) NOT NULL,
    alcanceServicio VARCHAR(50) NOT NULL,
    observaciones TEXT
);

-- Tabla Semirremolques
CREATE TABLE semirremolques (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    dominio VARCHAR(20) NOT NULL UNIQUE,
    anio INT NOT NULL,
    estado VARCHAR(50) NOT NULL,
    tipoServicio VARCHAR(100) NOT NULL,
    alcanceServicio VARCHAR(50) NOT NULL,
    vencimientoRTO DATE,
    vencimientoVisualExterna DATE,
    vencimientoVisualInterna DATE,
    vencimientoEspesores DATE,
    vencimientoPruebaHidraulica DATE,
    vencimientoMangueras DATE,
    vencimientoValvulaFlujo DATE,
    observaciones TEXT
);

-- Tabla Viajes
CREATE TABLE viajes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chofer_id INT NOT NULL,
    tractor_id INT NOT NULL,
    semirremolque_id INT NOT NULL,
    servicio_id INT NOT NULL,
    alcance ENUM('nacional', 'internacional') NOT NULL,
    origen VARCHAR(255) NOT NULL,
    cantidad_destinos INT NOT NULL,
    destinos TEXT NOT NULL,
    fecha_salida DATETIME NOT NULL,
    estado ENUM('programado', 'en curso', 'finalizado') NOT NULL,
    FOREIGN KEY (chofer_id) REFERENCES choferes(id),
    FOREIGN KEY (tractor_id) REFERENCES tractores(id),
    FOREIGN KEY (semirremolque_id) REFERENCES semirremolques(id),
    FOREIGN KEY (servicio_id) REFERENCES servicios(id)
);

-- Inserts iniciales de roles
INSERT INTO roles (rol) VALUES 
('admin'),
('chofer');

-- Insert admin
INSERT INTO usuarios (usuario, contrasena, rol_id, activo)
VALUES (
    'admin@rutacontrol.com',
    '$2b$10$Wj5Sg4eLSP7ouWA6AryxKuW/s8drJ7ZCQwiLTwnmtF0zxODRINypC',
    1,
    TRUE
);
