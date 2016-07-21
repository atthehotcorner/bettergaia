let minimatch = require('minimatch');

let BetterGaia = {
  version: Bridge.version,
  path: Bridge.path,
  mounted: false,
  extensions: [],

  pref: {
    // Only accessed by BetterGaia
    storage: {},
    defaults: {
      disabledExtensions: [],
      extensions: {}
    },

    // Extensions allowed to use these
    get: function(key, extensionId) {
      if (typeof extensionId === 'undefined') {
        if (BetterGaia.pref.storage.hasOwnProperty(key)) {
          return BetterGaia.pref.storage[key];
        }
        else if (BetterGaia.pref.defaults.hasOwnProperty(key)) {
          return BetterGaia.pref.defaults[key];
        }
        else {
          console.warn(`BetterGaia: preference with key not found, ${key}`);
          return;
        }
      }
      else {
        // extension called this
        if (BetterGaia.pref.storage.hasOwnProperty('extensions') && BetterGaia.pref.storage.extensions.hasOwnProperty(extensionId) && BetterGaia.pref.storage.extensions[extensionId].hasOwnProperty(key)) {
          // this is awful (above)
          return BetterGaia.pref.storage.extensions[extensionId][key];
        }
        else if (BetterGaia.pref.defaults.extensions[extensionId].hasOwnProperty(key)) {
          // extension must have default pref object, even if empty
          return BetterGaia.pref.defaults.extensions[extensionId][key];
        }
        else {
          console.warn(`BetterGaia: preference with key not found, ${extensionId}.${key}`);
          return;
        }
      }
    },

    set: function(key, value, extensionId) {
      if (BetterGaia.pref.defaults.hasOwnProperty(key)
          && value === BetterGaia.pref.defaults[key]
          && BetterGaia.pref.storage.hasOwnProperty(key)) {
        // if default value, remove from the browsers storage
        Bridge.storage.remove(key);
        delete BetterGaia.pref.storage[key];
      }
      else {
        Bridge.storage.set(key, value);
        BetterGaia.pref.storage[key] = value;
      }
    },

    remove: function(key, extensionId) {
      if (BetterGaia.pref.storage.hasOwnProperty(key)) {
        Bridge.storage.remove(key);
        delete BetterGaia.pref.storage[key];
      }
      else if (BetterGaia.pref.defaults.hasOwnProperty(key)) {
        console.warn(`BetterGaia: preference with key is already at default value, ${key}`);
      }
      else {
        console.warn(`BetterGaia: preference with key not found, ${key}`);
      }
    }
  },

  reset() {
    let confirm = prompt('Resetting will erase all of your personal content and settings for BetterGaia, which cannot be undone.\n\nTo continue, enter "Reset BetterGaia" below.');

    if (confirm && confirm.toLowerCase() === 'reset bettergaia') {
      console.log('Resetting BetterGaia...');
      Bridge.reset();
    }
    else console.log('Reset aborted.');
  },

  extensionFactory: function(id) {
    try {
      return extensionClasses[id];
    } catch(e) {
      console.warn(`BetterGaia: extension not found, ${id}\n`, e);
    }
  },

  loadPrefs: function(callback) {
    Bridge.storage.get((response) => {
      // Get entire storage from the browser, store it locally
      BetterGaia.pref.storage = response;

      // finish with the callback
      if (typeof callback === 'function') {
        callback();
      }
    });
  },

  match: function(path, matchArray) {
    for (let i = 0, len = matchArray.length; i < len; i++) {
      if (minimatch(path, matchArray[i])) return true;
    }
    return false; // no matches
  },

  mountExtensions: function() {
    for (let i = 0, len = this.extensions.length; i < len; i++) {
      try {
        this.extensions[i].mount();
      } catch(e) {
        console.warn(`BetterGaia: cannot mount extension, ${this.extensions[i].id}\n`, e);
      }
    }
  },

  unMountExtensions: function() {
    console.groupCollapsed('Unmounting extensions...');
    for (let i = 0, len = this.extensions.length; i < len; i++) {
      try {
        console.log(`Unmounting ${extensionClassesIds[i]}...`);
        this.extensions[i].unMount();
      } catch(e) {
        console.warn(`BetterGaia: cannot unmount extension, ${this.extensions[i].id}\n`, e);
      }
    }
    console.groupEnd();
  },

  mount: function() {
    if (this.mounted) return;

    let disabledExtensions = BetterGaia.pref.get('disabledExtensions');

    // Prework on the extension
    console.groupCollapsed('Mounting extensions...');
    for (let i = 0, len = extensionClassesIds.length; i < len; i++) {
      if (disabledExtensions.indexOf(extensionClassesIds[i]) !== -1) continue; // skip if disabled

      let extension = this.extensionFactory(extensionClassesIds[i]);
      if (extension) {
        // Store the default prefs for the extension
        BetterGaia.pref.defaults.extensions[extensionClassesIds[i]] = extension.defaultPrefs();

        // see if matches or excludes current page
        let path = document.location.pathname + document.location.search;
        let info = extension.info();

        if (info.hasOwnProperty('match')) {
          if (typeof info.match === 'string') info.match = [info.match];
          if (info.match.length > 0) {
            if (!this.match(path, info.match)) continue;
          }
        }
        if (info.hasOwnProperty('exclude')) {
          if (typeof info.exclude === 'string') info.exclude = [info.exclude];
          if (info.exclude.length > 0) {
            if (this.match(path, info.exclude)) continue;
          }
        }

        // Premount the extensions
        try {
          console.log(`Mounting ${extensionClassesIds[i]}...`);
          extension = new extension;
          extension.preMount();
          this.extensions.push(extension);
        } catch(e) {
          console.warn(`BetterGaia: cannot preMount extension, ${extensionClassesIds[i]}\n`, e);
        }
      }
    }
    console.groupEnd();

    // Mount extension (func)
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      this.mountExtensions();
    }
    else {
      document.addEventListener('DOMContentLoaded', (event) => {
        this.mountExtensions();
      });
    }

    this.mounted = true;
  },

  unMount: function() {
    if (!this.mounted) return;
    //this.unMountExtensions();
    this.mounted = false;
  }
};
