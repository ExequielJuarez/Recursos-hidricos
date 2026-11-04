-- ============================================================================
--  Ficha Técnica de Vehículos · DATOS DE EJEMPLO (demo)
--
--  Pensado para probar TODO el sistema. Las fechas son RELATIVAS a "hoy": cada vez
--  que se carga, licencias, RTO, seguros, préstamos y services quedan vencidos,
--  por vencer o vigentes en la misma proporción.
--
--  Qué se puede ver:
--    · Vehículos: en uso, disponibles, en taller, en siniestro y 3 dados de baja;
--      documentación vigente, por vencer (29/20/15/5/3 días), vence hoy y vencida.
--    · Choferes: licencia en buen estado, por vencer (30/12/0 días), vencida,
--      inactivos con motivo y en licencia médica; 4 con vehículo asignado.
--    · Mantenimientos: programados por km, en proceso y realizados (historial de
--      varios años) con repuestos; services cercanos y vencidos por km.
--    · Mantenimientos con datos administrativos (remito, factura, proveedor, pedido,
--      expediente): algunos completos y otros por completar (Historial Administrativo).
--    · Documentación adjunta: comodatos, actas de afectación/entrega/desafectación en
--      vehículos; DNI (frente y dorso) y carnet de la provincia en choferes (los PDF de
--      ejemplo los genera el cargador en uploads/documentos).
--    · Asignaciones sin fecha estimada (se marcan como devueltas a mano).
--    · Herramientas y préstamos: stock parcial y total, vencidos, en reparación, de baja.
--    · Siniestros abiertos, resueltos y cerrados. Auditoría y alertas informativas.
--
--  Se carga sobre una base creada con esquema.sql (o usar pruebasdb/copiaseguridad.sql,
--  que ya incluye todo y recrea la base). Usuarios: admin, carlos_oficina, walter,
--  ExeJuarez, taller_jefe (todos con la contraseña temporal  Ficha2026! ) y
--  ex_empleado (bloqueado).
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Usuarios (contraseña temporal de todos:  Ficha2026! ). `ex_empleado` está bloqueado a propósito.
INSERT INTO `usuario` (`id_usuario`,`nombre_usuario`,`contrasena`,`nombre`,`apellido`,`activo`,`id_rol`,`permisos`) VALUES
 (1,'admin','$2b$10$jM.MTLrReit4A2InHkbQ9eSpc5t/V0GsuXjgrCyNgACwuHmgsdNgu','Administrador','Sistema',1,1,NULL),
 (2,'carlos_oficina','$2b$10$jM.MTLrReit4A2InHkbQ9eSpc5t/V0GsuXjgrCyNgACwuHmgsdNgu','Carlos','Gerez',1,3,'Vehicles,Choferes,Auditoria'),
 (3,'walter','$2b$10$jM.MTLrReit4A2InHkbQ9eSpc5t/V0GsuXjgrCyNgACwuHmgsdNgu','Walter Daniel','Gueleb',1,2,'Choferes,Mantenimientos,Auditoria'),
 (4,'ExeJuarez','$2b$10$jM.MTLrReit4A2InHkbQ9eSpc5t/V0GsuXjgrCyNgACwuHmgsdNgu','Exequiel','Juarez',1,3,'Vehicles,Choferes,Mantenimientos,Alertas,Reportes,Siniestros'),
 (5,'taller_jefe','$2b$10$jM.MTLrReit4A2InHkbQ9eSpc5t/V0GsuXjgrCyNgACwuHmgsdNgu','Marta','Quiroga',1,2,NULL),
 (6,'ex_empleado','$2b$10$jM.MTLrReit4A2InHkbQ9eSpc5t/V0GsuXjgrCyNgACwuHmgsdNgu','Luis','Paredes',0,3,'Vehicles');

-- Catálogos
INSERT INTO `tipo_vehiculo` (`id_tipo`,`descripcion`,`unidad`) VALUES
 (1,'Camioneta','km'),
 (2,'Camión','km'),
 (3,'Maquinaria Pesada','hs'),
 (4,'Utilitario','km'),
 (5,'Auto','km'),
 (6,'Motocicleta','km');

INSERT INTO `distritos` (`id_distrito`,`nombre`) VALUES
 (1,'Centro'),
 (2,'Norte'),
 (3,'Sur'),
 (4,'Este'),
 (5,'Oeste');

INSERT INTO `sectores` (`id_sector`,`nombre`) VALUES
 (1,'Construcción A'),
 (2,'Taller Mecánico'),
 (3,'Espacios Verdes'),
 (4,'Depósito Central'),
 (5,'Mantenimiento General'),
 (6,'Alumbrado Público');

INSERT INTO `operarios` (`id_operario`,`nombre`,`estado`) VALUES
 (1,'Hernán Quiroga','Activo'),
 (2,'Marcos Díaz','Activo'),
 (3,'Gomez Juan','Activo'),
 (4,'Juan Pérez','Activo'),
 (5,'Silvia Torres','Activo'),
 (6,'Andrés Molina','Activo'),
 (7,'Ramón Acuña','Inactivo'),
 (8,'Patricia Vera','Activo');

