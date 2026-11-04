/**
 * sidebar.js
 * 
 * Script del sidebar compartido. Incluirlo al final del <body> en cada vista:
 *   <script src="/js/sidebar.js"></script>
 * 
 * Sólo maneja el sidebar y el overlay. El JS específico de cada vista
 * (paginación, listado de vehículos, etc.) va en el script propio de esa vista.
 */

(function () {
  'use strict';

  /* ── Referencias DOM ─────────────────────────────────── */
  const sidebar      = document.getElementById('sidebar');
  const overlay      = document.getElementById('sidebar-overlay');
  const menuToggle   = document.getElementById('menu-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const appWrapper   = document.getElementById('app-wrapper');

  if (!sidebar || !menuToggle) return; // guard: si la vista no tiene sidebar, salir

  /* ── Helpers ─────────────────────────────────────────── */
  function isMobileOrTablet() { return window.innerWidth < 900; }

  /* ── Persistir estado del sidebar (desktop) ─────────── */
  const SIDEBAR_KEY = 'sidebarCollapsed';

  function saveSidebarState(collapsed) {
    sessionStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }

  function restoreSidebarState() {
    if (isMobileOrTablet()) return;
    if (sessionStorage.getItem(SIDEBAR_KEY) === '1') {
      // Aplicar sin transición para evitar flash
      sidebar.style.transition    = 'none';
      if (appWrapper) appWrapper.style.transition = 'none';

      sidebar.classList.add('sidebar--collapsed');
      if (appWrapper) appWrapper.classList.add('app-wrapper--collapsed');
      menuToggle.setAttribute('aria-expanded', 'false');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          sidebar.style.transition    = '';
          if (appWrapper) appWrapper.style.transition = '';
        });
      });
    }
  }

  /* ── Abrir sidebar ───────────────────────────────────── */
  function openSidebar() {
    sidebar.classList.remove('sidebar--collapsed');
    sidebar.classList.add('sidebar--open');
    if (overlay) overlay.classList.add('sidebar-overlay--visible');
    menuToggle.setAttribute('aria-expanded', 'true');

    if (isMobileOrTablet()) {
      document.body.style.overflow = 'hidden';
    } else {
      if (appWrapper) appWrapper.classList.remove('app-wrapper--collapsed');
      saveSidebarState(false);
    }
  }

  /* ── Cerrar sidebar ──────────────────────────────────── */
  function closeSidebar() {
    sidebar.classList.add('sidebar--collapsed');
    sidebar.classList.remove('sidebar--open');
    if (overlay) overlay.classList.remove('sidebar-overlay--visible');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';

    if (!isMobileOrTablet()) {
      if (appWrapper) appWrapper.classList.add('app-wrapper--collapsed');
      saveSidebarState(true);
    }
  }

  /* ── Toggle con el botón del topbar ──────────────────── */
  menuToggle.addEventListener('click', function () {
    if (isMobileOrTablet()) {
      sidebar.classList.contains('sidebar--open') ? closeSidebar() : openSidebar();
    } else {
      sidebar.classList.contains('sidebar--collapsed') ? openSidebar() : closeSidebar();
    }
  });

  /* ── Botón X dentro del sidebar (mobile) ─────────────── */
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);

  /* ── Overlay (mobile) ────────────────────────────────── */
  if (overlay) overlay.addEventListener('click', closeSidebar);

  /* ── Acordeón submenús ───────────────────────────────── */
  document.querySelectorAll('.sidebar__menu-item--expandable > .sidebar__menu-link')
    .forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var item = this.closest('.sidebar__menu-item--expandable');
        item.classList.toggle('sidebar__menu-item--open');
      });
    });

  /*
   * Nota: los ítems activos ya vienen abiertos desde el servidor
   * (el partial sidebar.ejs agrega sidebar__menu-item--open vía EJS),
   * así que NO necesitamos abrir nada aquí al cargar.
   */

  /* ── Resize: corregir estado al cambiar tamaño ───────── */
  window.addEventListener('resize', function () {
    if (!isMobileOrTablet()) {
      if (!sidebar.classList.contains('sidebar--collapsed') && appWrapper) {
        appWrapper.classList.remove('app-wrapper--collapsed');
      }
      document.body.style.overflow = '';
    } else {
      if (!sidebar.classList.contains('sidebar--open')) {
        sidebar.classList.remove('sidebar--collapsed');
        if (appWrapper) appWrapper.classList.remove('app-wrapper--collapsed');
      }
    }
  });

  /* ── Arranque ────────────────────────────────────────── */
  restoreSidebarState();

})();
