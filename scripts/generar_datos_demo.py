#!/usr/bin/env python3
# Genera pruebasdb/datos_demo.sql con datos de ejemplo coherentes (fechas relativas a "hoy").
#   python3 scripts/generar_datos_demo.py > pruebasdb/datos_demo.sql && npm run db:armar
# También escribe pruebasdb/documentos_demo.json (lista de PDF de ejemplo que genera scripts/documentos-demo.js).
import os
import sys

HOY = "DATE(UTC_TIMESTAMP() - INTERVAL 3 HOUR)"  # fecha de hoy en Argentina


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, str):
        return "'" + v.replace("\\", "\\\\").replace("'", "''") + "'"
    return str(v)


def fd(n):
    """DATE relativa a hoy"""
    if n is None:
        return "NULL"
    return f"({HOY} {'+' if n >= 0 else '-'} INTERVAL {abs(n)} DAY)"


def fdt(n, extra=""):
    """DATETIME de una fecha 'solo día' (medianoche de Argentina = 03:00 UTC)"""
    if n is None:
        return "NULL"
    return f"({HOY} {'+' if n >= 0 else '-'} INTERVAL {abs(n)} DAY + INTERVAL 3 HOUR{extra})"


def ts(n, horas=0):
    """TIMESTAMP real relativo a ahora (UTC)"""
    return f"(UTC_TIMESTAMP() - INTERVAL {n} DAY - INTERVAL {horas} HOUR)"


out = []


def tabla(nombre, columnas, filas):
    cols = ",".join(f"`{c}`" for c in columnas)
    out.append(f"INSERT INTO `{nombre}` ({cols}) VALUES")
    out.append(",\n".join(" (" + ",".join(f if isinstance(f, _Raw) else q(f) for f in fila) + ")" for fila in filas) + ";\n")


class _Raw(str):
    pass


def R(x):
    return _Raw(x)


HASH = "$2b$10$jM.MTLrReit4A2InHkbQ9eSpc5t/V0GsuXjgrCyNgACwuHmgsdNgu"  # Ficha2026!

# ───────────────────────── Usuarios ─────────────────────────
ALL = "Vehicles,Choferes,Mantenimientos,Tools,Alertas,Reportes,Usuarios,Roles,Auditoria,Siniestros"
usuarios = [
    (1, "admin", HASH, "Administrador", "Sistema", 1, 1, None),  # el rol Administrador tiene todo
    (2, "carlos_oficina", HASH, "Carlos", "Gerez", 1, 3, "Vehicles,Choferes,Auditoria"),
    (3, "walter", HASH, "Walter Daniel", "Gueleb", 1, 2, "Choferes,Mantenimientos,Auditoria"),
    (4, "ExeJuarez", HASH, "Exequiel", "Juarez", 1, 3, "Vehicles,Choferes,Mantenimientos,Alertas,Reportes,Siniestros"),
    (5, "taller_jefe", HASH, "Marta", "Quiroga", 1, 2, None),  # sin permisos propios: hereda los del rol Jefe de Taller
    (6, "ex_empleado", HASH, "Luis", "Paredes", 0, 3, "Vehicles"),  # usuario bloqueado (para probar el login)
]
out.append("-- Usuarios (contraseña temporal de todos:  Ficha2026! ). `ex_empleado` está bloqueado a propósito.")
tabla("usuario", ["id_usuario", "nombre_usuario", "contrasena", "nombre", "apellido", "activo", "id_rol", "permisos"], usuarios)

# ───────────────────────── Catálogos ─────────────────────────
out.append("-- Catálogos")
tabla("tipo_vehiculo", ["id_tipo", "descripcion", "unidad"], [(1, "Camioneta", "km"), (2, "Camión", "km"), (3, "Maquinaria Pesada", "hs"), (4, "Utilitario", "km"), (5, "Auto", "km"), (6, "Motocicleta", "km")])
tabla("distritos", ["id_distrito", "nombre"], [(1, "Centro"), (2, "Norte"), (3, "Sur"), (4, "Este"), (5, "Oeste")])
sectores = ["Construcción A", "Taller Mecánico", "Espacios Verdes", "Depósito Central", "Mantenimiento General", "Alumbrado Público"]
tabla("sectores", ["id_sector", "nombre"], [(i + 1, n) for i, n in enumerate(sectores)])
operarios = [("Hernán Quiroga", "Activo"), ("Marcos Díaz", "Activo"), ("Gomez Juan", "Activo"), ("Juan Pérez", "Activo"),
             ("Silvia Torres", "Activo"), ("Andrés Molina", "Activo"), ("Ramón Acuña", "Inactivo"), ("Patricia Vera", "Activo")]
tabla("operarios", ["id_operario", "nombre", "estado"], [(i + 1, n, e) for i, (n, e) in enumerate(operarios)])