-- Vehículos: en uso, disponibles, en taller, en siniestro y dados de baja; con documentación vigente, por vencer y vencida
INSERT INTO `vehiculo` (`id_vehiculo`,`patente`,`legajo`,`marca`,`modelo`,`anio`,`id_tipo`,`num_chasis`,`num_motor`,`combustible`,`transmision`,`km_actual`,`cedula_numero`,`cedula_titular`,`seguro_compania`,`seguro_vencimiento`,`rto_vencimiento`,`estado_actual`,`distrito`,`area`,`observaciones`,`imagen_url`,`fecha_alta`,`fecha_baja`,`foto_cedula`,`foto_titulo`,`foto_rto`) VALUES
 (1,'AA001BB',NULL,'Toyota','Hilux',2019,1,'CHS-001','MOT-001','Diésel','Manual',87000,'CED-001','Municipalidad Capital','Federación Patronal',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 300 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 45 DAY),'En uso','Centro',NULL,'En uso por Obras Públicas',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1500 DAY),NULL,'cedula.jpg',NULL,NULL),
 (2,'AB002CC',NULL,'Ford','Ranger',2020,1,'CHS-002','MOT-002','Diésel','Manual',124000,'CED-002','Municipalidad Capital','San Cristóbal',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 120 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 90 DAY),'Baja','Norte',NULL,'Dada de baja por siniestro total',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1400 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 90 DAY),'cedula.jpg',NULL,NULL),
 (3,'AC003DD',NULL,'Volkswagen','Amarok',2021,1,'CHS-003','MOT-003','Diésel','Automática',49200,'CED-003','Municipalidad Capital','La Caja',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 20 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 200 DAY),'Disponible','Sur',NULL,NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1200 DAY),NULL,'cedula.jpg',NULL,NULL),
 (4,'AD004EE',NULL,'Chevrolet','S-10',2018,1,'CHS-004','MOT-004','Diésel','Manual',204100,'CED-004','Municipalidad Capital','Federación Patronal',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 400 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 10 DAY),'Disponible','Centro',NULL,'RTO vencida: gestionar la verificación',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1700 DAY),NULL,'cedula.jpg',NULL,NULL),
 (5,'AE005FF',NULL,'Mercedes-Benz','Tector',2020,2,'CHS-005','MOT-005','Diésel','Manual',315000,'CED-005','Municipalidad Capital','San Cristóbal',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 150 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 260 DAY),'Disponible','Norte',NULL,NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1600 DAY),NULL,'cedula.jpg',NULL,NULL),
 (6,'AF006GG',NULL,'Scania','R410',2019,2,'CHS-006','MOT-006','Diésel','Manual',415000,'CED-006','Municipalidad Capital','Rivadavia Seguros',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 40 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 10 DAY),'En mantenimiento','Sur',NULL,'En taller: cambio de embrague',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1800 DAY),NULL,'cedula.jpg',NULL,NULL),
 (7,'AG007HH',NULL,'Iveco','Tector 170E28',2022,2,'CHS-007','MOT-007','Diésel','Manual',62000,'CED-007','Municipalidad Capital','Zurich',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 220 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 180 DAY),'En uso','Centro',NULL,'Service vencido: pasarlo por taller',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1000 DAY),NULL,'cedula.jpg',NULL,NULL),
 (8,'AH008II',NULL,'Nissan','Frontier',2021,1,'CHS-008','MOT-008','Diésel','Manual',73000,'CED-008','Municipalidad Capital','Mapfre',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 350 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 330 DAY),'En siniestro','Norte',NULL,'Siniestro en proceso',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1100 DAY),NULL,'cedula.jpg',NULL,NULL),
 (9,'AI009JJ',NULL,'Renault','Kangoo',2020,4,'CHS-009','MOT-009','Nafta','Manual',55000,'CED-009','Municipalidad Capital','Sancor Seguros',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 260 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 0 DAY),'Disponible','Sur',NULL,'RTO vence hoy',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1350 DAY),NULL,'cedula.jpg',NULL,NULL),
 (10,'AJ010KK',NULL,'Ford','Transit',2023,4,'CHS-010','MOT-010','Diésel','Manual',18000,'CED-010','Municipalidad Capital','La Segunda',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 300 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY),'Baja','Centro',NULL,'Vendido en subasta',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 900 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY),'cedula.jpg',NULL,NULL),
 (11,'PPKEE2',NULL,'Ford','Ranger',2017,1,'CHS-2323234343','MOT-456421321646',NULL,'Manual',15000,'CED-1234568943','Municipalidad Capital',NULL,NULL,NULL,'Disponible','Centro',NULL,'Sin vencimientos cargados',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 600 DAY),NULL,'cedula.jpg',NULL,NULL),
 (12,'AK011LL',NULL,'Peugeot','Partner',2022,4,'CHS-012','MOT-012','Nafta','Manual',33000,'CED-012','Municipalidad Capital','Mapfre',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 29 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 31 DAY),'Disponible','Este',NULL,'Seguro por vencer; RTO justo fuera del umbral',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 800 DAY),NULL,'cedula.jpg',NULL,NULL),
 (13,'AL012MM',NULL,'Fiat','Cronos',2023,5,'CHS-013','MOT-013','Nafta','Manual',12500,'CED-013','Municipalidad Capital','Sancor Seguros',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 340 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 500 DAY),'En uso','Oeste',NULL,NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 500 DAY),NULL,'cedula.jpg',NULL,NULL),
 (14,'AM013NN',NULL,'Honda','XR150L',2022,6,'CHS-014','MOT-014','Nafta','Manual',9800,'CED-014','Municipalidad Capital','La Caja',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 120 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 90 DAY),'En uso','Centro',NULL,'Moto de inspectores',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 700 DAY),NULL,'cedula.jpg',NULL,NULL),
 (15,'AN014OO',NULL,'Caterpillar','320D',2015,3,'CHS-015','MOT-015','Diésel','Automática',8400,'CED-015','Municipalidad Capital','Zurich',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 15 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 210 DAY),'Disponible','Este',NULL,'Service programado muy próximo',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2800 DAY),NULL,'cedula.jpg',NULL,NULL),
 (16,'AO015PP',NULL,'Mercedes-Benz','Sprinter',2020,4,'CHS-016','MOT-016','Diésel','Manual',98000,'CED-016','Municipalidad Capital','San Cristóbal',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 60 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 45 DAY),'Baja','Oeste',NULL,'Fin de vida útil',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1300 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 30 DAY),'cedula.jpg',NULL,NULL),
 (17,'AP016QQ',NULL,'Toyota','Corolla',2024,5,'CHS-017','MOT-017','Nafta','Automática',3200,'CED-017','Municipalidad Capital','Federación Patronal',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 500 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 700 DAY),'Disponible','Centro',NULL,'Unidad nueva, sin mantenimientos',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY),NULL,'cedula.jpg',NULL,NULL),
 (18,'AQ017RR',NULL,'Ford','F-100',2005,1,'CHS-018','MOT-018','Diésel','Manual',250000,'CED-018','Municipalidad Capital','La Segunda',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 5 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 3 DAY),'Disponible','Sur',NULL,'Seguro y RTO a punto de vencer',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 3000 DAY),NULL,'cedula.jpg',NULL,NULL);

