/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Home Dash Utility.
 *
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Edward Lee <edilee@mozilla.com>
 *   Erik Vold <erikvvold@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

"use strict";

/**
 * Get a localized string with string replacement arguments filled in and
 * correct plural form picked if necessary.
 *
 * @note: Initialize the strings to use with getString.init(addon).
 *
 * @usage getString(name): Get the localized string for the given name.
 * @param [string] name: Corresponding string name in the properties file.
 * @return [string]: Localized string for the string name.
 *
 * @usage getString(name, arg): Replace %S references in the localized string.
 * @param [string] name: Corresponding string name in the properties file.
 * @param [any] arg: Value to insert for instances of %S.
 * @return [string]: Localized string with %S references replaced.
 *
 * @usage getString(name, args): Replace %1$S references in localized string.
 * @param [string] name: Corresponding string name in the properties file.
 * @param [array of any] args: Array of values to replace references like %1$S.
 * @return [string]: Localized string with %N$S references replaced.
 *
 * @usage getString(name, args, plural): Pick the correct plural form.
 * @param [string] name: Corresponding string name in the properties file.
 * @param [array of any] args: Array of values to replace references like %1$S.
 * @param [number] plural: Number to decide what plural form to use.
 * @return [string]: Localized string of the correct plural form.
 */
function getString(name, args, plural) {
  // Use the cached bundle to retrieve the string
  let str;
  try {
    str = getString.bundle.GetStringFromName(name);
  }
  // Use the fallback in-case the string isn't localized
  catch(ex) {
    str = getString.fallback.GetStringFromName(name);
  }

  // Pick out the correct plural form if necessary
  if (plural != null)
    str = getString.plural(plural, str);

  // Fill in the arguments if necessary
  if (args != null) {
    // Convert a string or something not array-like to an array
    if (typeof args == "string" || args.length == null)
      args = [args];

    // Assume %S refers to the first argument
    str = str.replace(/%s/gi, args[0]);

    // Replace instances of %N$S where N is a 1-based number
    Array.forEach(args, function(replacement, index) {
      str = str.replace(RegExp("%" + (index + 1) + "\\$S", "gi"), replacement);
    });
  }

  return str;
}

/**
 * Initialize getString() for the provided add-on.
 *
 * @usage getString.init(addon): Load properties file for the add-on.
 * @param [object] addon: Add-on object from AddonManager
 *
 * @usage getString.init(addon, getAlternate): Load properties with alternate.
 * @param [object] addon: Add-on object from AddonManager
 * @param [function] getAlternate: Convert a locale to an alternate locale
 */
getString.init = function(addon, getAlternate) {
  // Set a default get alternate function if it doesn't exist
  if (typeof getAlternate != "function")
    getAlternate = function() {return "en-US"};

  // Get the bundled properties file for the app's locale
  function getBundle(locale) {
    let propertyPath = "locales/" + locale + ".properties";
    let propertyFile = addon.getResourceURI(propertyPath);

    // Get a bundle and test if it's able to do simple things
    try {
      let bundle = Services.strings.createBundle(propertyFile.spec);
      bundle.getSimpleEnumeration();
      return bundle;
    }
    catch(ex) {}

    // The locale must not exist, so give nothing
    return null;
  }

  // Use the current locale or the alternate as the primary bundle
  let locale = Cc["@mozilla.org/chrome/chrome-registry;1"].
    getService(Ci.nsIXULChromeRegistry).getSelectedLocale("global");
  getString.bundle = getBundle(locale) || getBundle(getAlternate(locale));

  // Create a fallback in-case a string is missing
  getString.fallback = getBundle("en-US");

  // Get the appropriate plural form getter
  Cu.import("resource://gre/modules/PluralForm.jsm");
  let rule = getString("pluralRule");
  [getString.plural] = PluralForm.makeGetter(rule);

  // Clear out the strings cache when cleaning up so new ones load
  unload(function(){Services.strings.flushBundles()});
}

/**
 * Helper that adds event listeners and remembers to remove on unload
 */
function listen(window, node, event, func, capture) {
  // Default to use capture
  if (capture == null)
    capture = true;

  node.addEventListener(event, func, capture);
  function undoListen() {
    node.removeEventListener(event, func, capture);
  }

  // Undo the listener on unload and provide a way to undo everything
  let undoUnload = unload(undoListen, window);
  return function() {
    undoListen();
    undoUnload();
  };
}