# ───────────────────────── Vehículos ─────────────────────────
# (id, patente, marca, modelo, anio, tipo, chasis, motor, comb, transm, km, cedula, seguro_cia, seguro_dias, rto_dias, estado, distrito, baja_dias, alta_dias, obs)
V = [
    (1, "AA001BB", "Toyota", "Hilux", 2019, 1, "CHS-001", "MOT-001", "Diésel", "Manual", 87000, "CED-001", "Federación Patronal", 300, 45, "En uso", "Centro", None, 1500, "En uso por Obras Públicas"),
    (2, "AB002CC", "Ford", "Ranger", 2020, 1, "CHS-002", "MOT-002", "Diésel", "Manual", 124000, "CED-002", "San Cristóbal", -120, -90, "Baja", "Norte", 90, 1400, "Dada de baja por siniestro total"),
    (3, "AC003DD", "Volkswagen", "Amarok", 2021, 1, "CHS-003", "MOT-003", "Diésel", "Automática", 49200, "CED-003", "La Caja", 20, 200, "Disponible", "Sur", None, 1200, None),
    (4, "AD004EE", "Chevrolet", "S-10", 2018, 1, "CHS-004", "MOT-004", "Diésel", "Manual", 204100, "CED-004", "Federación Patronal", 400, -10, "Disponible", "Centro", None, 1700, "RTO vencida: gestionar la verificación"),
    (5, "AE005FF", "Mercedes-Benz", "Tector", 2020, 2, "CHS-005", "MOT-005", "Diésel", "Manual", 315000, "CED-005", "San Cristóbal", 150, 260, "Disponible", "Norte", None, 1600, None),
    (6, "AF006GG", "Scania", "R410", 2019, 2, "CHS-006", "MOT-006", "Diésel", "Manual", 415000, "CED-006", "Rivadavia Seguros", -40, 10, "En mantenimiento", "Sur", None, 1800, "En taller: cambio de embrague"),
    (7, "AG007HH", "Iveco", "Tector 170E28", 2022, 2, "CHS-007", "MOT-007", "Diésel", "Manual", 62000, "CED-007", "Zurich", 220, 180, "En uso", "Centro", None, 1000, "Service vencido: pasarlo por taller"),
    (8, "AH008II", "Nissan", "Frontier", 2021, 1, "CHS-008", "MOT-008", "Diésel", "Manual", 73000, "CED-008", "Mapfre", 350, 330, "En siniestro", "Norte", None, 1100, "Siniestro en proceso"),
    (9, "AI009JJ", "Renault", "Kangoo", 2020, 4, "CHS-009", "MOT-009", "Nafta", "Manual", 55000, "CED-009", "Sancor Seguros", 260, 0, "Disponible", "Sur", None, 1350, "RTO vence hoy"),
    (10, "AJ010KK", "Ford", "Transit", 2023, 4, "CHS-010", "MOT-010", "Diésel", "Manual", 18000, "CED-010", "La Segunda", -300, -200, "Baja", "Centro", 200, 900, "Vendido en subasta"),
    (11, "PPKEE2", "Ford", "Ranger", 2017, 1, "CHS-2323234343", "MOT-456421321646", None, "Manual", 15000, "CED-1234568943", None, None, None, "Disponible", "Centro", None, 600, "Sin vencimientos cargados"),
    (12, "AK011LL", "Peugeot", "Partner", 2022, 4, "CHS-012", "MOT-012", "Nafta", "Manual", 33000, "CED-012", "Mapfre", 29, 31, "Disponible", "Este", None, 800, "Seguro por vencer; RTO justo fuera del umbral"),
    (13, "AL012MM", "Fiat", "Cronos", 2023, 5, "CHS-013", "MOT-013", "Nafta", "Manual", 12500, "CED-013", "Sancor Seguros", 340, 500, "En uso", "Oeste", None, 500, None),
    (14, "AM013NN", "Honda", "XR150L", 2022, 6, "CHS-014", "MOT-014", "Nafta", "Manual", 9800, "CED-014", "La Caja", 120, 90, "En uso", "Centro", None, 700, "Moto de inspectores"),
    (15, "AN014OO", "Caterpillar", "320D", 2015, 3, "CHS-015", "MOT-015", "Diésel", "Automática", 8400, "CED-015", "Zurich", 15, 210, "Disponible", "Este", None, 2800, "Service programado muy próximo"),
    (16, "AO015PP", "Mercedes-Benz", "Sprinter", 2020, 4, "CHS-016", "MOT-016", "Diésel", "Manual", 98000, "CED-016", "San Cristóbal", -60, -45, "Baja", "Oeste", 30, 1300, "Fin de vida útil"),
    (17, "AP016QQ", "Toyota", "Corolla", 2024, 5, "CHS-017", "MOT-017", "Nafta", "Automática", 3200, "CED-017", "Federación Patronal", 500, 700, "Disponible", "Centro", None, 200, "Unidad nueva, sin mantenimientos"),
    (18, "AQ017RR", "Ford", "F-100", 2005, 1, "CHS-018", "MOT-018", "Diésel", "Manual", 250000, "CED-018", "La Segunda", 5, 3, "Disponible", "Sur", None, 3000, "Seguro y RTO a punto de vencer"),
]
out.append("-- Vehículos: en uso, disponibles, en taller, en siniestro y dados de baja; con documentación vigente, por vencer y vencida")
filas = []
for (i, pat, marca, mod, anio, tipo, chasis, motor, comb, tr, km, ced, cia, sdias, rdias, est, dist, baja, alta, obs) in V:
    filas.append((i, pat, None, marca, mod, anio, tipo, chasis, motor, comb, tr, km, ced, "Municipalidad Capital", cia,
                  R(fd(sdias) if sdias is not None else "NULL"), R(fd(rdias) if rdias is not None else "NULL"),
                  est, dist, None, obs, None, R(fd(-alta)), R(fd(-baja) if baja else "NULL"), "cedula.jpg", None, None))
tabla("vehiculo", ["id_vehiculo", "patente", "legajo", "marca", "modelo", "anio", "id_tipo", "num_chasis", "num_motor", "combustible", "transmision", "km_actual", "cedula_numero", "cedula_titular", "seguro_compania", "seguro_vencimiento", "rto_vencimiento", "estado_actual", "distrito", "area", "observaciones", "imagen_url", "fecha_alta", "fecha_baja", "foto_cedula", "foto_titulo", "foto_rto"], filas)

