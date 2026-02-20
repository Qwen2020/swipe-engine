/**
 * Swiper Engine v1.0.0
 * Vanilla JS wrapper around Swiper JS for Webflow projects.
 * Configure Swiper instances entirely through `se-*` HTML attributes.
 */
(function () {
  "use strict";

  // --- Debug ---
  var debug = /[?&]se-debug=true/.test(window.location.search);

  function log() {
    if (!debug) return;
    var args = ["%c[SwiperEngine]", "color:#6366f1;font-weight:bold;"];
    args.push.apply(args, arguments);
    console.log.apply(console, args);
  }

  function warn() {
    if (!debug) return;
    var args = ["[SwiperEngine]"];
    args.push.apply(args, arguments);
    console.warn.apply(console, args);
  }

  function error() {
    var args = ["[SwiperEngine]"];
    args.push.apply(args, arguments);
    console.error.apply(console, args);
  }

  // --- Guard: Swiper must exist ---
  if (typeof window.Swiper !== "function") {
    error(
      "Swiper is not loaded. Include swiper-bundle.js before swiper-engine.js"
    );
    return;
  }

  // --- Registry ---
  var registry = {}; // name → { swipers: [], controls: [] }

  // --- Attribute parsing helpers ---

  var KNOWN_MODULE_PREFIXES = [
    "autoplay",
    "free-mode",
    "keyboard",
    "mousewheel",
    "fade",
    "coverflow",
    "cube",
    "flip",
    "cards",
    "creative",
    "grid",
    "pagination",
    "scrollbar",
  ];

  /** Convert kebab-case to camelCase */
  function camel(str) {
    return str.replace(/-([a-z])/g, function (_, c) {
      return c.toUpperCase();
    });
  }

  /** Parse an attribute value into its JS type */
  function parseValue(val) {
    if (val === "" || val === "true") return true;
    if (val === "false") return false;
    if (!isNaN(val) && val !== "") return Number(val);
    return val;
  }

  /** Direct attribute → Swiper config key mappings (kebab → camel) */
  var DIRECT_ATTRS = [
    "speed",
    "direction",
    "loop",
    "rewind",
    "grab-cursor",
    "centered-slides",
    "slide-to-clicked-slide",
    "auto-height",
    "space-between",
    "initial-slide",
    "css-mode",
    "effect",
    "a11y",
    "parallax",
    "slides-per-view",
    "slides-per-group",
    "allow-touch-move",
  ];

  /**
   * Parse all se-* attributes on a container into a Swiper config object.
   */
  function parseAttributes(el) {
    var config = {};
    var moduleConfigs = {}; // prefix → { option: value }
    var attrs = el.attributes;

    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name;
      if (name.indexOf("se-") !== 0) continue;

      var key = name.slice(3); // strip "se-"
      if (key === "swiper-instances") continue; // instance name, not config

      var val = parseValue(attrs[i].value);

      // Check if it's a direct attribute
      if (DIRECT_ATTRS.indexOf(key) !== -1) {
        config[camel(key)] = val;
        continue;
      }

      // Check for known module prefix
      var matched = false;
      for (var j = 0; j < KNOWN_MODULE_PREFIXES.length; j++) {
        var prefix = KNOWN_MODULE_PREFIXES[j];
        if (key === prefix) {
          // Bare module attribute, e.g. se-autoplay, se-free-mode
          moduleConfigs[prefix] = moduleConfigs[prefix] || {};
          moduleConfigs[prefix].__bare = val;
          matched = true;
          break;
        }
        if (key.indexOf(prefix + "-") === 0) {
          var sub = key.slice(prefix.length + 1); // e.g. "delay" from "autoplay-delay"
          moduleConfigs[prefix] = moduleConfigs[prefix] || {};
          moduleConfigs[prefix][camel(sub)] = val;
          matched = true;
          break;
        }
      }

      if (!matched) {
        warn("Unknown attribute: se-" + key);
      }
    }

    // Merge module configs into main config
    for (var prefix in moduleConfigs) {
      var camelPrefix = camel(prefix);
      var mod = moduleConfigs[prefix];

      if (mod.__bare !== undefined) {
        var bare = mod.__bare;
        delete mod.__bare;
        // If there are sub-options, use object form
        if (Object.keys(mod).length > 0) {
          config[camelPrefix] = mod;
        } else {
          // Bare boolean/value only
          config[camelPrefix] = bare;
        }
      } else {
        // Only sub-options, build object
        config[camelPrefix] = mod;
      }
    }

    return config;
  }

  // --- Control parsing ---

  function collectControls() {
    var controlMap = {}; // instanceName → ControlDef[]
    var els = document.querySelectorAll("[se-control]");

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var type = el.getAttribute("se-control");
      var target = el.getAttribute("se-target");

      if (!target) {
        warn("Control has no se-target attribute, skipping:", el);
        continue;
      }

      if (!controlMap[target]) controlMap[target] = [];
      controlMap[target].push({
        el: el,
        type: type,
        slideIndex:
          type === "slide-to" ? parseInt(el.getAttribute("se-slide"), 10) : null,
      });
    }

    return controlMap;
  }

  // --- Wire controls to swiper instances ---

  function bindControls(name, entry) {
    var swipers = entry.swipers;
    var controls = entry.controls;

    for (var i = 0; i < controls.length; i++) {
      var ctrl = controls[i];
      bindSingleControl(name, ctrl, swipers);
    }

    // Listen to slideChange on each swiper to update control states
    for (var s = 0; s < swipers.length; s++) {
      (function (swiper) {
        swiper.on("slideChange", function () {
          updateControlStates(name, entry);
        });
        swiper.on("progress", function () {
          updateProgress(entry);
        });
        swiper.on("autoplayStart", function () {
          updatePlayPauseStates(entry, true);
        });
        swiper.on("autoplayStop", function () {
          updatePlayPauseStates(entry, false);
        });
      })(swipers[s]);
    }

    // Initial state
    updateControlStates(name, entry);
    updateProgress(entry);
  }

  function bindSingleControl(name, ctrl, swipers) {
    switch (ctrl.type) {
      case "next":
        ctrl.el.addEventListener("click", function () {
          for (var i = 0; i < swipers.length; i++) swipers[i].slideNext();
        });
        break;

      case "prev":
        ctrl.el.addEventListener("click", function () {
          for (var i = 0; i < swipers.length; i++) swipers[i].slidePrev();
        });
        break;

      case "play":
        ctrl.el.addEventListener("click", function () {
          for (var i = 0; i < swipers.length; i++) {
            if (swipers[i].autoplay) swipers[i].autoplay.start();
          }
        });
        break;

      case "pause":
        ctrl.el.addEventListener("click", function () {
          for (var i = 0; i < swipers.length; i++) {
            if (swipers[i].autoplay) swipers[i].autoplay.stop();
          }
        });
        break;

      case "play-pause":
        ctrl.el.addEventListener("click", function () {
          for (var i = 0; i < swipers.length; i++) {
            var sw = swipers[i];
            if (!sw.autoplay) continue;
            if (sw.autoplay.running) {
              sw.autoplay.stop();
            } else {
              sw.autoplay.start();
            }
          }
        });
        break;

      case "slide-to":
        (function (index) {
          ctrl.el.addEventListener("click", function () {
            for (var i = 0; i < swipers.length; i++) {
              swipers[i].slideTo(index);
            }
          });
        })(ctrl.slideIndex);
        break;

      case "pagination":
      case "scrollbar":
      case "progress":
        // Handled during init or via event subscriptions
        break;

      default:
        warn('Unknown control type "' + ctrl.type + '" on', ctrl.el);
    }
  }

  function updateControlStates(name, entry) {
    var swipers = entry.swipers;
    var controls = entry.controls;
    if (!swipers.length) return;
    var first = swipers[0];

    for (var i = 0; i < controls.length; i++) {
      var ctrl = controls[i];

      if (ctrl.type === "prev") {
        if (!first.params.loop && !first.params.rewind) {
          ctrl.el.classList.toggle("se-disabled", first.isBeginning);
        } else {
          ctrl.el.classList.remove("se-disabled");
        }
      }

      if (ctrl.type === "next") {
        if (!first.params.loop && !first.params.rewind) {
          ctrl.el.classList.toggle("se-disabled", first.isEnd);
        } else {
          ctrl.el.classList.remove("se-disabled");
        }
      }

      if (ctrl.type === "slide-to") {
        ctrl.el.classList.toggle(
          "se-active",
          first.realIndex === ctrl.slideIndex
        );
      }
    }
  }

  function updateProgress(entry) {
    var swipers = entry.swipers;
    var controls = entry.controls;
    if (!swipers.length) return;
    var progress = swipers[0].progress;

    for (var i = 0; i < controls.length; i++) {
      if (controls[i].type === "progress") {
        controls[i].el.style.setProperty(
          "--se-progress",
          Math.min(1, Math.max(0, progress))
        );
      }
    }
  }

  function updatePlayPauseStates(entry, playing) {
    for (var i = 0; i < entry.controls.length; i++) {
      var ctrl = entry.controls[i];
      if (ctrl.type === "play-pause") {
        ctrl.el.classList.toggle("se-playing", playing);
        ctrl.el.classList.toggle("se-paused", !playing);
      }
    }
  }

  // --- Class detection ---

  /**
   * Detect wrapper and slide classes from the container's existing class
   * naming convention. E.g. container "card-slider" → wrapper
   * "card-slider_list", slides "card-slider_slide".
   *
   * Returns { wrapperClass, slideClass } or null if using Swiper defaults.
   */
  function detectClasses(el) {
    var wrapper = el.firstElementChild;
    if (!wrapper) {
      warn("No child element found as wrapper:", el);
      return null;
    }

    // Try each container class to find one whose _list child exists
    var classes = el.classList;
    for (var i = 0; i < classes.length; i++) {
      var base = classes[i];
      var listClass = base + "_list";
      var slideClass = base + "_slide";

      if (wrapper.classList.contains(listClass)) {
        log("Detected class convention: base=" + base + ", wrapper=" + listClass + ", slide=" + slideClass);
        return { wrapperClass: listClass, slideClass: slideClass };
      }
    }

    // No convention found — check if standard swiper classes are present
    if (wrapper.classList.contains("swiper-wrapper")) {
      return null; // Swiper defaults will work
    }

    // Fallback: use the first child as wrapper by its first class
    var wrapperCls = wrapper.classList[0];
    var firstSlide = wrapper.firstElementChild;
    var slideCls = firstSlide ? firstSlide.classList[0] : null;

    if (wrapperCls && slideCls) {
      log("Fallback class detection: wrapper=" + wrapperCls + ", slide=" + slideCls);
      return { wrapperClass: wrapperCls, slideClass: slideCls };
    }

    warn("Could not detect wrapper/slide classes for:", el);
    return null;
  }

  // --- Public API ---
  // (Paste this ABOVE the init function)
  window.SwiperEngine = {
    getInstance: function (name) {
      return registry[name] || null;
    },

    update: function (name) {
      var entry = registry[name];
      if (!entry) {
        warn('update(): no instance named "' + name + '"');
        return;
      }
      for (var i = 0; i < entry.swipers.length; i++) {
        entry.swipers[i].update();
      }
    },

    updateAll: function () {
      for (var name in registry) {
        for (var i = 0; i < registry[name].swipers.length; i++) {
          registry[name].swipers[i].update();
        }
      }
    },

    destroy: function (name) {
      var entry = registry[name];
      if (!entry) {
        warn('destroy(): no instance named "' + name + '"');
        return;
      }
      for (var i = 0; i < entry.swipers.length; i++) {
        // This is the call that was failing
        entry.swipers[i].destroy(true, true);
      }
      delete registry[name];
      log('Destroyed instance "' + name + '"');
    },
  };

  // --- Initialization ---
