-- ============================================================================
--  Ficha Técnica de Vehículos · ESQUEMA de la base de datos (sin datos de ejemplo)
--
--  Lo ejecuta automáticamente la aplicación la primera vez que arranca sobre una
--  base vacía. También sirve para crear la estructura a mano:
--      mysql -u root -p vehiculos_db < pruebasdb/esquema.sql
--  Incluye únicamente los 3 roles base. El usuario administrador lo crea la
--  aplicación (ver README, variable ADMIN_PASSWORD).
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
--  Roles y usuarios
-- ---------------------------------------------------------------------------
CREATE TABLE `rol` (
  `id_rol` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `permisos` varchar(255) DEFAULT 'Vehicles',
  PRIMARY KEY (`id_rol`),
  UNIQUE KEY `uq_rol_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `usuario` (
  `id_usuario` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_usuario` varchar(50) NOT NULL,
  `contrasena` varchar(255) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `apellido` varchar(50) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `id_rol` int(11) NOT NULL,
  `permisos` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `nombre_usuario` (`nombre_usuario`),
  KEY `fk_usuario_rol` (`id_rol`),
  CONSTRAINT `fk_usuario_rol` FOREIGN KEY (`id_rol`) REFERENCES `rol` (`id_rol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
--  Catálogos
-- ---------------------------------------------------------------------------
CREATE TABLE `tipo_vehiculo` (
  `id_tipo` int(11) NOT NULL AUTO_INCREMENT,
  `descripcion` varchar(100) NOT NULL,
  `unidad` varchar(10) NOT NULL DEFAULT 'km',
  PRIMARY KEY (`id_tipo`),
  UNIQUE KEY `uq_tipo_descripcion` (`descripcion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `distritos` (
  `id_distrito` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`id_distrito`),
  UNIQUE KEY `uq_distrito_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `sectores` (
  `id_sector` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`id_sector`),
  UNIQUE KEY `uq_sector_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `operarios` (
  `id_operario` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `estado` varchar(50) DEFAULT 'Activo',
  PRIMARY KEY (`id_operario`),
  UNIQUE KEY `uq_operario_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
--  Vehículos
-- ---------------------------------------------------------------------------
CREATE TABLE `vehiculo` (
  `id_vehiculo` int(11) NOT NULL AUTO_INCREMENT,
  `patente` varchar(20) NOT NULL,
  `legajo` varchar(30) DEFAULT NULL,
  `marca` varchar(50) NOT NULL,
  `modelo` varchar(50) NOT NULL,
  `anio` int(11) NOT NULL,
  `id_tipo` int(11) NOT NULL,
  `num_chasis` varchar(50) DEFAULT NULL,
  `num_motor` varchar(50) DEFAULT NULL,
  `combustible` varchar(30) DEFAULT NULL,
  `transmision` varchar(30) DEFAULT NULL,
  `km_actual` int(11) NOT NULL DEFAULT 0,
  `cedula_numero` varchar(100) DEFAULT NULL,
  `cedula_titular` varchar(150) DEFAULT NULL,
  `seguro_compania` varchar(100) DEFAULT NULL,
  `seguro_vencimiento` date DEFAULT NULL,
  `rto_vencimiento` date DEFAULT NULL,
  `estado_actual` varchar(50) NOT NULL DEFAULT 'Disponible',
  `distrito` varchar(50) DEFAULT NULL,
  `area` varchar(100) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `imagen_url` varchar(255) DEFAULT NULL,
  `fecha_alta` date NOT NULL,
  `fecha_baja` date DEFAULT NULL,
  `foto_cedula` varchar(255) DEFAULT NULL,
  `foto_titulo` varchar(255) DEFAULT NULL,
  `foto_rto` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_vehiculo`),
  UNIQUE KEY `patente` (`patente`),
  UNIQUE KEY `legajo` (`legajo`),
  UNIQUE KEY `uq_vehiculo_chasis` (`num_chasis`),
  UNIQUE KEY `uq_vehiculo_motor` (`num_motor`),
  UNIQUE KEY `uq_vehiculo_cedula` (`cedula_numero`),
  KEY `fk_vehiculo_tipo` (`id_tipo`),
  KEY `idx_vehiculo_estado` (`estado_actual`),
  CONSTRAINT `fk_vehiculo_tipo` FOREIGN KEY (`id_tipo`) REFERENCES `tipo_vehiculo` (`id_tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `historial_km` (
  `id_historial` int(11) NOT NULL AUTO_INCREMENT,
  `id_vehiculo` int(11) NOT NULL,
  `km_anterior` int(11) NOT NULL,
  `km_nuevo` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `observaciones` text DEFAULT NULL,
  PRIMARY KEY (`id_historial`),
  KEY `id_vehiculo` (`id_vehiculo`),
  CONSTRAINT `historial_km_ibfk_1` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculo` (`id_vehiculo`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
--  Choferes
-- ---------------------------------------------------------------------------
CREATE TABLE `chofer` (
  `id_chofer` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `apellido` varchar(50) NOT NULL,
  `dni` varchar(20) NOT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `direccion` varchar(150) DEFAULT NULL,
  `estado` varchar(50) NOT NULL DEFAULT 'Activo',
  `fechaNacimiento` date DEFAULT NULL,
  `fechaIngreso` date DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `turno` varchar(50) DEFAULT NULL,
  `createdAt` datetime DEFAULT NULL,
  `updatedAt` datetime DEFAULT NULL,
  `foto_documento` varchar(255) DEFAULT NULL,
  `imagen` varchar(255) DEFAULT NULL,
  `motivoBaja` text DEFAULT NULL,
  `tiene_carnet_oficial` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id_chofer`),
  UNIQUE KEY `dni` (`dni`),
  UNIQUE KEY `uq_chofer_telefono` (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `licencia_chofer` (
  `id_licencia` int(11) NOT NULL AUTO_INCREMENT,
  `id_chofer` int(11) NOT NULL,
  `numero` varchar(50) NOT NULL,
  `categoria` varchar(20) NOT NULL,
  `fecha_emision` date NOT NULL,
  `fecha_vencimiento` date NOT NULL,
  `imagen` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_licencia`),
  KEY `fk_licencia_chofer` (`id_chofer`),
  CONSTRAINT `fk_licencia_chofer` FOREIGN KEY (`id_chofer`) REFERENCES `chofer` (`id_chofer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `asignacion_vehiculo` (
  `id_asignacion` int(11) NOT NULL AUTO_INCREMENT,
  `id_vehiculo` int(11) NOT NULL,
  `id_chofer` int(11) NOT NULL,
  `fecha_salida` datetime NOT NULL,
  `fecha_estimada_devolucion` datetime DEFAULT NULL,
  `fecha_devolucion` datetime DEFAULT NULL,
  `destino_area` varchar(100) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `estado` varchar(20) NOT NULL DEFAULT 'Activo',
  PRIMARY KEY (`id_asignacion`),
  KEY `idx_asig_vehiculo` (`id_vehiculo`),
  KEY `idx_asig_chofer` (`id_chofer`),
  CONSTRAINT `fk_asig_chofer` FOREIGN KEY (`id_chofer`) REFERENCES `chofer` (`id_chofer`),
  CONSTRAINT `fk_asig_vehiculo` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculo` (`id_vehiculo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
--  Mantenimientos y repuestos
-- ---------------------------------------------------------------------------
CREATE TABLE `repuestos` (
  `id_repuesto` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `stock_minimo` int(11) NOT NULL DEFAULT 3,
  `costo_unitario` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id_repuesto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `mantenimiento` (
  `id_mantenimiento` int(11) NOT NULL AUTO_INCREMENT,
  `id_vehiculo` int(11) NOT NULL,
  `id_usuario` int(11) NOT NULL,
  `tipo_servicio` varchar(100) NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date DEFAULT NULL,
  `km_servicio` int(11) NOT NULL,
  `costo_total` decimal(12,2) DEFAULT 0.00,
  `descripcion` text DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `proximo_km` int(11) DEFAULT NULL,
  `proxima_fecha` date DEFAULT NULL,
  `estado` varchar(20) NOT NULL DEFAULT 'Realizado',
  `mano_obra` decimal(12,2) DEFAULT 0.00,
  `costo_repuestos` decimal(12,2) DEFAULT 0.00,
  `nro_remito` varchar(50) DEFAULT NULL,
  `nro_factura` varchar(50) DEFAULT NULL,
  `proveedor` varchar(150) DEFAULT NULL,
  `nro_pedido` varchar(50) DEFAULT NULL,
  `nro_expediente` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id_mantenimiento`),
  KEY `fk_mant_usuario` (`id_usuario`),
  KEY `idx_mant_vehiculo` (`id_vehiculo`),
  KEY `idx_mant_fecha` (`fecha_inicio`),
  CONSTRAINT `fk_mant_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `fk_mant_vehiculo` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculo` (`id_vehiculo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `detalle_mantenimiento` (
  `id_detalle` int(11) NOT NULL AUTO_INCREMENT,
  `id_mantenimiento` int(11) NOT NULL,
  `id_repuesto` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `costo_unitario` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id_detalle`),
  KEY `fk_det_mant` (`id_mantenimiento`),
  KEY `fk_det_repuesto` (`id_repuesto`),
  CONSTRAINT `fk_det_mant` FOREIGN KEY (`id_mantenimiento`) REFERENCES `mantenimiento` (`id_mantenimiento`),
  CONSTRAINT `fk_det_repuesto` FOREIGN KEY (`id_repuesto`) REFERENCES `repuestos` (`id_repuesto`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
--  Herramientas y préstamos
-- ---------------------------------------------------------------------------
CREATE TABLE `herramienta` (
  `id_herramienta` int(11) NOT NULL AUTO_INCREMENT,
  `codigo_activo` varchar(50) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `sector` varchar(100) DEFAULT NULL,
  `estado` varchar(50) NOT NULL DEFAULT 'Disponible',
  `stock` int(11) NOT NULL DEFAULT 1,
  `combustible_energia` varchar(50) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `imagen_url` varchar(255) DEFAULT NULL,
  `fecha_alta` datetime NOT NULL,
  PRIMARY KEY (`id_herramienta`),
  UNIQUE KEY `codigo_activo` (`codigo_activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `prestamo` (
  `id_prestamo` int(11) NOT NULL AUTO_INCREMENT,
  `id_herramienta` int(11) NOT NULL,
  `nombre_operario` varchar(100) NOT NULL,
  `fecha_salida` datetime NOT NULL,
  `fecha_devolucion_estimada` datetime DEFAULT NULL,
  `fecha_devolucion_real` datetime DEFAULT NULL,
  `sector_destino` varchar(100) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `estado_prestamo` varchar(50) NOT NULL DEFAULT 'Activo',
  PRIMARY KEY (`id_prestamo`),
  KEY `fk_prestamo_herramienta` (`id_herramienta`),
  KEY `idx_prestamo_estado` (`estado_prestamo`),
  CONSTRAINT `fk_prestamo_herramienta` FOREIGN KEY (`id_herramienta`) REFERENCES `herramienta` (`id_herramienta`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
--  Siniestros
-- ---------------------------------------------------------------------------
CREATE TABLE `siniestro` (
  `id_siniestro` int(11) NOT NULL AUTO_INCREMENT,
  `id_vehiculo` int(11) NOT NULL,
  `id_chofer` int(11) DEFAULT NULL,
  `chofer_involucrado` varchar(100) DEFAULT NULL,
  `fecha_siniestro` date NOT NULL,
  `ubicacion` varchar(255) NOT NULL,
  `relato` text DEFAULT NULL,
  `danos_vehiculo` text DEFAULT NULL,
  `tercero_vehiculo` varchar(100) DEFAULT NULL,
  `tercero_seguro` varchar(100) DEFAULT NULL,
  `tercero_conductor` varchar(100) DEFAULT NULL,
  `tercero_contacto` varchar(100) DEFAULT NULL,
  `estado` varchar(50) NOT NULL DEFAULT 'EN PROCESO',
  `archivos_adjuntos` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id_siniestro`),
  KEY `id_vehiculo` (`id_vehiculo`),
  KEY `fk_siniestro_chofer` (`id_chofer`),
  CONSTRAINT `siniestro_ibfk_1` FOREIGN KEY (`id_vehiculo`) REFERENCES `vehiculo` (`id_vehiculo`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `fk_siniestro_chofer` FOREIGN KEY (`id_chofer`) REFERENCES `chofer` (`id_chofer`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
--  Alertas y auditoría
-- ---------------------------------------------------------------------------
CREATE TABLE `documento_adjunto` (
  `id_documento` int(11) NOT NULL AUTO_INCREMENT,
  `entidad` varchar(20) NOT NULL,
  `id_entidad` int(11) NOT NULL,
  `categoria` varchar(40) NOT NULL,
  `archivo` varchar(255) NOT NULL,
  `nombre_original` varchar(255) DEFAULT NULL,
  `id_usuario` int(11) DEFAULT NULL,
  `createdAt` datetime DEFAULT NULL,
  `updatedAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id_documento`),
  KEY `idx_documento_entidad` (`entidad`,`id_entidad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `alerta` (
  `id_alerta` int(11) NOT NULL AUTO_INCREMENT,
  `tipo` enum('licencia_vencida','licencia_proxima','mantenimiento_pendiente','mantenimiento_finalizado','mantenimiento_proximo','mantenimiento_vencido','documentacion_vencida','vehiculo_fuera_servicio','vehiculo_en_mantenimiento','herramienta_devuelta','prestamo_vencido','asignacion_vencida','stock_bajo','siniestro_activo','critica','informativa') NOT NULL,
  `prioridad` enum('alta','media','baja') NOT NULL DEFAULT 'media',
  `mensaje` varchar(255) NOT NULL,
  `entidad_tipo` varchar(50) DEFAULT NULL,
  `entidad_id` int(11) DEFAULT NULL,
  `entidad_nombre` varchar(100) DEFAULT NULL,
  `leida` tinyint(1) NOT NULL DEFAULT 0,
  `generada_automaticamente` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id_alerta`),
  KEY `idx_alerta_entidad` (`entidad_tipo`,`entidad_id`),
  KEY `idx_alerta_leida` (`leida`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `auditoria` (
  `id_auditoria` int(11) NOT NULL AUTO_INCREMENT,
  `id_usuario` int(11) DEFAULT NULL,
  `tabla_afectada` varchar(100) NOT NULL,
  `id_registro_afectado` int(11) DEFAULT NULL,
  `accion` varchar(20) NOT NULL,
  `fecha` date NOT NULL,
  `hora` time NOT NULL,
  `valor_anterior` text DEFAULT NULL,
  `valor_nuevo` text DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  PRIMARY KEY (`id_auditoria`),
  KEY `idx_audit_usuario` (`id_usuario`),
  KEY `idx_audit_fecha` (`fecha`),
  CONSTRAINT `fk_audit_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuario` (`id_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ---------------------------------------------------------------------------
--  Roles base
-- ---------------------------------------------------------------------------
INSERT INTO `rol` (`id_rol`,`nombre`,`descripcion`,`permisos`) VALUES
 (1,'Administrador','Acceso total al sistema','Vehicles,Choferes,Mantenimientos,Tools,Alertas,Reportes,Usuarios,Roles,Auditoria,Siniestros'),
 (2,'Jefe de Taller','Acceso a mantenimientos, repuestos y herramientas','Vehicles,Mantenimientos,Tools,Alertas'),
 (3,'Principal','Acceso de supervisión general y reportes','Vehicles,Choferes,Reportes,Alertas,Siniestros');

SET FOREIGN_KEY_CHECKS = 1;