# ───────────────────────── Choferes y licencias ─────────────────────────
# (id, nombre, apellido, dni, tel, dir, estado, nac, ingreso(dias atras), email, turno, motivo, lic(num, cat, venc_dias))
C = [
    (1, "Carlos", "Rodríguez", "28111222", "3854100001", "Av. Libertad 123, Capital", "Activo", "1985-03-12", 2400, "carlos@muni.gov", "Mañana", None, ("LIC-00001", "C", 900)),
    (2, "Sergio", "Villalba", "30222333", "3854100002", "San Martín 456, Capital", "Activo", "1988-07-24", 2000, "sergio@muni.gov", "Tarde", None, ("LIC-00002", "B2", -20)),
    (3, "Marcelo", "Paz", "32333444", "3854100003", "Belgrano 789, Banda", "Activo", "1990-11-05", 1700, "marcelo@muni.gov", "Mañana", None, ("LIC-00003", "C", 12)),
    (4, "Diego", "Herrera", "25444555", "3854100004", "Rivadavia 321, Capital", "Activo", "1982-01-30", 2600, "diego@muni.gov", "Mañana", None, ("LIC-00004", "C", 400)),
    (5, "Roberto", "Leiva", "35555666", "3854100005", "Sarmiento 654, Banda", "Activo", "1992-05-18", 1500, "roberto@muni.gov", "Tarde", None, ("LIC-00005", "B1", -200)),
    (6, "Fernando", "Gutiérrez", "27666777", "3854100006", "Tucumán 987, Capital", "Activo", "1983-09-07", 3000, "fernando@muni.gov", "Mañana", None, ("LIC-00006", "C", 30)),
    (7, "Pablo", "Soria", "38777888", "3854100007", "Córdoba 147, Capital", "Licencia Vacaciones/Medica", "1995-02-14", 1200, "pablo@muni.gov", "Tarde", None, ("LIC-00007", "B2", 100)),
    (8, "Alejandro", "Medina", "31888999", "3854100008", "Mitre 258, Banda", "Activo", "1987-06-22", 2200, "alejandro@muni.gov", "Mañana", None, ("LIC-00008", "C", 31)),
    (9, "Gustavo", "Ríos", "29999000", "3854100009", "Independencia 369, Capital", "Activo", "1984-10-03", 3300, "gustavo@muni.gov", "Tarde", None, ("LIC-00009", "B1", 250)),
    (10, "Raúl", "Cabrera", "33000111", "3854100010", "Las Heras 741, Capital", "Inactivo", "1979-12-28", 4200, "raul@muni.gov", "Mañana", "Baja por jubilación", ("LIC-00010", "C", -400)),
    (11, "Exequiel", "Juarez", "39367819", "3789173829", "mzn a lote 6", "Activo", "2002-01-01", 90, "ejemplo@gmail.com", "Tarde/Noche", None, ("LIC-37283293", "B2", 1800)),
    (12, "Lucía", "Fernández", "36111222", "3854100012", "Catamarca 55, Capital", "Activo", "1991-04-09", 800, "lucia@muni.gov", "Mañana", None, ("LIC-00012", "B1", 0)),
    (13, "Martín", "Acosta", "34222333", "3854100013", "Salta 920, Banda", "Activo", "1989-08-15", 1900, "martin@muni.gov", "Tarde/Noche", None, ("LIC-00013", "E", 60)),
    (14, "Valeria", "Núñez", "37333444", "3854100014", "Jujuy 410, Capital", "Activo", "1994-12-02", 700, "valeria@muni.gov", "Mañana", None, ("LIC-00014", "A", 500)),
    (15, "Hugo", "Benítez", "26444555", "3854100015", "Alsina 88, Capital", "Inactivo", "1981-02-27", 3600, "hugo@muni.gov", "Noche", "Renuncia", ("LIC-00015", "D", 300)),
    (16, "Natalia", "Ibarra", "38444555", "3854100016", "Chacabuco 301, Banda", "Activo", "1996-06-30", 400, "natalia@muni.gov", "Mañana", None, ("LIC-00016", "B1", 700)),
]
CON_CARNET = {1, 3, 4, 6, 9, 12, 13}  # choferes con carnet oficial de la provincia
out.append("-- Choferes: licencia vigente, por vencer (30/12/0 días), vencida, inactivos y en licencia médica")
filas = []
for (i, n, a, dni, tel, dire, est, nac, ing, em, tu, mot, lic) in C:
    filas.append((i, n, a, dni, tel, dire, est, nac, R(fd(-ing)), em, tu, R(ts(ing)), R(ts(1)), None, None, mot, 1 if i in CON_CARNET else 0))
tabla("chofer", ["id_chofer", "nombre", "apellido", "dni", "telefono", "direccion", "estado", "fechaNacimiento", "fechaIngreso", "email", "turno", "createdAt", "updatedAt", "foto_documento", "imagen", "motivoBaja", "tiene_carnet_oficial"], filas)
tabla("licencia_chofer", ["id_licencia", "id_chofer", "numero", "categoria", "fecha_emision", "fecha_vencimiento", "imagen"],
      [(c[0], c[0], c[12][0], c[12][1], R(fd(c[12][2] - 1825)), R(fd(c[12][2])), "licencia.jpg") for c in C])

