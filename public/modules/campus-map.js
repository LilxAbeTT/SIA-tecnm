if (!window.CampusMap) {
  window.CampusMap = (function () {
    let _ctx = null;
    let _root = null;
    let _rootClickHandler = null;
    let _currentViewId = null;
    let _selectedBuildingId = window.CampusMapData?.defaultBuildingId || 'D';

    function getData() {
      return window.CampusMapData || { buildings: [], byId: {}, image: {}, defaultBuildingId: 'D' };
    }

    function esc(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function isPublicView(viewId) {
      return viewId === 'view-campus-map-public';
    }

    function getRootForView(viewId) {
      return document.getElementById(viewId);
    }

    function getSelectedBuilding() {
      const data = getData();
      return data.byId[_selectedBuildingId] || data.byId[data.defaultBuildingId] || data.buildings[0] || null;
    }

    function getBuildingsWithHotspot() {
      return getData().buildings.filter(function (building) {
        return building.hotspot && Number.isFinite(Number(building.hotspot.x)) && Number.isFinite(Number(building.hotspot.y));
      });
    }

    function getBackLabel() {
      return isPublicView(_currentViewId) ? 'Volver al inicio' : 'Volver al dashboard';
    }

    function setSelectedBuilding(buildingId, shouldScroll) {
      if (!getData().byId[buildingId]) return;
      _selectedBuildingId = buildingId;
      render();

      if (!shouldScroll || window.innerWidth >= 992 || !_root) return;
      const panel = _root.querySelector('[data-campus-detail]');
      if (!panel) return;
      window.setTimeout(function () {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 90);
    }

    function navigateBack() {
      if (!isPublicView(_currentViewId) && typeof window.SIA?.navigate === 'function') {
        window.SIA.navigate('view-dashboard');
        return;
      }

      if (window.location.hash) {
        window.location.hash = '#/';
        return;
      }

      window.location.assign('/');
    }

    function syncBreadcrumb() {
      if (_currentViewId !== 'view-campus-map') return;
      const building = getSelectedBuilding();
      const label = building ? building.title : 'Mapa del campus';
      window.SIA?.setBreadcrumbSection?.('view-campus-map', label, { moduleClickable: false });
    }

    function renderHotspots(selectedBuilding) {
      return getBuildingsWithHotspot()
        .map(function (building) {
          const active = building.id === selectedBuilding.id;
          const color = building.color || '#1b396a';
          const textColor = building.textColor || '#ffffff';
          const label = building.shortLabel || building.code || '';
          const isWide = String(label).length > 2;

          return (
            '<button type="button" class="campus-map__hotspot ' +
            (isWide ? 'campus-map__hotspot--wide ' : '') +
            (active ? 'is-active' : '') +
            '" data-action="select-building" data-building-id="' +
            esc(building.id) +
            '" aria-label="Abrir informacion de ' +
            esc(building.title) +
            '" style="left:' +
            Number(building.hotspot.x).toFixed(2) +
            '%;top:' +
            Number(building.hotspot.y).toFixed(2) +
            '%;--campus-hotspot-color:' +
            esc(color) +
            ';--campus-hotspot-text:' +
            esc(textColor) +
            ';">' +
            '<span>' +
            esc(label) +
            '</span>' +
            '</button>'
          );
        })
        .join('');
    }

    function renderCards(selectedBuilding) {
      return (selectedBuilding.cards || [])
        .map(function (card) {
          const items = (card.items || [])
            .map(function (item) {
              return '<li>' + esc(item) + '</li>';
            })
            .join('');

          return (
            '<section class="campus-map__detail-card">' +
            '<h3>' +
            esc(card.title) +
            '</h3>' +
            '<ul>' +
            items +
            '</ul>' +
            '</section>'
          );
        })
        .join('');
    }

    function renderServices(selectedBuilding) {
      if (!selectedBuilding.featuredServices || !selectedBuilding.featuredServices.length) {
        return '';
      }

      return (
        '<section class="campus-map__detail-card campus-map__detail-card--accent">' +
        '<h3>Servicios destacados</h3>' +
        '<ul>' +
        selectedBuilding.featuredServices
          .map(function (item) {
            return '<li>' + esc(item) + '</li>';
          })
          .join('') +
        '</ul>' +
        '</section>'
      );
    }

    function renderBadges(selectedBuilding) {
      return (selectedBuilding.badges || [])
        .map(function (badge) {
          return '<span>' + esc(badge) + '</span>';
        })
        .join('');
    }

    function render() {
      if (!_root) return;

      const data = getData();
      const selectedBuilding = getSelectedBuilding();
      if (!selectedBuilding) return;

      _root.innerHTML =
        '<section class="campus-map-page ' +
        (isPublicView(_currentViewId) ? 'campus-map-page--public' : 'campus-map-page--app') +
        '">' +
        '<div class="campus-map-page__hero">' +
        '<h1>Mapa del campus</h1>' +
        '<div class="campus-map-page__actions">' +
        '<button type="button" class="btn btn-outline-primary rounded-pill px-4 fw-semibold" data-action="go-back">' +
        '<i class="bi bi-arrow-left me-2"></i>' +
        esc(getBackLabel()) +
        '</button>' +
        '</div>' +
        '</div>' +
        '<div class="campus-map-layout">' +
        '<article class="campus-map-stage">' +
        '<div class="campus-map-figure-card">' +
        '<div class="campus-map-figure">' +
        '<img src="' +
        esc(data.image.src || '') +
        '" alt="' +
        esc(data.image.alt || '') +
        '" class="campus-map-figure__image">' +
        '<div class="campus-map-figure__overlay">' +
        renderHotspots(selectedBuilding) +
        '</div>' +
        '</div>' +
        '</div>' +
        '</article>' +
        '<aside class="campus-map-detail" data-campus-detail>' +
        '<div class="campus-map-detail__body">' +
        '<section class="campus-map-detail__hero">' +
        '<p class="campus-map-detail__eyebrow filter-white">' +
        esc(selectedBuilding.stripLabel || selectedBuilding.title) +
        '</p>' +
        '<h2>' +
        esc(selectedBuilding.title) +
        '</h2>' +
        '<p class="campus-map-detail__zone">' +
        esc(selectedBuilding.zone || 'Campus ITES Los Cabos') +
        '</p>' +
        '<p class="campus-map-detail__summary">' +
        esc(selectedBuilding.summary || '') +
        '</p>' +
        '<div class="campus-map-detail__badges">' +
        renderBadges(selectedBuilding) +
        '</div>' +
        '</section>' +
        '<div class="campus-map-detail__grid">' +
        renderCards(selectedBuilding) +
        '</div>' +
        renderServices(selectedBuilding) +
        '</div>' +
        '</aside>' +
        '</div>' +
        '</section>';

      syncBreadcrumb();
    }

    function bindRoot(root) {
      if (_root === root && _rootClickHandler) return;

      if (_root && _rootClickHandler) {
        _root.removeEventListener('click', _rootClickHandler);
      }

      _root = root;
      _rootClickHandler = function (event) {
        const trigger = event.target.closest('[data-action]');
        if (!trigger) return;

        const action = trigger.dataset.action;

        if (action === 'select-building') {
          setSelectedBuilding(trigger.dataset.buildingId, true);
          return;
        }

        if (action === 'go-back') {
          navigateBack();
        }
      };

      _root.addEventListener('click', _rootClickHandler);
    }

    function init(ctx, options) {
      _ctx = ctx || _ctx;
      _currentViewId = options?.viewId || _currentViewId || 'view-campus-map';

      const root = getRootForView(_currentViewId);
      if (!root) return;

      if (!getData().byId[_selectedBuildingId]) {
        _selectedBuildingId = getData().defaultBuildingId;
      }

      bindRoot(root);
      render();
    }

    return {
      init: init,
      selectBuilding: function (buildingId) {
        setSelectedBuilding(buildingId, false);
      },
      getSelectedBuildingId: function () {
        return _selectedBuildingId;
      },
    };
  })();
}
