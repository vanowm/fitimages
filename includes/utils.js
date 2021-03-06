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
		unloaders.slice().forEach(unloader => unloader());
		unloaders.length = 0;
		return;
	}

	// The callback is bound to the lifetime of the container if we have one
	if (container != null) {
		// Remove the unloader when the container unloads
		container.addEventListener("unload", unloader, false);

		// Wrap the callback to additionally remove the unload listener
		let origCallback = callback;
		callback = function() {
			container.removeEventListener("unload", unloader, false);
			removeUnloader();
			origCallback();
		};
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
	}
	return removeUnloader;
}

/**
 * Apply a callback to each open and new browser windows.
 *
 * @usage watchWindows(callback): Apply a callback to each browser window.
 * @param [function] callback: 1-parameter function that gets a browser window.
 */
function watchWindows(callback, type) {
	var unloaded = false;
	if (typeof(type) == "undefined")
		type = "mail:3pane";

	unload(e => unloaded = true);

	// Wrap the callback in a function that ignores failures
	function watcher(window) {
		// try {
			// Now that the window has loaded, only handle browser windows
			let {documentElement} = window.document;
//log([documentElement.getAttribute("windowtype"), type]);
			if (documentElement.getAttribute("windowtype") == type)
				callback(window);
		// }
		// catch(ex) {console.log(ex);}
	}

	// Wait for the window to finish loading before running the callback
	function runOnLoad(window) {
		// Listen for one load event before checking the window type
		window.addEventListener("load", function runOnce() {
			window.removeEventListener("load", runOnce, false);
			if (unloaded) return; // the extension has shutdown
			watcher(window);
		}, false);
	}

	// Add functionality to existing windows
	let windows = Services.wm.getEnumerator(null);
	while (windows.hasMoreElements()) {
		// Only run the watcher immediately if the window is completely loaded
		let window = windows.getNext();
		if (window.document.readyState == "complete")
			watcher(window);
		// Wait for the window to load before continuing
		else
			runOnLoad(window);
	}

	// Watch for new browser windows opening then wait for it to load
	function windowWatcher(subject, topic) {
		if (topic == "domwindowopened")
			runOnLoad(subject);
	}
	Services.ww.registerNotification(windowWatcher);

	// Make sure to stop watching for windows if we're unloading
	unload(e => Services.ww.unregisterNotification(windowWatcher));
}

const timers = new Map();

function clearTimeout(timer)
{
	if (timer && timer.cancel)
		timer.cancel();

	timers.delete(timer);
}
function setTimeout(callback, time)
{
	let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	timers.set(timer, callback);
	timer.initWithCallback(() =>
	{
		clearTimeout(timer);
		callback();
	}, time, Ci.nsITimer.TYPE_ONE_SHOT);
	return timer;
}

function setDefaultPrefs(prefs)
{
	let p = prefs,
			branch = Services.prefs.getDefaultBranch(PREF_BRANCH);

	for (let key in p)
	{
		let val = p[key];
		switch (typeof val)
		{
			case "boolean":
				branch.setBoolPref(key, val);
				val = pref.getBoolPref(key);
				break;
			case "number":
				branch.setIntPref(key, val);
				val = pref.getIntPref(key);
				break;
			case "string":
				branch.setStringPref(key, val);
				val = pref.getStringPref(key);
				break;
		}
		prefs[key] = val;
	}
	return prefs;
} //setDefaultPrefs()

function onPrefChange(pref, aTopic, key)
{
	if(aTopic != "nsPref:changed" || typeof(prefs[key]) == "undefined")
		return;

	switch (pref.getPrefType(key))
	{
		case Ci.nsIPrefBranch.PREF_BOOL:
			prefs[key] = pref.getBoolPref(key);
			break;

		case Ci.nsIPrefBranch.PREF_INT:
			prefs[key] = pref.getIntPref(key);
			break;

		case Ci.nsIPrefBranch.PREF_STRING:
			prefs[key] = pref.getStringPref(key);
			break;
		default:
			return;
	}
} //onPrefChange()

function disableAll(obj, r, s, f)
{
	if (!s && obj.hasAttribute && obj.hasAttribute("autoSLM"))
		return true;

	if (f || s || typeof(r) == "undefined")
	{
		if ("disabled" in obj && !("___autoSLM_disabled" in obj))
		{
			obj.___autoSLM_disabled = obj.disabled;
		}
		if (typeof(r) == "undefined")
		{
			obj.disabled = obj.___autoSLM_disabled;
			delete obj.___autoSLM_disabled;
		}
		else
		{
			obj.disabled = r;
		}
	}
	for(let i = 0; i < obj.childNodes.length; i++)
	{
		let a = disableAll(obj.childNodes[i], r, s, f);
		if (a)
			s = a;
	}
}
