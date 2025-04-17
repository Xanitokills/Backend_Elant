const sql = require("mssql");
const { poolPromise } = require("../config/db");

const getMenusAndSubmenus = async (req, res) => {
  try {
    console.log("Accessing database pool...");
    const pool = await poolPromise;
    console.log("Pool obtained. Executing SP_OBTENER_MENUS_Y_SUBMENUS...");
    const result = await pool.request().execute("SP_OBTENER_MENUS_Y_SUBMENUS");
    console.log("Procedure executed. Recordset:", result.recordset);
    const menus = result.recordset.map((row) => ({
      ID_MENU: row.ID_MENU,
      MENU_NOMBRE: row.MENU_NOMBRE,
      MENU_ICONO: row.MENU_ICONO,
      MENU_URL: row.MENU_URL,
      MENU_ORDEN: row.MENU_ORDEN,
      ID_SUBMENU: row.ID_SUBMENU,
      SUBMENU_NOMBRE: row.SUBMENU_NOMBRE,
      SUBMENU_ICONO: row.SUBMENU_ICONO,
      SUBMENU_URL: row.SUBMENU_URL,
      SUBMENU_ORDEN: row.SUBMENU_ORDEN,
    }));
    console.log("Sending response:", menus);
    res.json(menus);
  } catch (err) {
    console.error("Error in getMenusAndSubmenus:", err);
    res.status(500).json({
      message: "Error al obtener menús y submenús",
      error: err.message,
    });
  }
};

const createMenu = async (req, res) => {
  const { nombre, icono, url } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("NOMBRE", sql.VarChar(50), nombre)
      .input("ICONO", sql.VarChar(50), icono)
      .input("URL", sql.VarChar(100), url || null)
      .execute("SP_INSERTAR_MENU");
    res.status(201).json({ message: "Menú creado correctamente" });
  } catch (err) {
    console.error("Error in createMenu:", err);
    res
      .status(500)
      .json({ message: "Error al crear menú", error: err.message });
  }
};

const updateMenu = async (req, res) => {
  const { id } = req.params;
  const { nombre, icono, url } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_MENU", sql.Int, id)
      .input("NOMBRE", sql.VarChar(50), nombre)
      .input("ICONO", sql.VarChar(50), icono)
      .input("URL", sql.VarChar(100), url || null)
      .execute("SP_ACTUALIZAR_MENU");
    res.json({ message: "Menú actualizado correctamente" });
  } catch (err) {
    console.error("Error in updateMenu:", err);
    res
      .status(500)
      .json({ message: "Error al actualizar menú", error: err.message });
  }
};

const createSubmenu = async (req, res) => {
  const { nombre, icono, url, idMenu } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_MENU", sql.Int, idMenu)
      .input("NOMBRE", sql.VarChar(50), nombre)
      .input("ICONO", sql.VarChar(50), icono)
      .input("URL", sql.VarChar(100), url)
      .execute("SP_INSERTAR_SUBMENU");
    res.status(201).json({ message: "Submenú creado correctamente" });
  } catch (err) {
    console.error("Error in createSubmenu:", err);
    res
      .status(500)
      .json({ message: "Error al crear submenú", error: err.message });
  }
};

const updateSubmenu = async (req, res) => {
  const { id } = req.params;
  const { nombre, icono, url } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_SUBMENU", sql.Int, id)
      .input("NOMBRE", sql.VarChar(50), nombre)
      .input("ICONO", sql.VarChar(50), icono)
      .input("URL", sql.VarChar(100), url)
      .execute("SP_ACTUALIZAR_SUBMENU");
    res.json({ message: "Submenú actualizado correctamente" });
  } catch (err) {
    console.error("Error in updateSubmenu:", err);
    res
      .status(500)
      .json({ message: "Error al actualizar submenú", error: err.message });
  }
};

const updateSubmenuOrder = async (req, res) => {
  const { id } = req.params;
  const { newOrder } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_SUBMENU", sql.Int, id)
      .input("NEW_ORDEN", sql.Int, newOrder)
      .execute("SP_ACTUALIZAR_ORDEN_SUBMENU");
    res.json({ message: "Orden actualizado correctamente" });
  } catch (err) {
    console.error("Error in updateSubmenuOrder:", err);
    res
      .status(500)
      .json({ message: "Error al actualizar orden", error: err.message });
  }
};

const deleteSubmenu = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_SUBMENU", sql.Int, id)
      .execute("SP_ELIMINAR_SUBMENU");
    res.json({ message: "Submenú eliminado correctamente" });
  } catch (err) {
    console.error("Error in deleteSubmenu:", err);
    res
      .status(500)
      .json({ message: "Error al eliminar submenú", error: err.message });
  }
};

