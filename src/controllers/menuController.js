// src/controllers/menuController.js
const { poolPromise } = require("../config/db");

// Get all menus and submenus
const getMenusAndSubmenus = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute("SP_OBTENER_MENUS_Y_SUBMENUS");

    // Transform the result to match the frontend's expected format
    const menus = result.recordset.map((row) => ({
      ID_MENU: row.ID_MENU,
      MENU_NOMBRE: row.MENU_NOMBRE,
      MENU_ICONO: row.MENU_ICONO,
      MENU_URL: row.MENU_URL,
      MENU_ORDEN: row.MENU_ORDEN,
      ID_SUBMENU: row.ID_SUBMENU || null,
      SUBMENU_NOMBRE: row.SUBMENU_NOMBRE || null,
      SUBMENU_ICONO: row.SUBMENU_ICONO || null,
      SUBMENU_URL: row.SUBMENU_URL || null,
      SUBMENU_ORDEN: row.SUBMENU_ORDEN || null,
    }));

    res.status(200).json(menus);
  } catch (error) {
    console.error("Error fetching menus and submenus:", error);
    res.status(500).json({ message: "Error al obtener menús y submenús" });
  }
};

// Create a new menu
const createMenu = async (req, res) => {
  const { nombre, icono, url } = req.body;

  // Basic validation
  if (!nombre) {
    return res.status(400).json({ message: "El nombre del menú es obligatorio" });
  }
  if (!icono) {
    return res.status(400).json({ message: "El ícono del menú es obligatorio" });
  }

  try {
    const pool = await poolPromise;

    // Get the next order number
    const orderResult = await pool
      .request()
      .query("SELECT ISNULL(MAX(ORDEN), 0) + 1 AS newOrder FROM MAE_MENU");
    const newOrder = orderResult.recordset[0].newOrder;

    await pool
      .request()
      .input("NOMBRE", nombre)
      .input("ICONO", icono)
      .input("URL", url || null)
      .input("ORDEN", newOrder)
      .input("ESTADO", 1)
      .execute("SP_INSERTAR_MENU");

    res.status(201).json({ message: "Menú creado correctamente" });
  } catch (error) {
    console.error("Error creating menu:", error);
    res.status(500).json({ message: "Error al crear el menú" });
  }
};

// Create a new submenu
const createSubmenu = async (req, res) => {
  const { nombre, icono, url, idMenu } = req.body;

  // Basic validation
  if (!idMenu) {
    return res.status(400).json({ message: "El ID del menú es obligatorio" });
  }
  if (!nombre) {
    return res.status(400).json({ message: "El nombre del submenú es obligatorio" });
  }
  if (!icono) {
    return res.status(400).json({ message: "El ícono del submenú es obligatorio" });
  }
  if (!url) {
    return res.status(400).json({ message: "La URL del submenú es obligatoria" });
  }

  try {
    const pool = await poolPromise;

    // Verify that the menu exists
    const menuExists = await pool
      .request()
      .input("ID_MENU", idMenu)
      .query("SELECT 1 FROM MAE_MENU WHERE ID_MENU = @ID_MENU AND ESTADO = 1");
    if (menuExists.recordset.length === 0) {
      return res.status(404).json({ message: "El menú especificado no existe" });
    }

    // Get the next order number for the submenu
    const orderResult = await pool
      .request()
      .input("ID_MENU", idMenu)
      .query("SELECT ISNULL(MAX(ORDEN), 0) + 1 AS newOrder FROM MAE_SUBMENU WHERE ID_MENU = @ID_MENU");
    const newOrder = orderResult.recordset[0].newOrder;

    await pool
      .request()
      .input("ID_MENU", idMenu)
      .input("NOMBRE", nombre)
      .input("ICONO", icono)
      .input("URL", url)
      .input("ORDEN", newOrder)
      .input("ESTADO", 1)
      .execute("SP_INSERTAR_SUBMENU");

    res.status(201).json({ message: "Submenú creado correctamente" });
  } catch (error) {
    console.error("Error creating submenu:", error);
    res.status(500).json({ message: "Error al crear el submenú" });
  }
};

// Update submenu order
const updateSubmenuOrder = async (req, res) => {
  const { id } = req.params;
  const { newOrder } = req.body;

  if (!newOrder || newOrder <= 0) {
    return res.status(400).json({ message: "El nuevo orden debe ser un número positivo" });
  }

  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_SUBMENU", id)
      .input("NEW_ORDEN", newOrder)
      .execute("SP_ACTUALIZAR_ORDEN_SUBMENU");

    res.status(200).json({ message: "Orden actualizado correctamente" });
  } catch (error) {
    console.error("Error updating submenu order:", error);
    res.status(500).json({ message: "Error al actualizar el orden" });
  }
};

// Update menu name
const updateMenuName = async (req, res) => {
  const { id } = req.params;
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: "El nombre del menú es obligatorio" });
  }

  try {
    const pool = await poolPromise;

    // Verify that the menu exists
    const menuExists = await pool
      .request()
      .input("ID_MENU", id)
      .query("SELECT 1 FROM MAE_MENU WHERE ID_MENU = @ID_MENU AND ESTADO = 1");
    if (menuExists.recordset.length === 0) {
      return res.status(404).json({ message: "El menú especificado no existe" });
    }

    // Update the menu name
    await pool
      .request()
      .input("ID_MENU", id)
      .input("NOMBRE", nombre)
      .query("UPDATE MAE_MENU SET NOMBRE = @NOMBRE WHERE ID_MENU = @ID_MENU");

    res.status(200).json({ message: "Nombre del menú actualizado correctamente" });
  } catch (error) {
    console.error("Error updating menu name:", error);
    res.status(500).json({ message: "Error al actualizar el nombre del menú" });
  }
};

module.exports = {
  getMenusAndSubmenus,
  createMenu,
  createSubmenu,
  updateSubmenuOrder,
  updateMenuName,
};