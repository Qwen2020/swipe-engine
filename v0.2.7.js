/**
 * Swiper Engine v1.1.0
 * Vanilla JS wrapper around Swiper JS for Webflow projects.
 * Configure Swiper instances entirely through `se-*` HTML attributes.
 * Supports multiple instances with the same name — duplicates are
 * automatically renamed (e.g. partners, partners-2, partners-3).
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

  // --- Name deduplication ---
  function getUniqueName(name) {
    if (!registry[name]) return name;
    var counter = 2;
    while (registry[name + "-" + counter]) {
      counter++;
    }
    return name + "-" + counter;
  }

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
      if (key === "swiper-instances" || key === "breakpoint") continue; // instance name / breakpoint, not config

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
          moduleConfigs[prefix] = moduleConfigs[prefix] || {};
          moduleConfigs[prefix].__bare = val;
          matched = true;
          break;
        }
        if (key.indexOf(prefix + "-") === 0) {
          var sub = key.slice(prefix.length + 1);
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
        if (Object.keys(mod).length > 0) {
          config[camelPrefix] = mod;
        } else {
          config[camelPrefix] = bare;
        }
      } else {
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

  function detectClasses(el) {
    var wrapper = el.firstElementChild;
    if (!wrapper) {
      warn("No child element found as wrapper:", el);
      return null;
    }

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

    if (wrapper.classList.contains("swiper-wrapper")) {
      return null;
    }

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
        entry.swipers[i].destroy(true, true);
      }
      delete registry[name];
      log('Destroyed instance "' + name + '"');
    },
  };

  // --- Initialization ---

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
      var baseName = el.getAttribute("se-swiper-instances");
      var name = getUniqueName(baseName);
      var bpKey = el.getAttribute("se-breakpoint");

      // Write the resolved name back to the element
      el.setAttribute("se-swiper-instances", name);

      if (name !== baseName) {
        log('Renamed duplicate "' + baseName + '" → "' + name + '"');
      }

      if (bpKey && BREAKPOINTS[bpKey]) {
        var mq = window.matchMedia(BREAKPOINTS[bpKey]);

        var checkBreakpoint = function (e) {
          if (e.matches) {
            if (!registry[name]) {
              setupSingleInstance(el, name, controlMap);
              bindControls(name, registry[name]);
            }
          } else {
            if (registry[name]) {
              window.SwiperEngine.destroy(name);
            }
          }
        };

        mq.addEventListener("change", checkBreakpoint);
        checkBreakpoint(mq);
      } else {
        setupSingleInstance(el, name, controlMap);
      }
    });

    // Bind controls for non-breakpoint instances
    for (var name in registry) {
      if (!registry[name].__controlsBound) {
        bindControls(name, registry[name]);
        registry[name].__controlsBound = true;
      }
    }

    log("Initialization complete.");
  }

  function setupSingleInstance(el, name, controlMap) {
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
})();