const getTiposUsuario = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query(
        "SELECT ID_TIPO_USUARIO, DETALLE_USUARIO, ESTADO FROM MAE_TIPO_USUARIO"
      );
    const tiposUsuario = result.recordset.map((row) => ({
      ID_TIPO_USUARIO: row.ID_TIPO_USUARIO,
      DETALLE_USUARIO: row.DETALLE_USUARIO,
      ESTADO: row.ESTADO,
    }));
    res.json(tiposUsuario);
  } catch (err) {
    console.error("Error in getTiposUsuario:", err);
    res.status(500).json({
      message: "Error al obtener tipos de usuario",
      error: err.message,
    });
  }
};

const assignMenuToRole = async (req, res) => {
  const { idTipoUsuario, idMenu } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_TIPO_USUARIO", sql.Int, idTipoUsuario)
      .input("ID_MENU", sql.Int, idMenu)
      .execute("SP_INSERTAR_ROL_MENU");
    res.json({ message: "Menú asignado correctamente", refreshSidebar: true });
  } catch (err) {
    console.error("Error in assignMenuToRole:", err);
    res
      .status(500)
      .json({ message: "Error al asignar menú", error: err.message });
  }
};

const removeMenuFromRole = async (req, res) => {
  const { idTipoUsuario, idMenu } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_TIPO_USUARIO", sql.Int, idTipoUsuario)
      .input("ID_MENU", sql.Int, idMenu)
      .execute("SP_ELIMINAR_ROL_MENU");
    res.json({
      message: "Asignación de menú eliminada correctamente",
      refreshSidebar: true,
    });
  } catch (err) {
    console.error("Error in removeMenuFromRole:", err);
    res.status(500).json({
      message: "Error al eliminar asignación de menú",
      error: err.message,
    });
  }
};

const assignSubmenuToRole = async (req, res) => {
  const { idTipoUsuario, idSubmenu } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_TIPO_USUARIO", sql.Int, idTipoUsuario)
      .input("ID_SUBMENU", sql.Int, idSubmenu)
      .execute("SP_INSERTAR_ROL_SUBMENU");
    res.json({
      message: "Submenú asignado correctamente",
      refreshSidebar: true,
    });
  } catch (err) {
    console.error("Error in assignSubmenuToRole:", err);
    res
      .status(500)
      .json({ message: "Error al asignar submenú", error: err.message });
  }
};

const removeSubmenuFromRole = async (req, res) => {
  const { idTipoUsuario, idSubmenu } = req.body;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .input("ID_TIPO_USUARIO", sql.Int, idTipoUsuario)
      .input("ID_SUBMENU", sql.Int, idSubmenu)
      .execute("SP_ELIMINAR_ROL_SUBMENU");
    res.json({
      message: "Asignación de submenú eliminada correctamente",
      refreshSidebar: true,
    });
  } catch (err) {
    console.error("Error in removeSubmenuFromRole:", err);
    res.status(500).json({
      message: "Error al eliminar asignación de submenú",
      error: err.message,
    });
  }
};

const getMenuSubmenuAssignments = async (req, res) => {
  const { idTipoUsuario } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ID_TIPO_USUARIO", sql.Int, idTipoUsuario).query(`
        SELECT 
          rm.ID_MENU AS ASSIGNED_MENU_ID,
          rs.ID_SUBMENU AS ASSIGNED_SUBMENU_ID
        FROM MAE_ROL_MENU rm
        FULL OUTER JOIN MAE_ROL_SUBMENU rs
          ON rm.ID_TIPO_USUARIO = rs.ID_TIPO_USUARIO
        WHERE rm.ID_TIPO_USUARIO = @ID_TIPO_USUARIO 
          OR rs.ID_TIPO_USUARIO = @ID_TIPO_USUARIO
      `);

    const assignments = {
      menus: result.recordset
        .filter((row) => row.ASSIGNED_MENU_ID !== null)
        .map((row) => row.ASSIGNED_MENU_ID),
      submenus: result.recordset
        .filter((row) => row.ASSIGNED_SUBMENU_ID !== null)
        .map((row) => row.ASSIGNED_SUBMENU_ID),
    };

    res.json(assignments);
  } catch (err) {
    console.error("Error in getMenuSubmenuAssignments:", err);
    res
      .status(500)
      .json({ message: "Error al obtener asignaciones", error: err.message });
  }
};

module.exports = {
  getMenusAndSubmenus,
  createMenu,
  updateMenu,
  createSubmenu,
  updateSubmenu,
  updateSubmenuOrder,
  deleteSubmenu,
  getTiposUsuario,
  assignMenuToRole,
  removeMenuFromRole,
  assignSubmenuToRole,
  removeSubmenuFromRole,
  getMenuSubmenuAssignments,
};