/**
 * Load various packaged styles for the add-on and undo on unload
 *
 * @usage loadStyles(addon, styles): Load specified styles
 * @param [object] addon: Add-on object from AddonManager
 * @param [array of strings] styles: Style files to load
 */
function loadStyles(addon, styles) {
  let sss = Cc["@mozilla.org/content/style-sheet-service;1"].
            getService(Ci.nsIStyleSheetService);
  let ios = Components.classes["@mozilla.org/network/io-service;1"]
                  .getService(Components.interfaces.nsIIOService);
  styles.forEach(function(fileName) {
    let fileURI = addon.getResourceURI("styles/" + fileName + ".css");
		fileURI = ios.newURI(fileURI.spec, null, null);
    sss.loadAndRegisterSheet(fileURI, sss.USER_SHEET);
    unload(function(){sss.unregisterSheet(fileURI, sss.USER_SHEET)});
  });
}

/**
 * Create a trigger that allows adding callbacks by default then triggering all
 * of them.
 */
function makeTrigger() {
  let callbacks = [];

  // Provide the main function to add callbacks that can be removed
  function addCallback(callback) {
    callbacks.push(callback);
    return function() {
      let index = callbacks.indexOf(callback);
      if (index != -1)
        callbacks.splice(index, 1);
    };
  }

  // Provide a way to clear out all the callbacks
  addCallback.reset = function() {
    callbacks.length = 0;
  };

  // Run each callback in order ignoring failures
  addCallback.trigger = function(reason) {
    callbacks.slice().forEach(function(callback) {
      try {
        callback(reason);
      }
      catch(ex) {}
    });
  };

  return addCallback;
}


/**
 * Save callbacks to run when unloading. Optionally scope the callback to a
 * container, e.g., window. Provide a way to run all the callbacks.
 *
 * @usage unload(): Run all callbacks and release them.
 *
 * @usage unload(callback): Add a callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 *
 * @usage unload(callback, container) Add a scoped callback to run on unload.
 * @param [function] callback: 0-parameter function to call on unload.
 * @param [node] container: Remove the callback when this container unloads.
 * @return [function]: A 0-parameter function that undoes adding the callback.
 */
function unload(callback, container) {
  // Initialize the array of unloaders on the first usage
  let unloaders = unload.unloaders;
  if (unloaders == null)
    unloaders = unload.unloaders = [];

  // Calling with no arguments runs all the unloader callbacks
  if (callback == null) {
    unloaders.slice().forEach(function(unloader){return unloader()});
    unloaders.length = 0;
    return true;
  }

  // The callback is bound to the lifetime of the container if we have one
  if (container != null) {
    // Remove the unloader when the container unloads
    container.addEventListener("unload", removeUnloader, false);

    // Wrap the callback to additionally remove the unload listener
    let origCallback = callback;
    callback = function() {
      container.removeEventListener("unload", removeUnloader, false);
      origCallback();
    }
  }

  // Wrap the callback in a function that ignores failures
  function unloader() {
    try {
      callback();
    }
    catch(ex) {}
  }
  unloaders.push(unloader);

  // Provide a way to remove the unloader
  function removeUnloader() {
    let index = unloaders.indexOf(unloader);
    if (index != -1)
      unloaders.splice(index, 1);
    return true;
  }
  return removeUnloader;
}

