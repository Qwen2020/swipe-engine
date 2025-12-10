/**
 * Webflow Swiper Engine
 * A data-attribute driven Swiper JS wrapper for Webflow
 *
 * Usage: Add data-swiper to your slider container and configure with data-swiper-* attributes
 */

(function() {
  'use strict';

  // Store all Swiper instances for potential external access
  window.WebflowSwipers = window.WebflowSwipers || {};

  /**
   * Convert kebab-case to camelCase
   */
  function kebabToCamel(str) {
    return str.replace(/-([a-z])/g, function(match, letter) {
      return letter.toUpperCase();
    });
  }

  /**
   * Parse a string value to its appropriate type
   */
  function parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'auto') return 'auto';

    // Try to parse as number
    var num = parseFloat(value);
    if (!isNaN(num) && isFinite(value)) {
      return num;
    }

    // Try to parse as JSON (for objects and arrays)
    if ((value.startsWith('{') && value.endsWith('}')) ||
        (value.startsWith('[') && value.endsWith(']'))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        // Return as string if JSON parsing fails
      }
    }

    return value;
  }

  /**
   * Set a nested property on an object using dot notation
   */
  function setNestedProperty(obj, path, value) {
    var parts = path.split('.');
    var current = obj;

    for (var i = 0; i < parts.length - 1; i++) {
      var part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Parse all data-swiper-* attributes from an element
   */
  function parseDataAttributes(element) {
    var config = {};
    var attributes = element.attributes;

    for (var i = 0; i < attributes.length; i++) {
      var attr = attributes[i];

      // Skip the main data-swiper attribute and non-swiper attributes
      if (!attr.name.startsWith('data-swiper-')) continue;

      // Get the option name (remove 'data-swiper-' prefix)
      var optionName = attr.name.substring(12); // 'data-swiper-'.length = 12

      // Convert kebab-case to camelCase, handling dot notation
      var parts = optionName.split('.');
      var camelParts = parts.map(function(part) {
        return kebabToCamel(part);
      });
      var camelName = camelParts.join('.');

      // Parse the value
      var value = parseValue(attr.value);

      // Set the property (supports nested via dot notation)
      if (camelName.includes('.')) {
        setNestedProperty(config, camelName, value);
      } else {
        config[camelName] = value;
      }
    }

    return config;
  }

  /**
   * Find navigation elements within or relative to the swiper container
   */
  function findNavigationElements(container) {
    var nav = {};

    // Look for navigation elements by data attributes
    // First check within the container
    var nextEl = container.querySelector('[data-swiper-button-next]');
    var prevEl = container.querySelector('[data-swiper-button-prev]');
    var paginationEl = container.querySelector('[data-swiper-pagination]');
    var scrollbarEl = container.querySelector('[data-swiper-scrollbar]');

    // If not found in container, check parent and siblings
    var parent = container.parentElement;
    if (parent) {
      if (!nextEl) nextEl = parent.querySelector('[data-swiper-button-next]');
      if (!prevEl) prevEl = parent.querySelector('[data-swiper-button-prev]');
      if (!paginationEl) paginationEl = parent.querySelector('[data-swiper-pagination]');
      if (!scrollbarEl) scrollbarEl = parent.querySelector('[data-swiper-scrollbar]');
    }

    if (nextEl || prevEl) {
      nav.navigation = {
        nextEl: nextEl || null,
        prevEl: prevEl || null
      };
    }

    if (paginationEl) {
      nav.paginationEl = paginationEl;
    }

    if (scrollbarEl) {
      nav.scrollbarEl = scrollbarEl;
    }

    return nav;
  }

  /**
   * Determine which Swiper modules are needed based on config
   */
  function getRequiredModules(config, navElements) {
    var modules = [];

    if (typeof Swiper === 'undefined') return modules;

    // Navigation
    if (config.navigation || navElements.navigation) {
      if (Swiper.Navigation) modules.push(Swiper.Navigation);
    }

    // Pagination
    if (config.pagination || navElements.paginationEl) {
      if (Swiper.Pagination) modules.push(Swiper.Pagination);
    }

    // Scrollbar
    if (config.scrollbar || navElements.scrollbarEl) {
      if (Swiper.Scrollbar) modules.push(Swiper.Scrollbar);
    }

    // Autoplay
    if (config.autoplay) {
      if (Swiper.Autoplay) modules.push(Swiper.Autoplay);
    }

    // Effects
    var effect = config.effect;
    if (effect) {
      if (effect === 'fade' && Swiper.EffectFade) modules.push(Swiper.EffectFade);
      if (effect === 'cube' && Swiper.EffectCube) modules.push(Swiper.EffectCube);
      if (effect === 'coverflow' && Swiper.EffectCoverflow) modules.push(Swiper.EffectCoverflow);
      if (effect === 'flip' && Swiper.EffectFlip) modules.push(Swiper.EffectFlip);
      if (effect === 'cards' && Swiper.EffectCards) modules.push(Swiper.EffectCards);
      if (effect === 'creative' && Swiper.EffectCreative) modules.push(Swiper.EffectCreative);
    }

    // Free Mode
    if (config.freeMode) {
      if (Swiper.FreeMode) modules.push(Swiper.FreeMode);
    }

    // Keyboard
    if (config.keyboard) {
      if (Swiper.Keyboard) modules.push(Swiper.Keyboard);
    }

    // Mousewheel
    if (config.mousewheel) {
      if (Swiper.Mousewheel) modules.push(Swiper.Mousewheel);
    }

    // Parallax
    if (config.parallax) {
      if (Swiper.Parallax) modules.push(Swiper.Parallax);
    }

    // Zoom
    if (config.zoom) {
      if (Swiper.Zoom) modules.push(Swiper.Zoom);
    }

    // Grid
    if (config.grid) {
      if (Swiper.Grid) modules.push(Swiper.Grid);
    }

    // Thumbs
    if (config.thumbs) {
      if (Swiper.Thumbs) modules.push(Swiper.Thumbs);
    }

    // Virtual
    if (config.virtual) {
      if (Swiper.Virtual) modules.push(Swiper.Virtual);
    }

    // A11y (Accessibility) - always include if available
    if (Swiper.A11y) modules.push(Swiper.A11y);

    return modules;
  }

  /**
   * Build the final Swiper configuration
   */
  function buildSwiperConfig(element, userConfig, navElements) {
    // Default configuration optimized for Webflow
    var defaults = {
      slidesPerView: 'auto',
      spaceBetween: 0,
      grabCursor: true,
      watchSlidesProgress: true
    };

    // Merge defaults with user config
    var config = Object.assign({}, defaults, userConfig);

    // Handle navigation
    if (navElements.navigation) {
      if (config.navigation === true || config.navigation === undefined) {
        config.navigation = {};
      }
      if (typeof config.navigation === 'object') {
        if (navElements.navigation.nextEl) {
          config.navigation.nextEl = navElements.navigation.nextEl;
        }
        if (navElements.navigation.prevEl) {
          config.navigation.prevEl = navElements.navigation.prevEl;
        }
      }
    }

    // Handle pagination
    if (navElements.paginationEl) {
      if (config.pagination === true || config.pagination === undefined) {
        config.pagination = {};
      }
      if (typeof config.pagination === 'object') {
        config.pagination.el = navElements.paginationEl;
        // Default to clickable bullets
        if (config.pagination.clickable === undefined) {
          config.pagination.clickable = true;
        }
      }
    }

    // Handle scrollbar
    if (navElements.scrollbarEl) {
      if (config.scrollbar === true || config.scrollbar === undefined) {
        config.scrollbar = {};
      }
      if (typeof config.scrollbar === 'object') {
        config.scrollbar.el = navElements.scrollbarEl;
      }
    }

    // Handle autoplay - convert true to object
    if (config.autoplay === true) {
      config.autoplay = {
        delay: 3000,
        disableOnInteraction: false
      };
    }

    // Handle freeMode - convert true to object
    if (config.freeMode === true) {
      config.freeMode = {
        enabled: true,
        momentum: true
      };
    }

    // Handle keyboard - convert true to object
    if (config.keyboard === true) {
      config.keyboard = {
        enabled: true
      };
    }

    // Handle mousewheel - convert true to object
    if (config.mousewheel === true) {
      config.mousewheel = {
        enabled: true
      };
    }

    // Get required modules
    var modules = getRequiredModules(config, navElements);
    if (modules.length > 0) {
      config.modules = modules;
    }

    return config;
  }

  /**
   * Initialize a single Swiper instance
   */
  function initSwiper(element) {
    // Skip if already initialized
    if (element.swiper) {
      return element.swiper;
    }

    // Parse data attributes
    var userConfig = parseDataAttributes(element);

    // Find navigation elements
    var navElements = findNavigationElements(element);

    // Build final config
    var config = buildSwiperConfig(element, userConfig, navElements);

    // Initialize Swiper
    var swiper = new Swiper(element, config);

    // Store reference
    var id = element.getAttribute('data-swiper') || 'swiper-' + Date.now();
    window.WebflowSwipers[id] = swiper;

    // Bind active state updates for external slide buttons
    bindActiveStateUpdates(swiper, id);

    // Dispatch custom event
    element.dispatchEvent(new CustomEvent('swiperInit', {
      detail: { swiper: swiper, config: config }
    }));

    return swiper;
  }

  /**
   * Initialize all Swipers on the page
   */
  function initAllSwipers() {
    var containers = document.querySelectorAll('[data-swiper]');

    containers.forEach(function(container) {
      try {
        initSwiper(container);
      } catch (error) {
        console.error('Webflow Swiper: Error initializing slider', container, error);
      }
    });
  }

  /**
   * Destroy a Swiper instance by element or ID
   */
  function destroySwiper(elementOrId) {
    var swiper;

    if (typeof elementOrId === 'string') {
      swiper = window.WebflowSwipers[elementOrId];
    } else if (elementOrId.swiper) {
      swiper = elementOrId.swiper;
    }

    if (swiper) {
      swiper.destroy(true, true);
    }
  }

  /**
   * Reinitialize a Swiper (useful after Webflow interactions)
   */
  function reinitSwiper(element) {
    if (element.swiper) {
      element.swiper.destroy(true, true);
    }
    return initSwiper(element);
  }

  /**
   * Handle external control button clicks
   */
  function handleControlClick(event) {
    var button = event.target.closest('[data-swiper-target]');
    if (!button) return;

    var targetId = button.getAttribute('data-swiper-target');
    var swiper = window.WebflowSwipers[targetId];

    if (!swiper) {
      console.warn('Webflow Swiper: No instance found with id "' + targetId + '"');
      return;
    }

    // Check for action (prev/next)
    var action = button.getAttribute('data-swiper-action');
    if (action === 'next') {
      swiper.slideNext();
      return;
    }
    if (action === 'prev') {
      swiper.slidePrev();
      return;
    }

    // Check for slide index
    var slideIndex = button.getAttribute('data-swiper-slide');
    if (slideIndex !== null) {
      swiper.slideTo(parseInt(slideIndex, 10));
      return;
    }
  }

  /**
   * Update active state on slide index buttons
   */
  function updateActiveSlideButtons(swiper, targetId) {
    var buttons = document.querySelectorAll('[data-swiper-target="' + targetId + '"][data-swiper-slide]');
    var activeIndex = swiper.realIndex;

    buttons.forEach(function(button) {
      var buttonIndex = parseInt(button.getAttribute('data-swiper-slide'), 10);
      if (buttonIndex === activeIndex) {
        button.classList.add('is-active');
      } else {
        button.classList.remove('is-active');
      }
    });
  }

  /**
   * Bind slide change events for active state management
   */
  function bindActiveStateUpdates(swiper, targetId) {
    swiper.on('slideChange', function() {
      updateActiveSlideButtons(swiper, targetId);
    });
    // Set initial state
    updateActiveSlideButtons(swiper, targetId);
  }

  /**
   * Initialize external controls event delegation
   */
  function initExternalControls() {
    document.addEventListener('click', handleControlClick);
  }

  // Public API
  window.WebflowSwiper = {
    init: initAllSwipers,
    initOne: initSwiper,
    destroy: destroySwiper,
    reinit: reinitSwiper,
    instances: window.WebflowSwipers
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initAllSwipers();
      initExternalControls();
    });
  } else {
    // DOM already loaded
    initAllSwipers();
    initExternalControls();
  }

  // Re-initialize after Webflow interactions (optional - listens for custom event)
  document.addEventListener('webflow:ready', initAllSwipers);

})();