-- Choferes: licencia vigente, por vencer (30/12/0 días), vencida, inactivos y en licencia médica
INSERT INTO `chofer` (`id_chofer`,`nombre`,`apellido`,`dni`,`telefono`,`direccion`,`estado`,`fechaNacimiento`,`fechaIngreso`,`email`,`turno`,`createdAt`,`updatedAt`,`foto_documento`,`imagen`,`motivoBaja`,`tiene_carnet_oficial`) VALUES
 (1,'Carlos','Rodríguez','28111222','3854100001','Av. Libertad 123, Capital','Activo','1985-03-12',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2400 DAY),'carlos@muni.gov','Mañana',(UTC_TIMESTAMP() - INTERVAL 2400 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,1),
 (2,'Sergio','Villalba','30222333','3854100002','San Martín 456, Capital','Activo','1988-07-24',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2000 DAY),'sergio@muni.gov','Tarde',(UTC_TIMESTAMP() - INTERVAL 2000 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,0),
 (3,'Marcelo','Paz','32333444','3854100003','Belgrano 789, Banda','Activo','1990-11-05',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1700 DAY),'marcelo@muni.gov','Mañana',(UTC_TIMESTAMP() - INTERVAL 1700 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,1),
 (4,'Diego','Herrera','25444555','3854100004','Rivadavia 321, Capital','Activo','1982-01-30',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2600 DAY),'diego@muni.gov','Mañana',(UTC_TIMESTAMP() - INTERVAL 2600 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,1),
 (5,'Roberto','Leiva','35555666','3854100005','Sarmiento 654, Banda','Activo','1992-05-18',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1500 DAY),'roberto@muni.gov','Tarde',(UTC_TIMESTAMP() - INTERVAL 1500 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,0),
 (6,'Fernando','Gutiérrez','27666777','3854100006','Tucumán 987, Capital','Activo','1983-09-07',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 3000 DAY),'fernando@muni.gov','Mañana',(UTC_TIMESTAMP() - INTERVAL 3000 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,1),
 (7,'Pablo','Soria','38777888','3854100007','Córdoba 147, Capital','Licencia Vacaciones/Medica','1995-02-14',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1200 DAY),'pablo@muni.gov','Tarde',(UTC_TIMESTAMP() - INTERVAL 1200 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,0),
 (8,'Alejandro','Medina','31888999','3854100008','Mitre 258, Banda','Activo','1987-06-22',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2200 DAY),'alejandro@muni.gov','Mañana',(UTC_TIMESTAMP() - INTERVAL 2200 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,0),
 (9,'Gustavo','Ríos','29999000','3854100009','Independencia 369, Capital','Activo','1984-10-03',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 3300 DAY),'gustavo@muni.gov','Tarde',(UTC_TIMESTAMP() - INTERVAL 3300 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,1),
 (10,'Raúl','Cabrera','33000111','3854100010','Las Heras 741, Capital','Inactivo','1979-12-28',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 4200 DAY),'raul@muni.gov','Mañana',(UTC_TIMESTAMP() - INTERVAL 4200 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,'Baja por jubilación',0),
 (11,'Exequiel','Juarez','39367819','3789173829','mzn a lote 6','Activo','2002-01-01',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 90 DAY),'ejemplo@gmail.com','Tarde/Noche',(UTC_TIMESTAMP() - INTERVAL 90 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,0),
 (12,'Lucía','Fernández','36111222','3854100012','Catamarca 55, Capital','Activo','1991-04-09',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 800 DAY),'lucia@muni.gov','Mañana',(UTC_TIMESTAMP() - INTERVAL 800 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,1),
 (13,'Martín','Acosta','34222333','3854100013','Salta 920, Banda','Activo','1989-08-15',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1900 DAY),'martin@muni.gov','Tarde/Noche',(UTC_TIMESTAMP() - INTERVAL 1900 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,1),
 (14,'Valeria','Núñez','37333444','3854100014','Jujuy 410, Capital','Activo','1994-12-02',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 700 DAY),'valeria@muni.gov','Mañana',(UTC_TIMESTAMP() - INTERVAL 700 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,0),
 (15,'Hugo','Benítez','26444555','3854100015','Alsina 88, Capital','Inactivo','1981-02-27',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 3600 DAY),'hugo@muni.gov','Noche',(UTC_TIMESTAMP() - INTERVAL 3600 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,'Renuncia',0),
 (16,'Natalia','Ibarra','38444555','3854100016','Chacabuco 301, Banda','Activo','1996-06-30',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 400 DAY),'natalia@muni.gov','Mañana',(UTC_TIMESTAMP() - INTERVAL 400 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 1 DAY - INTERVAL 0 HOUR),NULL,NULL,NULL,0);

INSERT INTO `licencia_chofer` (`id_licencia`,`id_chofer`,`numero`,`categoria`,`fecha_emision`,`fecha_vencimiento`,`imagen`) VALUES
 (1,1,'LIC-00001','C',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 925 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 900 DAY),'licencia.jpg'),
 (2,2,'LIC-00002','B2',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1845 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 20 DAY),'licencia.jpg'),
 (3,3,'LIC-00003','C',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1813 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 12 DAY),'licencia.jpg'),
 (4,4,'LIC-00004','C',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1425 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 400 DAY),'licencia.jpg'),
 (5,5,'LIC-00005','B1',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2025 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY),'licencia.jpg'),
 (6,6,'LIC-00006','C',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1795 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 30 DAY),'licencia.jpg'),
 (7,7,'LIC-00007','B2',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1725 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 100 DAY),'licencia.jpg'),
 (8,8,'LIC-00008','C',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1794 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 31 DAY),'licencia.jpg'),
 (9,9,'LIC-00009','B1',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1575 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 250 DAY),'licencia.jpg'),
 (10,10,'LIC-00010','C',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2225 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 400 DAY),'licencia.jpg'),
 (11,11,'LIC-37283293','B2',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 25 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 1800 DAY),'licencia.jpg'),
 (12,12,'LIC-00012','B1',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1825 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 0 DAY),'licencia.jpg'),
 (13,13,'LIC-00013','E',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1765 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 60 DAY),'licencia.jpg'),
 (14,14,'LIC-00014','A',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1325 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 500 DAY),'licencia.jpg'),
 (15,15,'LIC-00015','D',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1525 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 300 DAY),'licencia.jpg'),
 (16,16,'LIC-00016','B1',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1125 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 700 DAY),'licencia.jpg');

-- Asignaciones (4 activas, sin fecha estimada: se marcan como devueltas a mano, y un historial finalizado)
INSERT INTO `asignacion_vehiculo` (`id_asignacion`,`id_vehiculo`,`id_chofer`,`fecha_salida`,`fecha_estimada_devolucion`,`fecha_devolucion`,`destino_area`,`observaciones`,`estado`) VALUES
 (1,1,1,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 3 DAY + INTERVAL 3 HOUR),NULL,NULL,'Norte','Sale en buenas condiciones','Activo'),
 (2,7,4,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2 DAY + INTERVAL 3 HOUR),NULL,NULL,'Centro','Traslado de materiales','Activo'),
 (3,13,9,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 10 DAY + INTERVAL 3 HOUR),NULL,NULL,'Oeste','Lleva 10 días asignada: pendiente de marcar como devuelta','Activo'),
 (4,14,14,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1 DAY + INTERVAL 3 HOUR),NULL,NULL,'Centro','Recorrida de inspecciones','Activo'),
 (5,5,5,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 70 DAY + INTERVAL 3 HOUR),NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 61 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Norte','Traslado de materiales','Finalizado'),
 (6,3,8,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 45 DAY + INTERVAL 3 HOUR),NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 41 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Sur','Comisión inter-distrital','Finalizado'),
 (7,1,3,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 120 DAY + INTERVAL 3 HOUR),NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 112 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Este','Obra vial','Finalizado'),
 (8,4,2,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 150 DAY + INTERVAL 3 HOUR),NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 139 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Centro','Relevamiento','Finalizado'),
 (9,9,16,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 30 DAY + INTERVAL 3 HOUR),NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 26 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Sur','Reparto de insumos','Finalizado'),
 (10,12,6,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 20 DAY + INTERVAL 3 HOUR),NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 15 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Este','Visita a escuelas','Finalizado');