/**
 * Apply a callback to each open and new browser windows.
 *
 * @usage watchWindows(callback): Apply a callback to each browser window.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
function watchWindows(callback, type, onload) {
  var unloaded = false;
  type = type || null;
  onload = typeof(onload) == "undefined" ? true : onload;
  unload(function(){unloaded = true});

  // Wrap the callback in a function that ignores failures
  function watcher(window, type) {
    try {
      callback(window, type);
    }
    catch(ex) {}
  }

  // Wait for the window to finish loading before running the callback
  function runOnLoad(window) {
    // Listen for one load event before checking the window type
    window.addEventListener("load", function runOnce() {
      window.removeEventListener("load", runOnce, false);
      if (unloaded) return; // the extension has shutdown
      watcher(window, "load");
    }, false);
  }

  // Add functionality to existing windows
  let windows = Services.wm.getEnumerator(type);
  while (windows.hasMoreElements()) {
    // Only run the watcher immediately if the window is completely loaded
    let window = windows.getNext();
    if (window.document.readyState == "complete" || !onload)
      watcher(window);
    // Wait for the window to load before continuing
    else
      runOnLoad(window);
  }

  // Watch for new browser windows opening then wait for it to load
  function windowWatcher(subject, topic) {
    if (topic == "domwindowopened")
    	if (onload)
      	runOnLoad(subject);
      else
      	watcher(subject);
  }
  Services.ww.registerNotification(windowWatcher);

  // Make sure to stop watching for windows if we're unloading
  unload(function(){ Services.ww.unregisterNotification(windowWatcher)});
}

//changes an array object changeObject("key1.key2.key3", "newval", {key1: {key2: {key3: "test"}}})
function changeObject(key, val, obj)
{
	let split = key.split(".");
	if (typeof(obj[split[0]]) == "object" && split[0] in obj)
	{
		key = split.splice(0, 1);
		return changeObject(split.join("."), val, obj[key])
	}
	let prev = obj[split[0]];
	obj[split[0]] = val;
	return prev;
}

function windowFullScreen()
{
	let windows = Services.wm.getEnumerator("");
	while (windows.hasMoreElements()) {
		let window = windows.getNext();
		if (window.fullScreen)
			return true;
	}
	return false;
}

function _dump_(aMessage, obj, tab, parent, c)
{
//	return;

	parent = parent || aMessage;
	c = c || 0;
	tab = tab || 0;

	let showType = 1,
			sort = 1, //0 = none, 1 = case sensetive, 2 = case insensitive
			i,
			r = "",
			t2,
			t = typeof(aMessage),
			append = "",
			tText = "",
			t2Text = "";
	function _tab(tab)
	{
		return (new Array(tab)).join(" ");
	}
	if (showType)
		tText = " (" + t + ")";

	if (obj && t == "object" && aMessage !== null)
	{
		try
		{
			var array = new Array();
			for(i in aMessage)
				array.push(i);

			if (sort)
				if (sort == 2)
				{
					array.sort(function (a, b)
					{
						function chunkify(t)
						{
							var tz = [], x = 0, y = -1, n = 0, i, j;
				
							while (i = (j = t.charAt(x++)).charCodeAt(0))
							{
								var m = (i == 46 || (i >=48 && i <= 57));
								if (m !== n)
								{
									tz[++y] = "";
									n = m;
								}
								tz[y] += j;
							}
							return tz;
						}
				
						var aa = chunkify(a.toLowerCase()),
								bb = chunkify(b.toLowerCase()),
								x, c, d;
				
						for (x = 0; aa[x] && bb[x]; x++)
						{
							if (aa[x] !== bb[x])
							{
								c = Number(aa[x]), d = Number(bb[x]);
								if (c == aa[x] && d == bb[x])
								{
									return c - d;
								}
								else
									return (aa[x] > bb[x]) ? 1 : -1;
							}
						}
						return aa.length - bb.length;
					});
				}
				else
					array.sort();

			for(var ii = 0; ii < array.length; ii++)
			{
				i = array[ii];
				try
				{
					t2 = typeof(aMessage[i]);
				}
				catch(e)
				{
					t2 = "error";
				}
				if (showType)
					t2Text = " (" + t2 + ")";

				try
				{
					let text = aMessage[i];
					append = _tab(tab);
					try
					{
						text = text.toString();
						text = text.split("\n");
						for(var l = 1; l < text.length; l++)
							text[l] = append + text[l];

						text = text.join("\n");
					}
					catch(e){}
					r += append + i + t2Text + ": " + text;
				}
				catch(e)
				{
					r += append + i + t2Text + ": " + e;
				};
				if (t2 == "object" && aMessage[i] !== null && aMessage[i] != parent && c < obj)
				{
					r += "\n" + _tab(tab) + "{\n" + log(aMessage[i], obj, tab + 5, parent, c+1) + _tab(tab) + "}";
				}
				r += "\n"
			}
		}
		catch(e)
		{
			r += append + i + " (error): " + e + "\n"
		}
	}
	if (tab)
		return r;

	Services.console.logStringMessage("FitImage" + tText + ":" + aMessage + (r ? "\n" + r : ""));
	return true;
}

