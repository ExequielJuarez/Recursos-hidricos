const db = require("../model/database/models");
const { Op } = require("sequelize");
const { esFechaValida } = require("../utils/fechas");

const reporteController = {
    vistaReportes: async (req, res) => {
        try {
            // 1. Capturamos los filtros de fecha
            let fechaDesde = req.query.fechaDesde || '';
            let fechaHasta = req.query.fechaHasta || '';
            if (fechaDesde && !esFechaValida(fechaDesde)) fechaDesde = '';
            if (fechaHasta && !esFechaValida(fechaHasta)) fechaHasta = '';
            if (fechaDesde && fechaHasta && fechaDesde > fechaHasta) {
                [fechaDesde, fechaHasta] = [fechaHasta, fechaDesde];
            }

            // fecha_salida es DATETIME: el rango debe cubrir el día completo de "hasta"
            const desdeDT = new Date(`${fechaDesde}T00:00:00`);
            const hastaDT = new Date(`${fechaHasta}T23:59:59.999`);

            let filtroMantenimiento = { estado: { [Op.ne]: 'Cancelado' } }; // las órdenes canceladas no cuentan
            let filtroAsignacion = {};

            if (fechaDesde && fechaHasta) {
                filtroMantenimiento.fecha_inicio = { [Op.between]: [fechaDesde, fechaHasta] };
                filtroAsignacion.fecha_salida = { [Op.between]: [desdeDT, hastaDT] };
            } else if (fechaDesde) {
                filtroMantenimiento.fecha_inicio = { [Op.gte]: fechaDesde };
                filtroAsignacion.fecha_salida = { [Op.gte]: desdeDT };
            } else if (fechaHasta) {
                filtroMantenimiento.fecha_inicio = { [Op.lte]: fechaHasta };
                filtroAsignacion.fecha_salida = { [Op.lte]: hastaDT };
            }

            // 2. Inicializamos las estructuras de datos que piden los gráficos
            let costoTotal = 0;
            let topVehiculos = [];
            let viajesPorDestino = [];
            let mantPorTipo = [];

            // 3. Procesamos Mantenimientos (Suma de Costos, Top Vehículos y Tipos de Servicio)
            if (db.Mantenimiento && db.Vehiculo) {
                try {
                    const mantenimientos = await db.Mantenimiento.findAll({ where: filtroMantenimiento });
                    const vehiculos = await db.Vehiculo.findAll();
                    
                    // Armamos un diccionario rápido para saber qué patente tiene cada vehículo
                    const dictVehiculos = {};
                    vehiculos.forEach(v => { dictVehiculos[v.id_vehiculo] = v.patente; });

                    let gastosPorPatente = {};
                    let conteoServicios = {};

                    mantenimientos.forEach(m => {
                        // Sumamos el Costo Total General
                        costoTotal += Number(m.costo_total || 0);

                        // Agrupamos el gasto por Patente (para el gráfico de barras rojas)
                        const patente = dictVehiculos[m.id_vehiculo] || 'Desc.';
                        if (!gastosPorPatente[patente]) gastosPorPatente[patente] = 0;
                        gastosPorPatente[patente] += Number(m.costo_total || 0);

                        // Agrupamos la cantidad por Tipo de Servicio (para el gráfico de barras horizontales)
                        const tipo = m.tipo_servicio || 'Otros';
                        if (!conteoServicios[tipo]) conteoServicios[tipo] = 0;
                        conteoServicios[tipo]++;
                    });

                    // Transformamos las agrupaciones en las listas que necesita Chart.js y ordenamos de mayor a menor
                    topVehiculos = Object.keys(gastosPorPatente).map(patente => {
                        return { vehiculo: { patente: patente }, total_gastado: gastosPorPatente[patente] };
                    }).sort((a, b) => b.total_gastado - a.total_gastado).slice(0, 5); // Solo los top 5

                    mantPorTipo = Object.keys(conteoServicios).map(tipo => {
                        return { tipo_servicio: tipo, cantidad: conteoServicios[tipo] };
                    }).sort((a, b) => b.cantidad - a.cantidad);

                } catch (e) {
                    console.log("Error procesando mantenimientos:", e.message);
                }
            }

            // 4. Procesamos Asignaciones (Para el gráfico circular de Viajes por Destino)
            // Escaneamos el nombre exacto del modelo por si tiene mayúsculas diferentes
            const ModeloAsignacion = db.AsignacionVehiculo || db.Asignacion_Vehiculo || db.Asignacion_vehiculo || db.Asignacion;
            
            if (ModeloAsignacion) {
                try {
                    const viajes = await ModeloAsignacion.findAll({ where: filtroAsignacion });
                    let conteoDestinos = {};

                    viajes.forEach(v => {
                        const destino = v.destino_area || 'Sin especificar';
                        if (!conteoDestinos[destino]) conteoDestinos[destino] = 0;
                        conteoDestinos[destino]++;
                    });

                    viajesPorDestino = Object.keys(conteoDestinos).map(destino => {
                        return { destino_area: destino, cantidad_viajes: conteoDestinos[destino] };
                    }).sort((a, b) => b.cantidad_viajes - a.cantidad_viajes);

                } catch (e) {
                    console.log("Error procesando asignaciones:", e.message);
                }
            }

            // 5. Empaquetamos toda la información final
            const estadisticas = {
                costoTotal: costoTotal,
                topVehiculos: topVehiculos,
                viajesPorDestino: viajesPorDestino,
                mantPorTipo: mantPorTipo
            };

            // 6. ¡Lo enviamos a la pantalla!
            res.render("ReportesBI", {
                fechaDesde: fechaDesde,
                fechaHasta: fechaHasta,
                estadisticas: estadisticas
            }); 
            
        } catch (error) {
            console.error("Error general en Reportes:", error);
            req.flash("error", "Error interno al generar el reporte.");
            res.redirect("/Vehicles");
        }
    }
};

module.exports = reporteController;