-- Repuestos (hay uno sin stock y varios con stock bajo)
INSERT INTO `repuestos` (`id_repuesto`,`nombre`,`stock`,`stock_minimo`,`costo_unitario`) VALUES
 (1,'Filtro de Aceite (Universal)',14,3,6500),
 (2,'Aceite Sintético 10W40 (1 Litro)',30,3,8000),
 (3,'Pastillas de Freno (Juego Trasero)',8,3,28000),
 (4,'Filtro de Aire',13,3,15000),
 (5,'Pastillas de Freno (Estándar)',12,3,8000),
 (6,'Filtro de Aceite (Camioneta)',22,3,8500),
 (7,'Filtro de Aire (Camión)',12,3,14000),
 (8,'Filtro de Combustible (Diesel)',16,3,11500),
 (9,'Aceite Motor 15W40 (Tambor 20L)',8,4,85000),
 (10,'Aceite Sintético 5W30 (1L)',35,3,9500),
 (11,'Pastillas de Freno (Juego Delantero)',8,3,35000),
 (12,'Batería 12V 75Ah',5,5,120000),
 (13,'Amortiguador Delantero (Par)',3,3,185000),
 (14,'Bomba de Agua (Diesel)',6,3,75000),
 (15,'Kit de Embrague Completo',0,3,320000),
 (16,'Óptica Trasera Izquierda',15,3,45000),
 (17,'Espejo Retrovisor Derecho',10,3,38000),
 (18,'Cruceta de Cardán',22,3,18000),
 (19,'Inyector Common Rail',8,3,150000),
 (20,'Filtro de Habitáculo',40,3,6500),
 (21,'Correa Poly-V',2,3,22000),
 (22,'Bomba de Freno',5,3,85000);

-- Mantenimientos (programados, en proceso y realizados) con sus repuestos y datos administrativos (algunos por completar)
INSERT INTO `mantenimiento` (`id_mantenimiento`,`id_vehiculo`,`id_usuario`,`tipo_servicio`,`fecha_inicio`,`fecha_fin`,`km_servicio`,`costo_total`,`descripcion`,`observaciones`,`proximo_km`,`proxima_fecha`,`estado`,`mano_obra`,`costo_repuestos`,`nro_remito`,`nro_factura`,`proveedor`,`nro_pedido`,`nro_expediente`) VALUES
 (1,1,1,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 300 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 300 DAY),70000,86500,'Cambio de aceite y filtro','Aceite en mal estado',78000,NULL,'Realizado',40000,46500,'0001-00004510','A-0003-00011201','Lubricentro del Centro S.A.','PED-2025-031','EXP-4012-221/2025'),
 (2,1,1,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY),78000,86500,'Cambio de aceite y filtro',NULL,85000,NULL,'Realizado',40000,46500,'0001-00004877','A-0003-00011988','Lubricentro del Centro S.A.','PED-2025-058','EXP-4012-398/2025'),
 (3,1,3,'Frenos',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 120 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 119 DAY),83000,65000,'Cambio de pastillas delanteras','Discos con desgaste leve',NULL,NULL,'Realizado',30000,35000,'0007-00001203','B-0001-00000977','Frenos y Suspensiones Norte','PED-2026-004',NULL),
 (4,1,3,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 40 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 40 DAY),85500,86500,'Cambio de aceite y filtro',NULL,95000,NULL,'Realizado',40000,46500,'0001-00005302',NULL,'Lubricentro del Centro S.A.','PED-2026-019',NULL),
 (5,3,1,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 90 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 90 DAY),45000,81500,'Service de los 45.000 km',NULL,55000,NULL,'Realizado',35000,46500,'0003-00020045','A-0002-00045123','Repuestos del Sur S.R.L.','PED-2026-007','EXP-4012-088/2026'),
 (6,3,1,'Service 50.000 km',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 0 DAY),NULL,50000,0,'Service programado a los 50000 km',NULL,50000,NULL,'Programado',0,0,NULL,NULL,NULL,NULL,NULL),
 (7,4,1,'Cambio de filtros',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 250 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 250 DAY),190000,56500,'Filtros de aire y combustible',NULL,198000,NULL,'Realizado',30000,26500,'0003-00018830','A-0002-00043210','Repuestos del Sur S.R.L.','PED-2025-044','EXP-4012-301/2025'),
 (8,4,3,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 100 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 100 DAY),198000,86500,'Cambio de aceite y filtro','Próximo service a los 205.000 km',205000,NULL,'Realizado',40000,46500,NULL,NULL,NULL,NULL,NULL),
 (9,5,1,'Suspensión',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 60 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 58 DAY),312000,245000,'Reemplazo de amortiguadores delanteros',NULL,NULL,NULL,'Realizado',60000,185000,'0010-00000456','A-0005-00001234','Suspensiones Tucumán',NULL,NULL),
 (10,5,3,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 330 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 330 DAY),295000,149000,'Cambio de aceite y filtros',NULL,310000,NULL,'Realizado',50000,99000,NULL,NULL,NULL,NULL,NULL),
 (11,6,1,'Cambio de embrague',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 5 DAY),NULL,415000,410000,'Reemplazo de kit de embrague completo','Vehículo en taller',NULL,NULL,'En proceso',90000,320000,NULL,NULL,NULL,NULL,NULL),
 (12,6,3,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 400 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 400 DAY),390000,154000,'Cambio de aceite y filtros',NULL,405000,NULL,'Realizado',55000,99000,NULL,NULL,NULL,NULL,NULL),
 (13,7,1,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 180 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 180 DAY),52000,86500,'Cambio de aceite y filtro','Próximo service a los 60.000 km',60000,NULL,'Realizado',40000,46500,NULL,NULL,NULL,NULL,NULL),
 (14,8,3,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 20 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 20 DAY),72000,86500,'Cambio de aceite y filtro',NULL,82000,NULL,'Realizado',40000,46500,NULL,NULL,NULL,NULL,NULL),
 (15,9,1,'Batería',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 500 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 500 DAY),40000,135000,'Reemplazo de batería',NULL,NULL,NULL,'Realizado',15000,120000,NULL,NULL,NULL,NULL,NULL),
 (16,15,1,'Service 9.000 hs/km',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 0 DAY),NULL,9000,0,'Service programado a los 9000 km',NULL,9000,NULL,'Programado',0,0,NULL,NULL,NULL,NULL,NULL),
 (17,16,1,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY),96000,86500,'Último service antes de la baja',NULL,105000,NULL,'Realizado',40000,46500,NULL,NULL,NULL,NULL,NULL),
 (18,2,1,'Frenos',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 400 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 399 DAY),110000,136000,'Cambio de pastillas y bomba de freno',NULL,NULL,NULL,'Realizado',35000,101000,NULL,NULL,NULL,NULL,NULL),
 (19,12,3,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 60 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 60 DAY),30000,73500,'Service de los 30.000 km',NULL,40000,NULL,'Realizado',35000,38500,NULL,NULL,NULL,NULL,NULL),
 (20,18,1,'Cambio de aceite',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 30 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 30 DAY),249000,86500,'Cambio de aceite y filtro','Próximo service a los 255.000 km',255000,NULL,'Realizado',40000,46500,NULL,NULL,NULL,NULL,NULL),
 (21,13,3,'Revisión de garantía',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 150 DAY),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 150 DAY),5000,0,'Revisión de garantía de concesionaria',NULL,15000,NULL,'Realizado',0,0,NULL,NULL,NULL,NULL,NULL),
 (22,14,1,'Service 10.000 km',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 20 DAY),NULL,10000,0,'Service programado a los 10000 km','Cancelado manualmente.',10000,NULL,'Cancelado',0,0,NULL,NULL,NULL,NULL,NULL);