# ───────────────────────── Asignaciones ─────────────────────────
# (id, veh, chofer, salida_dias, estimada_dias, devolucion_dias|None, destino, obs, estado)
A = [
    (1, 1, 1, -3, 12, None, "Norte", "Sale en buenas condiciones", "Activo"),
    (2, 7, 4, -2, 5, None, "Centro", "Traslado de materiales", "Activo"),
    (3, 13, 9, -10, 0, None, "Oeste", "Lleva 10 días asignada: pendiente de marcar como devuelta", "Activo"),
    (4, 14, 14, -1, 7, None, "Centro", "Recorrida de inspecciones", "Activo"),
    (5, 5, 5, -70, -60, -61, "Norte", "Traslado de materiales", "Finalizado"),
    (6, 3, 8, -45, -40, -41, "Sur", "Comisión inter-distrital", "Finalizado"),
    (7, 1, 3, -120, -110, -112, "Este", "Obra vial", "Finalizado"),
    (8, 4, 2, -150, -140, -139, "Centro", "Relevamiento", "Finalizado"),
    (9, 9, 16, -30, -25, -26, "Sur", "Reparto de insumos", "Finalizado"),
    (10, 12, 6, -20, -15, -15, "Este", "Visita a escuelas", "Finalizado"),
]
out.append("-- Asignaciones (4 activas, sin fecha estimada: se marcan como devueltas a mano, y un historial finalizado)")
tabla("asignacion_vehiculo", ["id_asignacion", "id_vehiculo", "id_chofer", "fecha_salida", "fecha_estimada_devolucion", "fecha_devolucion", "destino_area", "observaciones", "estado"],
      [(i, v, c, R(fdt(s)), None, R(fdt(d, " + INTERVAL 14 HOUR")) if d is not None else None, dst, ob, est) for (i, v, c, s, e, d, dst, ob, est) in A])

# ───────────────────────── Repuestos ─────────────────────────
REP = {
    1: ("Filtro de Aceite (Universal)", 6500), 2: ("Aceite Sintético 10W40 (1 Litro)", 8000), 3: ("Pastillas de Freno (Juego Trasero)", 28000),
    4: ("Filtro de Aire", 15000), 5: ("Pastillas de Freno (Estándar)", 8000), 6: ("Filtro de Aceite (Camioneta)", 8500),
    7: ("Filtro de Aire (Camión)", 14000), 8: ("Filtro de Combustible (Diesel)", 11500), 9: ("Aceite Motor 15W40 (Tambor 20L)", 85000),
    10: ("Aceite Sintético 5W30 (1L)", 9500), 11: ("Pastillas de Freno (Juego Delantero)", 35000), 12: ("Batería 12V 75Ah", 120000),
    13: ("Amortiguador Delantero (Par)", 185000), 14: ("Bomba de Agua (Diesel)", 75000), 15: ("Kit de Embrague Completo", 320000),
    16: ("Óptica Trasera Izquierda", 45000), 17: ("Espejo Retrovisor Derecho", 38000), 18: ("Cruceta de Cardán", 18000),
    19: ("Inyector Common Rail", 150000), 20: ("Filtro de Habitáculo", 6500), 21: ("Correa Poly-V", 22000), 22: ("Bomba de Freno", 85000),
}
STOCK = {1: 14, 2: 30, 3: 8, 4: 13, 5: 12, 6: 22, 7: 12, 8: 16, 9: 8, 10: 35, 11: 8, 12: 5, 13: 3, 14: 6, 15: 0, 16: 15, 17: 10, 18: 22, 19: 8, 20: 40, 21: 2, 22: 5}
out.append("-- Repuestos (hay uno sin stock y varios con stock bajo)")
MINIMO = {12: 5, 9: 4}
tabla("repuestos", ["id_repuesto", "nombre", "stock", "stock_minimo", "costo_unitario"], [(i, REP[i][0], STOCK[i], MINIMO.get(i, 3), REP[i][1]) for i in sorted(REP)])

