// src/controllers/menuController.js
const { poolPromise } = require("../config/db");

// Obtener todos los menús y submenús
const getMenusAndSubmenus = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("SP_OBTENER_MENUS_Y_SUBMENUS");
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error al obtener menús y submenús:", error);
    res.status(500).json({ message: "Error al obtener datos", error });
  }
};

// Insertar menú
const insertMenu = async (req, res) => {
  const { nombre, icono, url } = req.body;
  try {
    const pool = await poolPromise;
    const maxResult = await pool
      .request()
      .query("SELECT ISNULL(MAX(ORDEN), 0) + 1 AS nuevoOrden FROM MAE_MENU");
    const orden = maxResult.recordset[0].nuevoOrden;

    await pool
      .request()
      .input("NOMBRE", nombre)
      .input("ICONO", icono)
      .input("URL", url)
      .input("ORDEN", orden)
      .input("ESTADO", 1)
      .execute("SP_INSERTAR_MENU");

    res.status(200).json({ message: "Menú insertado correctamente" });
  } catch (error) {
    console.error("Error al insertar menú:", error);
    res.status(500).json({ message: "Error al insertar menú", error });
  }
};

// Insertar submenú
const insertSubmenu = async (req, res) => {
  const { idMenu, nombre, icono, url } = req.body;
  try {
    const pool = await poolPromise;
    const maxResult = await pool
      .request()
      .input("ID_MENU", idMenu)
      .query(
        "SELECT ISNULL(MAX(ORDEN), 0) + 1 AS nuevoOrden FROM MAE_SUBMENU WHERE ID_MENU = @ID_MENU"
      );

    const orden = maxResult.recordset[0].nuevoOrden;

    await pool
      .request()
      .input("ID_MENU", idMenu)
      .input("NOMBRE", nombre)
      .input("ICONO", icono)
      .input("URL", url)
      .input("ORDEN", orden)
      .input("ESTADO", 1)
      .execute("SP_INSERTAR_SUBMENU");

    res.status(200).json({ message: "Submenú insertado correctamente" });
  } catch (error) {
    console.error("Error al insertar submenú:", error);
    res.status(500).json({ message: "Error al insertar submenú", error });
  }
};

// Cambiar orden del submenú
const changeSubmenuOrder = async (req, res) => {
  const { id, direction } = req.params;
  try {
    const pool = await poolPromise;
    const submenus = await pool
      .request()
      .query("SELECT * FROM MAE_SUBMENU WHERE ESTADO = 1 ORDER BY ORDEN");
    const index = submenus.recordset.findIndex(
      (s) => s.ID_SUBMENU === parseInt(id)
    );

    if (index === -1)
      return res.status(404).json({ message: "Submenú no encontrado" });

    const current = submenus.recordset[index];
    const target =
      direction === "up"
        ? submenus.recordset[index - 1]
        : submenus.recordset[index + 1];

    if (!target)
      return res
        .status(400)
        .json({ message: "No se puede mover en esa dirección" });

    // Intercambiar ordenes
    await pool.request().query(`UPDATE MAE_SUBMENU SET ORDEN = CASE
                WHEN ID_SUBMENU = ${current.ID_SUBMENU} THEN ${target.ORDEN}
                WHEN ID_SUBMENU = ${target.ID_SUBMENU} THEN ${current.ORDEN}
              END
              WHERE ID_SUBMENU IN (${current.ID_SUBMENU}, ${target.ID_SUBMENU})`);

    res.status(200).json({ message: "Orden actualizado correctamente" });
  } catch (error) {
    console.error("Error al cambiar orden:", error);
    res.status(500).json({ message: "Error al cambiar orden", error });
  }
};

// Cambiar orden hacia arriba
const moveSubmenuUp = async (req, res) => {
  req.params.direction = "up";
  return changeSubmenuOrder(req, res);
};

// Cambiar orden hacia abajo
const moveSubmenuDown = async (req, res) => {
  req.params.direction = "down";
  return changeSubmenuOrder(req, res);
};

module.exports = {
  getMenusAndSubmenus,
  insertMenu,
  insertSubmenu,
  changeSubmenuOrder, // si la usas en otras partes
  moveSubmenuUp,
  moveSubmenuDown,
};