// --- Initialization ---

  // Define the Webflow Breakpoints
  var BREAKPOINTS = {
    'tablet': '(max-width: 991px)',
    'mobile-l': '(max-width: 767px)',
    'mobile': '(max-width: 479px)'
  };

  function init() {
    log("Initializing...");

    var controlMap = collectControls();
    var containers = document.querySelectorAll("[se-swiper-instances]");
    log("Found " + containers.length + " swiper container(s)");

    containers.forEach(function (el) {
      var name = el.getAttribute("se-swiper-instances");
      var bpKey = el.getAttribute("se-breakpoint"); // Get the se-breakpoint="mobile-l" attribute

      // Logic: If a breakpoint is set, listen for media query changes
      if (bpKey && BREAKPOINTS[bpKey]) {
        var mq = window.matchMedia(BREAKPOINTS[bpKey]);

        var checkBreakpoint = function (e) {
          if (e.matches) {
            // Screen matches breakpoint (e.g. is 767px or less)
            if (!registry[name]) {
              setupSingleInstance(el, name, controlMap);
            }
          } else {
            // Screen is larger than breakpoint
            if (registry[name]) {
              window.SwiperEngine.destroy(name);
            }
          }
        };

        mq.addEventListener("change", checkBreakpoint);
        checkBreakpoint(mq); // Run on page load
      } else {
        // No breakpoint attribute? Init normally.
        setupSingleInstance(el, name, controlMap);
      }
    });

    // 3. Bind control event listeners
    for (var name in registry) {
      bindControls(name, registry[name]);
    }

    log("Initialization complete.");
  }

  // Helper to keep the init function clean
  function setupSingleInstance(el, name, controlMap) {
    if (registry[name]) return;
    
    var classInfo = detectClasses(el);
    var userConfig = parseAttributes(el);
    
    var config = Object.assign({ 
      slidesPerView: "auto", 
      spaceBetween: 0,
      a11y: { enabled: true }
    }, userConfig);

    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', name + ' carousel');
    
    var wrapperEl = el.querySelector('[class*="_list"], .swiper-wrapper');
    if (wrapperEl) wrapperEl.setAttribute('role', 'presentation');

    var instanceControls = controlMap[name] || [];
    
    // Wire pagination/scrollbar
    for (var c = 0; c < instanceControls.length; c++) {
      var ctrl = instanceControls[c];
      if (ctrl.type === "pagination") {
        config.pagination = Object.assign({}, config.pagination || {}, { el: ctrl.el, clickable: true });
      }
      if (ctrl.type === "scrollbar") {
        config.scrollbar = Object.assign({}, config.scrollbar || {}, { el: ctrl.el });
      }
    }

    if (classInfo) {
      config.wrapperClass = classInfo.wrapperClass;
      config.slideClass = classInfo.slideClass;
    }

    var swiper = new window.Swiper(el, config);
    registry[name] = { swipers: [swiper], controls: instanceControls };
  }


  // --- Boot ---

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(); // This closes the (function () { "use strict"; block correctly