# ───────────────────────── Mantenimientos ─────────────────────────
# (id, veh, usuario, tipo, inicio_dias, fin_dias|None, km, proximo_km, estado, mano_obra, desc, obs, [(rep, cant)])
M = [
    (1, 1, 1, "Cambio de aceite", -300, -300, 70000, 78000, "Realizado", 40000, "Cambio de aceite y filtro", "Aceite en mal estado", [(6, 1), (10, 4)]),
    (2, 1, 1, "Cambio de aceite", -200, -200, 78000, 85000, "Realizado", 40000, "Cambio de aceite y filtro", None, [(6, 1), (10, 4)]),
    (3, 1, 3, "Frenos", -120, -119, 83000, None, "Realizado", 30000, "Cambio de pastillas delanteras", "Discos con desgaste leve", [(11, 1)]),
    (4, 1, 3, "Cambio de aceite", -40, -40, 85500, 95000, "Realizado", 40000, "Cambio de aceite y filtro", None, [(6, 1), (10, 4)]),
    (5, 3, 1, "Cambio de aceite", -90, -90, 45000, 55000, "Realizado", 35000, "Service de los 45.000 km", None, [(6, 1), (10, 4)]),
    (6, 3, 1, "Service 50.000 km", 0, None, 50000, 50000, "Programado", 0, "Service programado a los 50000 km", None, []),
    (7, 4, 1, "Cambio de filtros", -250, -250, 190000, 198000, "Realizado", 30000, "Filtros de aire y combustible", None, [(4, 1), (8, 1)]),
    (8, 4, 3, "Cambio de aceite", -100, -100, 198000, 205000, "Realizado", 40000, "Cambio de aceite y filtro", "Próximo service a los 205.000 km", [(6, 1), (10, 4)]),
    (9, 5, 1, "Suspensión", -60, -58, 312000, None, "Realizado", 60000, "Reemplazo de amortiguadores delanteros", None, [(13, 1)]),
    (10, 5, 3, "Cambio de aceite", -330, -330, 295000, 310000, "Realizado", 50000, "Cambio de aceite y filtros", None, [(9, 1), (7, 1)]),
    (11, 6, 1, "Cambio de embrague", -5, None, 415000, None, "En proceso", 90000, "Reemplazo de kit de embrague completo", "Vehículo en taller", [(15, 1)]),
    (12, 6, 3, "Cambio de aceite", -400, -400, 390000, 405000, "Realizado", 55000, "Cambio de aceite y filtros", None, [(9, 1), (7, 1)]),
    (13, 7, 1, "Cambio de aceite", -180, -180, 52000, 60000, "Realizado", 40000, "Cambio de aceite y filtro", "Próximo service a los 60.000 km", [(6, 1), (10, 4)]),
    (14, 8, 3, "Cambio de aceite", -20, -20, 72000, 82000, "Realizado", 40000, "Cambio de aceite y filtro", None, [(6, 1), (10, 4)]),
    (15, 9, 1, "Batería", -500, -500, 40000, None, "Realizado", 15000, "Reemplazo de batería", None, [(12, 1)]),
    (16, 15, 1, "Service 9.000 hs/km", 0, None, 9000, 9000, "Programado", 0, "Service programado a los 9000 km", None, []),
    (17, 16, 1, "Cambio de aceite", -200, -200, 96000, 105000, "Realizado", 40000, "Último service antes de la baja", None, [(1, 1), (2, 5)]),
    (18, 2, 1, "Frenos", -400, -399, 110000, None, "Realizado", 35000, "Cambio de pastillas y bomba de freno", None, [(5, 2), (22, 1)]),
    (19, 12, 3, "Cambio de aceite", -60, -60, 30000, 40000, "Realizado", 35000, "Service de los 30.000 km", None, [(1, 1), (2, 4)]),
    (20, 18, 1, "Cambio de aceite", -30, -30, 249000, 255000, "Realizado", 40000, "Cambio de aceite y filtro", "Próximo service a los 255.000 km", [(1, 1), (2, 5)]),
    (21, 13, 3, "Revisión de garantía", -150, -150, 5000, 15000, "Realizado", 0, "Revisión de garantía de concesionaria", None, []),
    (22, 14, 1, "Service 10.000 km", -20, None, 10000, 10000, "Cancelado", 0, "Service programado a los 10000 km", "Cancelado manualmente.", []),
]
# Datos administrativos (remito, factura, proveedor, pedido, expediente): unos completos, otros por completar
ADMIN = {
    1: ("0001-00004510", "A-0003-00011201", "Lubricentro del Centro S.A.", "PED-2025-031", "EXP-4012-221/2025"),
    2: ("0001-00004877", "A-0003-00011988", "Lubricentro del Centro S.A.", "PED-2025-058", "EXP-4012-398/2025"),
    3: ("0007-00001203", "B-0001-00000977", "Frenos y Suspensiones Norte", "PED-2026-004", None),
    4: ("0001-00005302", None, "Lubricentro del Centro S.A.", "PED-2026-019", None),
    5: ("0003-00020045", "A-0002-00045123", "Repuestos del Sur S.R.L.", "PED-2026-007", "EXP-4012-088/2026"),
    7: ("0003-00018830", "A-0002-00043210", "Repuestos del Sur S.R.L.", "PED-2025-044", "EXP-4012-301/2025"),
    9: ("0010-00000456", "A-0005-00001234", "Suspensiones Tucumán", None, None),
    13: (None, None, None, None, None),
}
out.append("-- Mantenimientos (programados, en proceso y realizados) con sus repuestos y datos administrativos (algunos por completar)")
filas_m, filas_d = [], []
did = 1
for (i, veh, usr, tipo, ini, fin, km, prox, est, mano, desc, obs, reps) in M:
    rep_total = sum(REP[r][1] * c for r, c in reps)
    filas_m.append((i, veh, usr, tipo, R(fd(ini)), R(fd(fin)) if fin is not None else None, km, rep_total + mano, desc, obs, prox, None, est, mano, rep_total) + (ADMIN.get(i) or (None,) * 5))
    for r, c in reps:
        filas_d.append((did, i, r, c, REP[r][1]))
        did += 1
tabla("mantenimiento", ["id_mantenimiento", "id_vehiculo", "id_usuario", "tipo_servicio", "fecha_inicio", "fecha_fin", "km_servicio", "costo_total", "descripcion", "observaciones", "proximo_km", "proxima_fecha", "estado", "mano_obra", "costo_repuestos", "nro_remito", "nro_factura", "proveedor", "nro_pedido", "nro_expediente"], filas_m)
tabla("detalle_mantenimiento", ["id_detalle", "id_mantenimiento", "id_repuesto", "cantidad", "costo_unitario"], filas_d)