INSERT INTO `detalle_mantenimiento` (`id_detalle`,`id_mantenimiento`,`id_repuesto`,`cantidad`,`costo_unitario`) VALUES
 (1,1,6,1,8500),
 (2,1,10,4,9500),
 (3,2,6,1,8500),
 (4,2,10,4,9500),
 (5,3,11,1,35000),
 (6,4,6,1,8500),
 (7,4,10,4,9500),
 (8,5,6,1,8500),
 (9,5,10,4,9500),
 (10,7,4,1,15000),
 (11,7,8,1,11500),
 (12,8,6,1,8500),
 (13,8,10,4,9500),
 (14,9,13,1,185000),
 (15,10,9,1,85000),
 (16,10,7,1,14000),
 (17,11,15,1,320000),
 (18,12,9,1,85000),
 (19,12,7,1,14000),
 (20,13,6,1,8500),
 (21,13,10,4,9500),
 (22,14,6,1,8500),
 (23,14,10,4,9500),
 (24,15,12,1,120000),
 (25,17,1,1,6500),
 (26,17,2,5,8000),
 (27,18,5,2,8000),
 (28,18,22,1,85000),
 (29,19,1,1,6500),
 (30,19,2,4,8000),
 (31,20,1,1,6500),
 (32,20,2,5,8000);

-- Historial de kilometraje (siempre creciente; el último valor coincide con el km actual del vehículo)
INSERT INTO `historial_km` (`id_historial`,`id_vehiculo`,`km_anterior`,`km_nuevo`,`fecha`,`observaciones`) VALUES
 (1,1,62000,70000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 300 DAY),'Actualización de kilometraje'),
 (2,1,70000,78000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY),'Actualización de kilometraje'),
 (3,1,78000,83000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 120 DAY),'Actualización de kilometraje'),
 (4,1,83000,85500,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 40 DAY),'Actualización de kilometraje'),
 (5,1,85500,87000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 3 DAY),'Actualización de kilometraje'),
 (6,2,98000,110000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 400 DAY),'Actualización de kilometraje'),
 (7,2,110000,118000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 300 DAY),'Actualización de kilometraje'),
 (8,2,118000,124000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 92 DAY),'Actualización de kilometraje'),
 (9,3,38000,45000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 90 DAY),'Actualización de kilometraje'),
 (10,3,45000,47500,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 41 DAY),'Actualización de kilometraje'),
 (11,3,47500,49200,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 5 DAY),'Actualización de kilometraje'),
 (12,4,186000,190000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 250 DAY),'Actualización de kilometraje'),
 (13,4,190000,198000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 100 DAY),'Actualización de kilometraje'),
 (14,4,198000,204100,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 15 DAY),'Actualización de kilometraje'),
 (15,5,280000,295000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 330 DAY),'Actualización de kilometraje'),
 (16,5,295000,312000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 61 DAY),'Actualización de kilometraje'),
 (17,5,312000,315000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 30 DAY),'Actualización de kilometraje'),
 (18,6,380000,390000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 400 DAY),'Actualización de kilometraje'),
 (19,6,390000,415000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 5 DAY),'Actualización de kilometraje'),
 (20,7,41000,52000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 180 DAY),'Actualización de kilometraje'),
 (21,7,52000,62000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2 DAY),'Actualización de kilometraje'),
 (22,8,60000,72000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 20 DAY),'Actualización de kilometraje'),
 (23,8,72000,73000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 7 DAY),'Actualización de kilometraje'),
 (24,9,35000,40000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 500 DAY),'Actualización de kilometraje'),
 (25,9,40000,55000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 26 DAY),'Actualización de kilometraje'),
 (26,12,18000,30000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 60 DAY),'Actualización de kilometraje'),
 (27,12,30000,33000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 15 DAY),'Actualización de kilometraje'),
 (28,13,5000,12500,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 10 DAY),'Actualización de kilometraje'),
 (29,14,7000,9800,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1 DAY),'Actualización de kilometraje'),
 (30,15,7000,8400,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 10 DAY),'Actualización de kilometraje'),
 (31,16,85000,96000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY),'Actualización de kilometraje'),
 (32,16,96000,98000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 31 DAY),'Actualización de kilometraje'),
 (33,18,240000,249000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 30 DAY),'Actualización de kilometraje'),
 (34,18,249000,250000,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 4 DAY),'Actualización de kilometraje');