# ───────────────────────── Historial de kilometraje ─────────────────────────
H = {  # vehículo: [(dias, km)] en orden cronológico; el último valor es el km actual
    1: [(-420, 62000), (-300, 70000), (-200, 78000), (-120, 83000), (-40, 85500), (-3, 87000)],
    2: [(-520, 98000), (-400, 110000), (-300, 118000), (-92, 124000)],
    3: [(-200, 38000), (-90, 45000), (-41, 47500), (-5, 49200)],
    4: [(-300, 186000), (-250, 190000), (-100, 198000), (-15, 204100)],
    5: [(-400, 280000), (-330, 295000), (-60, 312000), (-61, 315000 - 3000 + 3000)],
    6: [(-420, 380000), (-400, 390000), (-5, 415000)],
    7: [(-250, 41000), (-180, 52000), (-2, 62000)],
    8: [(-120, 60000), (-20, 72000), (-7, 73000)],
    9: [(-520, 35000), (-500, 40000), (-26, 55000)],
    12: [(-200, 18000), (-60, 30000), (-15, 33000)],
    13: [(-150, 5000), (-10, 12500)],
    14: [(-60, 7000), (-1, 9800)],
    15: [(-90, 7000), (-10, 8400)],
    16: [(-300, 85000), (-200, 96000), (-31, 98000)],
    18: [(-200, 240000), (-30, 249000), (-4, 250000)],
}
# corrección de orden cronológico del vehículo 5
H[5] = [(-400, 280000), (-330, 295000), (-61, 312000), (-30, 315000)]
out.append("-- Historial de kilometraje (siempre creciente; el último valor coincide con el km actual del vehículo)")
filas, hid = [], 1
for veh in sorted(H):
    previo = None
    for dias, km in H[veh]:
        if previo is not None:
            filas.append((hid, veh, previo, km, R(fd(dias)), "Actualización de kilometraje"))
            hid += 1
        previo = km
tabla("historial_km", ["id_historial", "id_vehiculo", "km_anterior", "km_nuevo", "fecha", "observaciones"], filas)

# ───────────────────────── Herramientas y préstamos ─────────────────────────
# (id, codigo, nombre, sector, estado, stock, energia, obs, alta_dias)
T = [
    (1, "HTI-001", 'Amoladora Angular Bosch 4.5"', "Taller Mecánico", "Disponible", 3, "Energía", None, 900),
    (2, "HTI-002", "Amoladora", "Construcción A", "Disponible", 2, "Energía", "Se encuentran en buen estado", 700),
    (3, "HTI-003", "Destornillador percutor", "Taller Mecánico", "En uso", 1, "Energía", "Préstamo vencido: reclamar devolución", 650),
    (4, "HTI-004", "Gato Hidráulico 20T", "Depósito Central", "Disponible", 4, None, None, 900),
    (5, "HTI-005", "Caja de Tubos Mando 1/2 (Juego)", "Mantenimiento General", "Disponible", 5, None, None, 880),
    (6, "HTI-006", "Soldadora Inverter 200A", "Taller Mecánico", "En uso", 2, "Energía", "Las dos unidades están afuera", 600),
    (7, "HTI-007", "Hidrolavadora Industrial 150 Bar", "Mantenimiento General", "En Reparación", 1, "Energía", "Falla la bomba", 800),
    (8, "HTI-008", "Compresor de Aire 50L", "Taller Mecánico", "Disponible", 3, "Energía", None, 750),
    (9, "HTI-009", 'Sierra Circular 7 1/4"', "Construcción A", "Disponible", 2, "Energía", None, 500),
    (10, "HTI-010", 'Llave Dinamométrica 1/2"', "Taller Mecánico", "Disponible", 4, None, None, 820),
    (11, "HTI-011", "Cortadora de Césped Naftera", "Espacios Verdes", "Disponible", 3, "Nafta", "Una unidad en préstamo, quedan 2", 400),
    (12, "HTI-012", "Motosierra Stihl MS170", "Espacios Verdes", "En Reparación", 3, "Nafta", "Enviadas a service oficial", 380),
    (13, "HTI-013", "Taladro de Banco 16mm", "Taller Mecánico", "Disponible", 1, "Energía", None, 950),
    (14, "HTI-014", "Hormigonera 130L", "Construcción A", "Baja", 1, "Energía", "Motor fundido, dada de baja", 1500),
    (15, "HTI-015", "Escalera de Aluminio 12 Escalones", "Mantenimiento General", "Disponible", 6, None, None, 300),
    (16, "HTI-016", "Grupo Electrógeno 5 kVA", "Alumbrado Público", "Disponible", 1, "Nafta", None, 200),
    (17, "HTI-017", "Desmalezadora a nafta", "Espacios Verdes", "Disponible", 2, "Nafta", None, 250),
]
out.append("-- Herramientas: disponibles, en uso (total y parcial), en reparación y de baja")
tabla("herramienta", ["id_herramienta", "codigo_activo", "nombre", "sector", "estado", "stock", "combustible_energia", "observaciones", "imagen_url", "fecha_alta"],
      [(i, c, n, s, e, st, en, ob, None, R(fdt(-a))) for (i, c, n, s, e, st, en, ob, a) in T])
# (id, herr, operario, sector, salida, estimada, real|None, estado, obs)
P = [
    (1, 2, "Gomez Juan", "Espacios Verdes", -120, -110, -111, "Finalizado", "Devuelta sin novedades"),
    (2, 2, "Juan Pérez", "Taller Mecánico", -100, -90, -92, "Finalizado", None),
    (3, 3, "Gomez Juan", "Construcción A", -40, -30, None, "Activo", "Entregado con juego de brocas"),
    (4, 6, "Marcos Díaz", "Taller Mecánico", -5, 10, None, "Activo", None),
    (5, 6, "Silvia Torres", "Construcción A", -2, 3, None, "Activo", "Con cables y máscara"),
    (6, 11, "Hernán Quiroga", "Espacios Verdes", -8, -2, None, "Activo", "Préstamo vencido hace 2 días"),
    (7, 17, "Andrés Molina", "Espacios Verdes", -3, 4, None, "Activo", None),
    (8, 1, "Patricia Vera", "Mantenimiento General", -60, -50, -49, "Finalizado", None),
    (9, 4, "Marcos Díaz", "Depósito Central", -15, -10, -9, "Finalizado", None),
    (10, 8, "Silvia Torres", "Taller Mecánico", -25, -20, -18, "Finalizado", "Devuelto con 2 días de demora"),
    (11, 15, "Andrés Molina", "Alumbrado Público", -12, -5, -6, "Finalizado", None),
    (12, 9, "Hernán Quiroga", "Construcción A", -90, -80, -81, "Finalizado", None),
]
out.append("-- Préstamos: en plazo, vencidos y devueltos")
tabla("prestamo", ["id_prestamo", "id_herramienta", "nombre_operario", "fecha_salida", "fecha_devolucion_estimada", "fecha_devolucion_real", "sector_destino", "observaciones", "estado_prestamo"],
      [(i, h, o, R(fdt(sa)), R(fdt(es)), R(fdt(r, " + INTERVAL 14 HOUR")) if r is not None else None, s, ob, est) for (i, h, o, s, sa, es, r, est, ob) in P])

# ───────────────────────── Siniestros ─────────────────────────
# (id, veh, chofer|None, nombre_chofer, fecha_dias, ubic, relato, danos, t_veh, t_seg, t_cond, t_cont, estado)
S = [
    (1, 8, 8, "Alejandro Medina", -6, "Ruta 9 km 1040", "Colisión trasera en semáforo.", "Paragolpes y baúl", "Fiat Palio", "La Segunda", "Juan Gómez", "3855111222", "EN PROCESO"),
    (2, 2, 5, "Roberto Leiva", -100, "Av. Belgrano y Sarmiento", "Impacto frontal, pérdida total.", "Frente completo y motor", "Chevrolet Onix", "Sancor Seguros", "María Paz", "3854333444", "RESUELTO"),
    (3, 1, 3, "Marcelo Paz", -250, "Calle Mitre 400", "Roce lateral al estacionar.", "Espejo y puerta derecha", None, None, None, None, "CERRADO"),
    (4, 4, None, None, -60, "Playa de maniobras municipal", "Daño encontrado al devolver la unidad; no se identificó al responsable.", "Faro izquierdo", None, None, None, None, "RESUELTO"),
    (5, 10, 2, "Sergio Villalba", -220, "Ruta 34 km 12", "Vuelco sin heridos por pérdida de tracción.", "Carrocería", None, None, None, None, "RESUELTO"),
]
out.append("-- Siniestros: uno en proceso (vehículo en siniestro), resueltos y cerrados; con y sin chofer identificado")
tabla("siniestro", ["id_siniestro", "id_vehiculo", "id_chofer", "chofer_involucrado", "fecha_siniestro", "ubicacion", "relato", "danos_vehiculo", "tercero_vehiculo", "tercero_seguro", "tercero_conductor", "tercero_contacto", "estado", "archivos_adjuntos", "createdAt", "updatedAt"],
      [(i, v, c, nc, R(fd(f)), u, r, d, tv, ts_, tc, tco, e, "", R(ts(-f)), R(ts(-f))) for (i, v, c, nc, f, u, r, d, tv, ts_, tc, tco, e) in S])

# ───────────────────────── Documentación adjunta ─────────────────────────
# Cada fila apunta a un PDF de ejemplo que genera el cargador (scripts/documentos-demo.js) en uploads/documentos.
CAT_V = {"comodato": "Comodato", "acta_afectacion": "Acta de afectación", "acta_entrega": "Acta de entrega", "acta_desafectacion": "Acta de desafectación temporal"}
DOCS_V = {
    1: ["comodato", "acta_afectacion", "acta_entrega"],
    3: ["acta_afectacion", "acta_entrega"],
    5: ["comodato"],
    7: ["acta_afectacion"],
    4: ["acta_desafectacion"],  # disponible, sin chofer: desafectación temporal
    12: ["comodato", "acta_entrega"],
}
docs = []
manifiesto = []
did2 = 1
def agregar_doc(entidad, ident, categoria, titulo, n):
    global did2
    archivo = f"demo-{entidad}-{ident}-{categoria}-{n}.pdf"
    docs.append((did2, entidad, ident, categoria, archivo, f"{titulo}.pdf", 1, R(ts(30)), R(ts(30))))
    manifiesto.append({"archivo": archivo, "titulo": titulo, "detalle": f"{entidad} {ident}"})
    did2 += 1
for vid, cats in sorted(DOCS_V.items()):
    patente = next(v[1] for v in V if v[0] == vid)
    for c in cats:
        agregar_doc("vehiculo", vid, c, f"{CAT_V[c]} {patente}", 1)
for (i, n, a, *_resto) in C:
    if i in (10, 15):
        continue  # inactivos sin documentación cargada (ejemplo de DNI incompleto)
    agregar_doc("chofer", i, "dni", f"DNI {n} {a} (frente)", 1)
    agregar_doc("chofer", i, "dni", f"DNI {n} {a} (dorso)", 2)
    if i in CON_CARNET:
        agregar_doc("chofer", i, "carnet_provincia", f"Carnet provincia {n} {a} (frente)", 1)
        agregar_doc("chofer", i, "carnet_provincia", f"Carnet provincia {n} {a} (dorso)", 2)