-- Herramientas: disponibles, en uso (total y parcial), en reparación y de baja
INSERT INTO `herramienta` (`id_herramienta`,`codigo_activo`,`nombre`,`sector`,`estado`,`stock`,`combustible_energia`,`observaciones`,`imagen_url`,`fecha_alta`) VALUES
 (1,'HTI-001','Amoladora Angular Bosch 4.5"','Taller Mecánico','Disponible',3,'Energía',NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 900 DAY + INTERVAL 3 HOUR)),
 (2,'HTI-002','Amoladora','Construcción A','Disponible',2,'Energía','Se encuentran en buen estado',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 700 DAY + INTERVAL 3 HOUR)),
 (3,'HTI-003','Destornillador percutor','Taller Mecánico','En uso',1,'Energía','Préstamo vencido: reclamar devolución',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 650 DAY + INTERVAL 3 HOUR)),
 (4,'HTI-004','Gato Hidráulico 20T','Depósito Central','Disponible',4,NULL,NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 900 DAY + INTERVAL 3 HOUR)),
 (5,'HTI-005','Caja de Tubos Mando 1/2 (Juego)','Mantenimiento General','Disponible',5,NULL,NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 880 DAY + INTERVAL 3 HOUR)),
 (6,'HTI-006','Soldadora Inverter 200A','Taller Mecánico','En uso',2,'Energía','Las dos unidades están afuera',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 600 DAY + INTERVAL 3 HOUR)),
 (7,'HTI-007','Hidrolavadora Industrial 150 Bar','Mantenimiento General','En Reparación',1,'Energía','Falla la bomba',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 800 DAY + INTERVAL 3 HOUR)),
 (8,'HTI-008','Compresor de Aire 50L','Taller Mecánico','Disponible',3,'Energía',NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 750 DAY + INTERVAL 3 HOUR)),
 (9,'HTI-009','Sierra Circular 7 1/4"','Construcción A','Disponible',2,'Energía',NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 500 DAY + INTERVAL 3 HOUR)),
 (10,'HTI-010','Llave Dinamométrica 1/2"','Taller Mecánico','Disponible',4,NULL,NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 820 DAY + INTERVAL 3 HOUR)),
 (11,'HTI-011','Cortadora de Césped Naftera','Espacios Verdes','Disponible',3,'Nafta','Una unidad en préstamo, quedan 2',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 400 DAY + INTERVAL 3 HOUR)),
 (12,'HTI-012','Motosierra Stihl MS170','Espacios Verdes','En Reparación',3,'Nafta','Enviadas a service oficial',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 380 DAY + INTERVAL 3 HOUR)),
 (13,'HTI-013','Taladro de Banco 16mm','Taller Mecánico','Disponible',1,'Energía',NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 950 DAY + INTERVAL 3 HOUR)),
 (14,'HTI-014','Hormigonera 130L','Construcción A','Baja',1,'Energía','Motor fundido, dada de baja',NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 1500 DAY + INTERVAL 3 HOUR)),
 (15,'HTI-015','Escalera de Aluminio 12 Escalones','Mantenimiento General','Disponible',6,NULL,NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 300 DAY + INTERVAL 3 HOUR)),
 (16,'HTI-016','Grupo Electrógeno 5 kVA','Alumbrado Público','Disponible',1,'Nafta',NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 200 DAY + INTERVAL 3 HOUR)),
 (17,'HTI-017','Desmalezadora a nafta','Espacios Verdes','Disponible',2,'Nafta',NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 250 DAY + INTERVAL 3 HOUR));

-- Préstamos: en plazo, vencidos y devueltos
INSERT INTO `prestamo` (`id_prestamo`,`id_herramienta`,`nombre_operario`,`fecha_salida`,`fecha_devolucion_estimada`,`fecha_devolucion_real`,`sector_destino`,`observaciones`,`estado_prestamo`) VALUES
 (1,2,'Gomez Juan',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 120 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 110 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 111 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Espacios Verdes','Devuelta sin novedades','Finalizado'),
 (2,2,'Juan Pérez',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 100 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 90 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 92 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Taller Mecánico',NULL,'Finalizado'),
 (3,3,'Gomez Juan',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 40 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 30 DAY + INTERVAL 3 HOUR),NULL,'Construcción A','Entregado con juego de brocas','Activo'),
 (4,6,'Marcos Díaz',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 5 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 10 DAY + INTERVAL 3 HOUR),NULL,'Taller Mecánico',NULL,'Activo'),
 (5,6,'Silvia Torres',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 3 DAY + INTERVAL 3 HOUR),NULL,'Construcción A','Con cables y máscara','Activo'),
 (6,11,'Hernán Quiroga',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 8 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2 DAY + INTERVAL 3 HOUR),NULL,'Espacios Verdes','Préstamo vencido hace 2 días','Activo'),
 (7,17,'Andrés Molina',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 3 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 4 DAY + INTERVAL 3 HOUR),NULL,'Espacios Verdes',NULL,'Activo'),
 (8,1,'Patricia Vera',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 60 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 50 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 49 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Mantenimiento General',NULL,'Finalizado'),
 (9,4,'Marcos Díaz',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 15 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 10 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 9 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Depósito Central',NULL,'Finalizado'),
 (10,8,'Silvia Torres',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 25 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 20 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 18 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Taller Mecánico','Devuelto con 2 días de demora','Finalizado'),
 (11,15,'Andrés Molina',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 12 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 5 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 6 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Alumbrado Público',NULL,'Finalizado'),
 (12,9,'Hernán Quiroga',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 90 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 80 DAY + INTERVAL 3 HOUR),(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 81 DAY + INTERVAL 3 HOUR + INTERVAL 14 HOUR),'Construcción A',NULL,'Finalizado');

-- Siniestros: uno en proceso (vehículo en siniestro), resueltos y cerrados; con y sin chofer identificado
INSERT INTO `siniestro` (`id_siniestro`,`id_vehiculo`,`id_chofer`,`chofer_involucrado`,`fecha_siniestro`,`ubicacion`,`relato`,`danos_vehiculo`,`tercero_vehiculo`,`tercero_seguro`,`tercero_conductor`,`tercero_contacto`,`estado`,`archivos_adjuntos`,`createdAt`,`updatedAt`) VALUES
 (1,8,8,'Alejandro Medina',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 6 DAY),'Ruta 9 km 1040','Colisión trasera en semáforo.','Paragolpes y baúl','Fiat Palio','La Segunda','Juan Gómez','3855111222','EN PROCESO','',(UTC_TIMESTAMP() - INTERVAL 6 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 6 DAY - INTERVAL 0 HOUR)),
 (2,2,5,'Roberto Leiva',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 100 DAY),'Av. Belgrano y Sarmiento','Impacto frontal, pérdida total.','Frente completo y motor','Chevrolet Onix','Sancor Seguros','María Paz','3854333444','RESUELTO','',(UTC_TIMESTAMP() - INTERVAL 100 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 100 DAY - INTERVAL 0 HOUR)),
 (3,1,3,'Marcelo Paz',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 250 DAY),'Calle Mitre 400','Roce lateral al estacionar.','Espejo y puerta derecha',NULL,NULL,NULL,NULL,'CERRADO','',(UTC_TIMESTAMP() - INTERVAL 250 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 250 DAY - INTERVAL 0 HOUR)),
 (4,4,NULL,NULL,(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 60 DAY),'Playa de maniobras municipal','Daño encontrado al devolver la unidad; no se identificó al responsable.','Faro izquierdo',NULL,NULL,NULL,NULL,'RESUELTO','',(UTC_TIMESTAMP() - INTERVAL 60 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 60 DAY - INTERVAL 0 HOUR)),
 (5,10,2,'Sergio Villalba',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 220 DAY),'Ruta 34 km 12','Vuelco sin heridos por pérdida de tracción.','Carrocería',NULL,NULL,NULL,NULL,'RESUELTO','',(UTC_TIMESTAMP() - INTERVAL 220 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 220 DAY - INTERVAL 0 HOUR));

-- Documentación adjunta (comodatos, actas, DNI y carnet de la provincia)
INSERT INTO `documento_adjunto` (`id_documento`,`entidad`,`id_entidad`,`categoria`,`archivo`,`nombre_original`,`id_usuario`,`createdAt`,`updatedAt`) VALUES
 (1,'vehiculo',1,'comodato','demo-vehiculo-1-comodato-1.pdf','Comodato AA001BB.pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (2,'vehiculo',1,'acta_afectacion','demo-vehiculo-1-acta_afectacion-1.pdf','Acta de afectación AA001BB.pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (3,'vehiculo',1,'acta_entrega','demo-vehiculo-1-acta_entrega-1.pdf','Acta de entrega AA001BB.pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (4,'vehiculo',3,'acta_afectacion','demo-vehiculo-3-acta_afectacion-1.pdf','Acta de afectación AC003DD.pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (5,'vehiculo',3,'acta_entrega','demo-vehiculo-3-acta_entrega-1.pdf','Acta de entrega AC003DD.pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (6,'vehiculo',4,'acta_desafectacion','demo-vehiculo-4-acta_desafectacion-1.pdf','Acta de desafectación temporal AD004EE.pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (7,'vehiculo',5,'comodato','demo-vehiculo-5-comodato-1.pdf','Comodato AE005FF.pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (8,'vehiculo',7,'acta_afectacion','demo-vehiculo-7-acta_afectacion-1.pdf','Acta de afectación AG007HH.pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (9,'vehiculo',12,'comodato','demo-vehiculo-12-comodato-1.pdf','Comodato AK011LL.pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (10,'vehiculo',12,'acta_entrega','demo-vehiculo-12-acta_entrega-1.pdf','Acta de entrega AK011LL.pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (11,'chofer',1,'dni','demo-chofer-1-dni-1.pdf','DNI Carlos Rodríguez (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (12,'chofer',1,'dni','demo-chofer-1-dni-2.pdf','DNI Carlos Rodríguez (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (13,'chofer',1,'carnet_provincia','demo-chofer-1-carnet_provincia-1.pdf','Carnet provincia Carlos Rodríguez (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (14,'chofer',1,'carnet_provincia','demo-chofer-1-carnet_provincia-2.pdf','Carnet provincia Carlos Rodríguez (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (15,'chofer',2,'dni','demo-chofer-2-dni-1.pdf','DNI Sergio Villalba (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (16,'chofer',2,'dni','demo-chofer-2-dni-2.pdf','DNI Sergio Villalba (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (17,'chofer',3,'dni','demo-chofer-3-dni-1.pdf','DNI Marcelo Paz (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (18,'chofer',3,'dni','demo-chofer-3-dni-2.pdf','DNI Marcelo Paz (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (19,'chofer',3,'carnet_provincia','demo-chofer-3-carnet_provincia-1.pdf','Carnet provincia Marcelo Paz (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (20,'chofer',3,'carnet_provincia','demo-chofer-3-carnet_provincia-2.pdf','Carnet provincia Marcelo Paz (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (21,'chofer',4,'dni','demo-chofer-4-dni-1.pdf','DNI Diego Herrera (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (22,'chofer',4,'dni','demo-chofer-4-dni-2.pdf','DNI Diego Herrera (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (23,'chofer',4,'carnet_provincia','demo-chofer-4-carnet_provincia-1.pdf','Carnet provincia Diego Herrera (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (24,'chofer',4,'carnet_provincia','demo-chofer-4-carnet_provincia-2.pdf','Carnet provincia Diego Herrera (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (25,'chofer',5,'dni','demo-chofer-5-dni-1.pdf','DNI Roberto Leiva (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (26,'chofer',5,'dni','demo-chofer-5-dni-2.pdf','DNI Roberto Leiva (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (27,'chofer',6,'dni','demo-chofer-6-dni-1.pdf','DNI Fernando Gutiérrez (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (28,'chofer',6,'dni','demo-chofer-6-dni-2.pdf','DNI Fernando Gutiérrez (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (29,'chofer',6,'carnet_provincia','demo-chofer-6-carnet_provincia-1.pdf','Carnet provincia Fernando Gutiérrez (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (30,'chofer',6,'carnet_provincia','demo-chofer-6-carnet_provincia-2.pdf','Carnet provincia Fernando Gutiérrez (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (31,'chofer',7,'dni','demo-chofer-7-dni-1.pdf','DNI Pablo Soria (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (32,'chofer',7,'dni','demo-chofer-7-dni-2.pdf','DNI Pablo Soria (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (33,'chofer',8,'dni','demo-chofer-8-dni-1.pdf','DNI Alejandro Medina (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (34,'chofer',8,'dni','demo-chofer-8-dni-2.pdf','DNI Alejandro Medina (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (35,'chofer',9,'dni','demo-chofer-9-dni-1.pdf','DNI Gustavo Ríos (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (36,'chofer',9,'dni','demo-chofer-9-dni-2.pdf','DNI Gustavo Ríos (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (37,'chofer',9,'carnet_provincia','demo-chofer-9-carnet_provincia-1.pdf','Carnet provincia Gustavo Ríos (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (38,'chofer',9,'carnet_provincia','demo-chofer-9-carnet_provincia-2.pdf','Carnet provincia Gustavo Ríos (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (39,'chofer',11,'dni','demo-chofer-11-dni-1.pdf','DNI Exequiel Juarez (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (40,'chofer',11,'dni','demo-chofer-11-dni-2.pdf','DNI Exequiel Juarez (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (41,'chofer',12,'dni','demo-chofer-12-dni-1.pdf','DNI Lucía Fernández (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (42,'chofer',12,'dni','demo-chofer-12-dni-2.pdf','DNI Lucía Fernández (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (43,'chofer',12,'carnet_provincia','demo-chofer-12-carnet_provincia-1.pdf','Carnet provincia Lucía Fernández (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (44,'chofer',12,'carnet_provincia','demo-chofer-12-carnet_provincia-2.pdf','Carnet provincia Lucía Fernández (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (45,'chofer',13,'dni','demo-chofer-13-dni-1.pdf','DNI Martín Acosta (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (46,'chofer',13,'dni','demo-chofer-13-dni-2.pdf','DNI Martín Acosta (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (47,'chofer',13,'carnet_provincia','demo-chofer-13-carnet_provincia-1.pdf','Carnet provincia Martín Acosta (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (48,'chofer',13,'carnet_provincia','demo-chofer-13-carnet_provincia-2.pdf','Carnet provincia Martín Acosta (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (49,'chofer',14,'dni','demo-chofer-14-dni-1.pdf','DNI Valeria Núñez (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (50,'chofer',14,'dni','demo-chofer-14-dni-2.pdf','DNI Valeria Núñez (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (51,'chofer',16,'dni','demo-chofer-16-dni-1.pdf','DNI Natalia Ibarra (frente).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR)),
 (52,'chofer',16,'dni','demo-chofer-16-dni-2.pdf','DNI Natalia Ibarra (dorso).pdf',1,(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 30 DAY - INTERVAL 0 HOUR));

-- Alertas informativas (las automáticas las genera la aplicación al iniciar)
INSERT INTO `alerta` (`tipo`,`prioridad`,`mensaje`,`entidad_tipo`,`entidad_id`,`entidad_nombre`,`leida`,`generada_automaticamente`,`createdAt`,`updatedAt`) VALUES
 ('informativa','media','Chofer Raúl Cabrera dado de baja. Motivo: Baja por jubilación','Chofer',10,'Raúl Cabrera',1,0,(UTC_TIMESTAMP() - INTERVAL 400 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 400 DAY - INTERVAL 0 HOUR)),
 ('informativa','media','Chofer Hugo Benítez dado de baja. Motivo: Renuncia','Chofer',15,'Hugo Benítez',0,0,(UTC_TIMESTAMP() - INTERVAL 20 DAY - INTERVAL 0 HOUR),(UTC_TIMESTAMP() - INTERVAL 20 DAY - INTERVAL 0 HOUR));

-- Auditoría de ejemplo
INSERT INTO `auditoria` (`id_auditoria`,`id_usuario`,`tabla_afectada`,`id_registro_afectado`,`accion`,`fecha`,`hora`,`valor_anterior`,`valor_nuevo`,`descripcion`) VALUES
 (1,1,'usuario',1,'LOGIN',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 0 DAY),'08:07:00',NULL,NULL,'Inicio de sesión de admin'),
 (2,1,'vehiculo',17,'CREAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 12 DAY),'09:14:00',NULL,'{"patente":"AP016QQ","marca":"Toyota","modelo":"Corolla"}','Alta vehículo: Toyota Corolla (AP016QQ)'),
 (3,1,'chofer',16,'CREAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 11 DAY),'09:21:00',NULL,'{"nombre":"Natalia","apellido":"Ibarra","dni":"38444555"}','Alta de chofer: Natalia Ibarra'),
 (4,3,'mantenimiento',11,'CREAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 5 DAY),'10:28:00',NULL,'{"tipo_servicio":"Cambio de embrague","estado":"En proceso"}','Alta de mantenimiento (Cambio de embrague) para vehículo ID: 6'),
 (5,1,'asignacion_vehiculo',1,'CREAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 3 DAY),'09:35:00',NULL,'{"patente":"AA001BB","chofer":"Carlos Rodríguez"}','Asignación del vehículo AA001BB a Carlos Rodríguez'),
 (6,4,'siniestro',1,'CREAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 6 DAY),'15:42:00',NULL,'{"ubicacion":"Ruta 9 km 1040","patente":"AH008II"}','Siniestro registrado en: Ruta 9 km 1040 (vehículo AH008II)'),
 (7,1,'vehiculo',2,'EDITAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 90 DAY),'11:49:00','{"estado_actual":"En uso"}','{"estado_actual":"Baja"}','Edición de vehículo ID: 2'),
 (8,2,'chofer',15,'EDITAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 20 DAY),'16:56:00','{"estado":"Activo"}','{"estado":"Inactivo"}','Desactivación de chofer ID: 15'),
 (9,3,'mantenimiento',4,'EDITAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 40 DAY),'10:03:00','{"estado":"En proceso"}','{"estado":"Realizado"}','Cambio de estado de mantenimiento ID: 4 (En proceso → Realizado)'),
 (10,1,'herramienta',14,'EDITAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 30 DAY),'12:10:00','{"estado":"Disponible"}','{"estado":"Baja"}','Edición de herramienta ID: 14 (Hormigonera 130L)'),
 (11,1,'prestamo',6,'CREAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 8 DAY),'09:17:00',NULL,'{"nombre_operario":"Hernán Quiroga"}','Préstamo de Cortadora de Césped Naftera a Hernán Quiroga (Espacios Verdes)'),
 (12,1,'siniestro',3,'EDITAR_ESTADO',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 240 DAY),'13:24:00','{"estado":"EN PROCESO"}','{"estado":"CERRADO"}','Siniestro ID 3 cambió de EN PROCESO a: CERRADO'),
 (13,1,'usuario',6,'EDITAR',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 45 DAY),'14:31:00','{"activo":true}','{"activo":false}','Edición de usuario ID: 6 (ex_empleado)'),
 (14,NULL,'usuario',NULL,'LOGIN_FALLIDO',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2 DAY),'22:38:00',NULL,NULL,'Usuario inexistente — usuario ingresado: "administrador" (IP 10.0.0.15)'),
 (15,2,'usuario',2,'LOGIN_FALLIDO',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) - INTERVAL 2 DAY),'22:45:00',NULL,NULL,'Contraseña incorrecta — usuario ingresado: "carlos_oficina" (IP 10.0.0.15)'),
 (16,1,'usuario',1,'LOGOUT',(DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR) + INTERVAL 0 DAY),'18:52:00',NULL,NULL,'Cierre de sesión');

SET FOREIGN_KEY_CHECKS = 1;