out.append("-- Documentación adjunta (comodatos, actas, DNI y carnet de la provincia)")
tabla("documento_adjunto", ["id_documento", "entidad", "id_entidad", "categoria", "archivo", "nombre_original", "id_usuario", "createdAt", "updatedAt"], docs)
import json as _json
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "pruebasdb", "documentos_demo.json"), "w", encoding="utf8").write(_json.dumps(manifiesto, ensure_ascii=False, indent=1) + "\n")

# ───────────────────────── Alertas informativas ─────────────────────────
# Las alertas automáticas (licencias, RTO/seguro, service, préstamos, siniestros) las genera la aplicación al iniciar.
out.append("-- Alertas informativas (las automáticas las genera la aplicación al iniciar)")
tabla("alerta", ["tipo", "prioridad", "mensaje", "entidad_tipo", "entidad_id", "entidad_nombre", "leida", "generada_automaticamente", "createdAt", "updatedAt"], [
    ("informativa", "media", "Chofer Raúl Cabrera dado de baja. Motivo: Baja por jubilación", "Chofer", 10, "Raúl Cabrera", 1, 0, R(ts(400)), R(ts(400))),
    ("informativa", "media", "Chofer Hugo Benítez dado de baja. Motivo: Renuncia", "Chofer", 15, "Hugo Benítez", 0, 0, R(ts(20)), R(ts(20))),
])

# ───────────────────────── Auditoría de ejemplo ─────────────────────────
AUD = [
    (1, "usuario", 1, "LOGIN", 0, 8, None, None, "Inicio de sesión de admin"),
    (1, "vehiculo", 17, "CREAR", 12, 9, None, '{"patente":"AP016QQ","marca":"Toyota","modelo":"Corolla"}', "Alta vehículo: Toyota Corolla (AP016QQ)"),
    (1, "chofer", 16, "CREAR", 11, 9, None, '{"nombre":"Natalia","apellido":"Ibarra","dni":"38444555"}', "Alta de chofer: Natalia Ibarra"),
    (3, "mantenimiento", 11, "CREAR", 5, 10, None, '{"tipo_servicio":"Cambio de embrague","estado":"En proceso"}', "Alta de mantenimiento (Cambio de embrague) para vehículo ID: 6"),
    (1, "asignacion_vehiculo", 1, "CREAR", 3, 9, None, '{"patente":"AA001BB","chofer":"Carlos Rodríguez"}', "Asignación del vehículo AA001BB a Carlos Rodríguez"),
    (4, "siniestro", 1, "CREAR", 6, 15, None, '{"ubicacion":"Ruta 9 km 1040","patente":"AH008II"}', "Siniestro registrado en: Ruta 9 km 1040 (vehículo AH008II)"),
    (1, "vehiculo", 2, "EDITAR", 90, 11, '{"estado_actual":"En uso"}', '{"estado_actual":"Baja"}', "Edición de vehículo ID: 2"),
    (2, "chofer", 15, "EDITAR", 20, 16, '{"estado":"Activo"}', '{"estado":"Inactivo"}', "Desactivación de chofer ID: 15"),
    (3, "mantenimiento", 4, "EDITAR", 40, 10, '{"estado":"En proceso"}', '{"estado":"Realizado"}', "Cambio de estado de mantenimiento ID: 4 (En proceso → Realizado)"),
    (1, "herramienta", 14, "EDITAR", 30, 12, '{"estado":"Disponible"}', '{"estado":"Baja"}', "Edición de herramienta ID: 14 (Hormigonera 130L)"),
    (1, "prestamo", 6, "CREAR", 8, 9, None, '{"nombre_operario":"Hernán Quiroga"}', "Préstamo de Cortadora de Césped Naftera a Hernán Quiroga (Espacios Verdes)"),
    (1, "siniestro", 3, "EDITAR_ESTADO", 240, 13, '{"estado":"EN PROCESO"}', '{"estado":"CERRADO"}', "Siniestro ID 3 cambió de EN PROCESO a: CERRADO"),
    (1, "usuario", 6, "EDITAR", 45, 14, '{"activo":true}', '{"activo":false}', "Edición de usuario ID: 6 (ex_empleado)"),
    (None, "usuario", None, "LOGIN_FALLIDO", 2, 22, None, None, 'Usuario inexistente — usuario ingresado: "administrador" (IP 10.0.0.15)'),
    (2, "usuario", 2, "LOGIN_FALLIDO", 2, 22, None, None, 'Contraseña incorrecta — usuario ingresado: "carlos_oficina" (IP 10.0.0.15)'),
    (1, "usuario", 1, "LOGOUT", 0, 18, None, None, "Cierre de sesión"),
]
out.append("-- Auditoría de ejemplo")
filas = []
for i, (u, tab, reg, acc, dias, hora, ant, nue, desc) in enumerate(AUD, 1):
    filas.append((i, u, tab, reg, acc, R(fd(-dias)), f"{hora:02d}:{(i * 7) % 60:02d}:00", ant, nue, desc))
tabla("auditoria", ["id_auditoria", "id_usuario", "tabla_afectada", "id_registro_afectado", "accion", "fecha", "hora", "valor_anterior", "valor_nuevo", "descripcion"], filas)

head = """-- ============================================================================
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

"""
tail = "\nSET FOREIGN_KEY_CHECKS = 1;\n"
sys.stdout.write(head + "\n".join(out) + tail)
