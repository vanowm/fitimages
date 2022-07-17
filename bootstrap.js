const {classes: Cc, interfaces: Ci, utils: Cu} = Components,
			VERSION = "1.1",
			BUTTON_ID = "fitImagesOptions",
			PREF_BRANCH = "extensions.fitImages.",
			RESOURCE = "fitimages";
var ADDON_ID;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");

var addon = {
		getResourceURI: function(filePath)
		{
			return {spec: __SCRIPT_URI_SPEC__ + "/../" + filePath}
		}
	},
	log = console.log.bind(console),
	self = this;


function include(path)
{
	Services.scriptloader.loadSubScript(addon.getResourceURI(path).spec, self);
}

function getFile(file)
{
	try
	{
		return Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newChannel(addon.getResourceURI(file).spec, null, null).name;
	}
	catch(e)
	{
		try
		{
			return this.addon.getResourceURI(file).spec;
		}catch(e){log(e);return null};
	}
}

function _$(node, childId)
{
	if (node.getElementById)
		return node.getElementById(childId);
	else
		return node.querySelector("#" + childId);
}

var fiti = {
	pref: Services.prefs.getBranch(PREF_BRANCH),
	prefs: {
		enabled: {default: true, value: true, option: 3, optionStay: true}, //enabled/disabled
		fitWidth: {default: true, value: true, option: true, optionStay: true, optionDisabled: ["minWidth", "minWidth_box"]}, //fit width
		minWidth: {default: 300, value: 300, option: true, optionStay: true}, //minimum image width
		fitHeight: {default: true, value: true, option: true, optionStay: true, optionDisabled: ["minHeight", "minHeight_box"]}, //fit height
		minHeight: {default: 300, value: 300, option: true, optionStay: true}, //minimum image height
		scrollToClick: {default: true, value: true, option: true, optionStay: true, radio: ["scrollTo"]}, //scroll to cursor position on resize after click
		scrollTo: {default: false, value: false, option: true, optionStay: true, radio: ["scrollToClick"]}, //scroll to image on resize after click
		showBorder: {default: true, value: true, option: true, optionStay: true}, //show border around images
		addSpaces: {default: true, value: true, option: true, optionStay: true}, //add spaces around images
		obeySize: {default: true, value: true, option: true, optionStay: true}, //show image in it's defined size
		linkClickDelay: {default: true, value: true, option: true, optionStay: true}, //click on an image with a link require hold for 1/2 sec to resize image
		showChangesLog: {default: true, value: true, option: 1, optionStay: true},

		version: {default: "", value: ""},
	}, //prefs

	changesLogShowed: false,
	ignorePrefChange: false,

	setDefaultPrefs: function(reset)
	{
		let obj = this.prefs,
				name = "", domain = "",
				type, branch = Services.prefs.getDefaultBranch(PREF_BRANCH);
		for (let key in obj)
		{
			let val = obj[key];
			name = domain + key;
			switch (typeof(val.default))
			{
				case "boolean":
						//make sure the setting is correct type
						type = branch.getPrefType(name);
						if (type != Ci.nsIPrefBranch.PREF_BOOL && type != Ci.nsIPrefBranch.PREF_INVALID)
							branch.deleteBranch(name);

						branch.setBoolPref(name, val.default);
						val.value = this.pref.getBoolPref(name);
					break;
				case "number":
						//make sure the setting is correct type
						type = branch.getPrefType(name);
						if (type != Ci.nsIPrefBranch.PREF_INT && type != Ci.nsIPrefBranch.PREF_INVALID)
							branch.deleteBranch(name);

						branch.setIntPref(name, val.default);
						val.value = this.pref.getIntPref(name);
						if (name == "num")
						{
							let val2 = this.numCheck(val.value, this.prefs.num.value);
							if (val2 != val.value)
							{
								val.value = val2;
								this.pref.setIntPref(name, val2);
							}
						}

						//make sure the setting is in allowed range
						if (("min" in val && val.value < val.min) || ("max" in val && (val.max != -1 && val.value > val.max)))
						{
							val.value = val.default;
							this.pref.setIntPref(name, val.value);
						}
					break;
				case "string":
						//make sure the setting is correct type
						type = branch.getPrefType(name);
						if (type != Ci.nsIPrefBranch.PREF_STRING && type != Ci.nsIPrefBranch.PREF_INVALID)
							branch.deleteBranch(name);

						this.prefString(branch, name, val.default);
						val.value = this.prefString(this.pref, name);
						if (reset || ("regexp" in val && val.value.match(val.regexp)))
						{
							if (reset && name != "version")
								this.prefString(bfht.pref, name, val.default);
						}
					break;
				default:
					continue;
			} //switch
			obj[key].value = val.value;
		} //for
	}, //setDefaultPrefs

	prefString: function(pref, key, val)
	{
		let r, er = [];
		if (typeof(val) == "undefined")
		{
			try
			{
				r = pref.getComplexValue(key, Ci.nsISupportsString).data;
			}
			catch(e)
			{
				er.push(e);
				try
				{
					r = pref.getStringPref(key);
				}
				catch(e)
				{
					er.push(e);
					try
					{
						r = pref.getComplexValue(key, Ci.nsIPrefLocalizedString).data;
					}
					catch(e)
					{
						er.push(e);
						try
						{
							r = pref.getCharPref(key);
						}
						catch(e)
						{
							er.push(e);
							log(er);
						}
					}
				}
			}
		}
		else
		{
			try
			{
				let str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
				str.data = val;
				r = pref.setComplexValue(key, Ci.nsISupportsString, str);
			}
			catch(e)
			{
				er.push(e);
				try
				{
					r = pref.setStringPref(key,val);
				}
				catch(e)
				{
					er.push(e);
					try
					{
						let str = Cc["@mozilla.org/pref-localizedstring;1"].createInstance(Ci.nsIPrefLocalizedString);
						str.data = val;
						r = pref.setComplexValue(key, Ci.nsIPrefLocalizedString, str);
					}
					catch(e)
					{
						er.push(e);
						try
						{
							r = pref.setCharPref(key, val);
						}
						catch(e)
						{
							er.push(e);
							log(er);
						}
					}
				}
			}
		}
		return r;
	},//prefString()

	onPrefChange: function(pref, aTopic, key)
	{
		let val, obj = fiti.prefs;
		if(aTopic != "nsPref:changed" || typeof(obj[key]) == "undefined")
			return;

		obj = obj[key];
		switch (pref.getPrefType(key))
		{
			case Ci.nsIPrefBranch.PREF_BOOL:
					if (typeof(obj.default) != "boolean")
						return false;

					val = pref.getBoolPref(key);
				break;
			case Ci.nsIPrefBranch.PREF_INT:
					if (typeof(obj.default) != "number")
						return false;

					val = pref.getIntPref(key);
					if (("min" in obj && val < obj.min)
						|| ("max" in obj && (val > obj.max && obj.max != -1)))
						pref.setIntPref(key, obj.default);

				break;
			case Ci.nsIPrefBranch.PREF_STRING:
					if (typeof(obj.default) != "string")
						return false;

					val = fiti.pref.prefString(this.pref, key);
				break;
			default:
				return;
		} //switch
		changeObject("value", val, obj);
	}, //onPrefChange

	init: function(window, type)
	{
		if (!window || window.document.documentElement.getAttribute('windowtype') != "mail:3pane")
			return;

		type = type || null;
		var document = window.document,
				hRefForClickEvent = window.hRefForClickEvent,
				mouseDown = {
					timer: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),
					timeStamp: 0,
					unload: null,
					cancel: false,
					img: null
				};
		function $(node)
		{
			return _$(document, node);
		}

		(function showChangesLog(focus)
		{
			var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),
					u = unload(timer.cancel);
			timer.init(function()
			{
				u();
				var tabmail = $("tabmail"),
						url = getFile("changes.txt");
				if (!tabmail)
					return;

				var total = tabmail.tabInfo.length;
				function show(tab)
				{
					if (typeof(tab) == "undefined")
					{
						if (fiti.changesLogShowed || !focus)
							return;

						fiti.changesLogShowed = true;
						tabmail.openTab("contentTab", {
							contentPage: url,
							background: false,
							onLoad: function(a, e)
							{
								e.contentDocument.title = _("changesLog");
							}
						});
					}
					else
					{
						fiti.changesLogShowed = true;
						if (focus)
							tabmail.switchToTab(tab);

						tabmail.tabInfo[tab].browser.contentDocument.title = _("changesLog");
					}
				}
				for (let i = 0; i < tabmail.tabInfo.length; ++i)
				{
					let browserFunc = tabmail.tabInfo[i].mode.getBrowser || tabmail.tabInfo[i].mode.tabType.getBrowser;
					if (browserFunc)
					{
						var possBrowser = browserFunc.call(tabmail.tabInfo[i].mode.tabType, tabmail.tabInfo[i]);
						if (tabmail.tabInfo[i].busy)
						{
							let tab = i;
							listen(window, possBrowser, "load", function(e)
							{
								if (e.target.URL == url)
								{
									e.target.title = _("changesLog");
									show(tab);
								}
								if (!total)
									show()
								else
									total--;
							}, true);
						}
						else
						{
							total--;
							if (possBrowser._contentWindow && possBrowser._contentWindow.location.href == url)
							{
								possBrowser._contentWindow.title = _("changesLog");
								show(i);
							}
							if (!total)
								show();
						}
					}
					else
					{
						total--;
						if (!total)
							show();
					}
				}
			}, 1000, timer.TYPE_ONE_SHOT); //timer
		})(fiti.reason != ADDON_INSTALL && fiti.prefs.version.value != fiti.addon.version && fiti.prefs.showChangesLog.value && !fiti.changesLogShowed);//showChangesLog()

//		showChangesLog(fiti.reason != ADDON_INSTALL && fiti.prefs.version.value != fiti.addon.version && fiti.prefs.showChangesLog.value && !fiti.changesLogShowed);
		if (fiti.prefs.version.value != fiti.addon.version)
			fiti.pref.setCharPref("version", fiti.addon.version);

		function getImageWidth(img)
		{
			return (img.angle == 90 || img.angle == 270) ? img.height : img.width;
		}

		function getImageHeight(img)
		{
			return (img.angle == 90 || img.angle == 270) ? img.width : img.height;
		}

		function getImageNaturalWidth(img)
		{
			return (img.angle == 90 || img.angle == 270) ? img.naturalHeight : img.naturalWidth;
		}

		function getImageNaturalHeight(img)
		{
			return (img.angle == 90 || img.angle == 270) ? img.naturalWidth : img.naturalHeight;
		}


		// Called whenever the user clicks in the content area
		function contentAreaClick(aEvent)
		{
			if (aEvent.button || !fiti.prefs.enabled.value)
				return;

			if (aEvent.type == "keypress")
			{
				if (aEvent.keyCode == aEvent.DOM_VK_ESCAPE)
				{
					mouseDown.cancel = true;
					setCursor(mouseDown.img);
				}

				return;
			}
			let img = aEvent.target;
			// is this an image that we might want to scale?

			if (!(img instanceof Ci.nsIImageLoadingContent))
				return;
			// make sure it loaded successfully
//			var req = img.getRequest(Ci.nsIImageLoadingContent.CURRENT_REQUEST);
//			if (!req || req.imageStatus & Ci.imgIRequest.STATUS_ERROR || !img.hasAttribute("fitImages"))
			if (!img.hasAttribute("fitImages"))
				return;

			let href = img.href;
			function click(e)
			{
				let pane = $("messagepane"),
						doc = pane.contentDocument,
						x = img.x,
						y = img.y,
						wp = (e.layerX - img.x) *100 / getImageWidth(img),
						hp = (e.layerY - img.y) *100 / getImageHeight(img),
						docWidth = getWidth(doc),
						docHeight = getHeight(doc);
log(["layer x y", e.layerX, e.layerY]);

				if (img.getAttribute("fitImages") == "false")
				{
					img.removeAttribute("fitImagesOrig");
					setImage(img, getWidth(doc), getHeight(doc));
				}
				else
				{
					resetImage(img);
					img.setAttribute("fitImagesOrig", true);
				}
				if (fiti.prefs.scrollTo.value || fiti.prefs.scrollToClick.value)
				{
					let x = img.x,
							y = img.y;

					if (fiti.prefs.scrollToClick.value && img.getAttribute("fitImages") != "true")
					{
						let wn = getImageNaturalWidth(img) * wp / 100,
								hn = getImageNaturalHeight(img) * hp / 100;
						x = img.x + (wn - (docWidth / 2));
						y = img.y + (hn - (docHeight / 2));
						switch(img.angle)
						{
							case 90:
									
								break;
							case 180:
								break;
							case 270:
									y += img.naturalWidth;
									x -= img.naturalHeight;
								break;
						}
						if (x < img.x || wn < docWidth/2)
							x = img.x;
						else if (img.x + wn > (img.x + img.naturalWidth - docWidth/2))
							x = img.x + img.naturalWidth - docWidth;

						if (y < img.y || hn < docHeight/2)
							y = img.y;
						else if (img.y + hn > (img.y + img.naturalHeight - docHeight/2))
							y = img.y + img.naturalHeight - docHeight;

log(["img x y", img.x,img.y]);
log(["x y", x,y]);
log(["wp hp",wp,hp]);
log(["wn hn",wn,hn]);
log(["wna hna",getImageNaturalWidth(img),getImageNaturalHeight(img)]);
log(["wnat hnat",img.naturalWidth,img.naturalHeight]);
					}

//					pane.contentWindow.scrollTo(img.offsetLeft, img.offsetTop);
					pane.contentWindow.scrollTo(x , y);
				}
			} //click()

			if (aEvent.type == "mousedown")
			{
				mouseDown.cancel = false;
				mouseDown.timeStamp = aEvent.timeStamp;
				mouseDown.img = img;
				mouseDown.timer.init(function()
				{
					mouseDown.timeStamp = 0;
					if (href)
						setCursor(img, true);

				}, 500, mouseDown.timer.TYPE_ONE_SHOT);
				mouseDown.unload = unload(mouseDown.timer.cancel);

			}
			else
			{
				mouseDown.timer.cancel();
				if (mouseDown.cancel)
				{
					aEvent.preventDefault();
					aEvent.stopPropagation();
					return;
				}
				if (!href)
				{
					click(aEvent);
				}
				else
				{
					if (!img.hasAttribute("fitImagesLink")
							&& ((!fiti.prefs.linkClickDelay.value && mouseDown.timeStamp)
									|| (fiti.prefs.linkClickDelay.value && !mouseDown.timeStamp)))
					{
						click(aEvent);
						setCursor(img);
						aEvent.preventDefault();
						aEvent.stopPropagation();
						return;
					}
					else
					{
						setCursor(img)
					}
				}
			}
			return;
		}//contentAreaClick()

		function resetImage(img, resetall)
		{
			resetall = typeof(resetall) == "undefined" ? false : resetall;
			img.setAttribute("fitImages", false);
			if (resetall)
			{
				img.style.maxWidth = img.styleMaxWidth;
				img.style.maxHeight = img.styleMaxHeight;
				if (img.styleWidth)
					img.setAttribute("width", img.styleWidth);

				if (img.styleHeight)
					img.setAttribute("height", img.styleHeight);
			}
			else
			{
				img.style.maxWidth = "";
				img.style.maxHeight = "";
				img.removeAttribute("width");
				img.removeAttribute("height");
			}
			rotateImage(img, 0);
		}//resetImage()

		function setImage(img, width, height, doResize)
		{
			if (!fiti.prefs.enabled.value)
				return false;

			var val = false,
					newW = img.naturalWidth,
					newH = img.naturalHeight;
			doResize = typeof(doResize) == "undefined" ? true : doResize;
			function resize(w, h, mw, mh)
			{
				if (w <= mw && h <= mh)
					return [w, h];

				let p = (mw - w < mh - h) ? (mw / w) : (mh / h);
				return[Math.round(w * p), Math.round(h * p)]
			} //resize()
			this.log([newW, width]);
			if (doResize)
			{
				if (fiti.prefs.fitWidth.value && newW > width)
				{
					let r = resize(newW, newH, width, img.naturalHeight);
					newW = r[0];
					newH = r[1];
					img.style.maxWidth = newW + "px";
					img.style.maxHeight = newH + "px";
					val = true;
				}
				if (fiti.prefs.fitHeight.value && newH > height)
				{
					let r = resize(newW, newH, img.naturalWidth, height);
					newW = r[0];
					newH = r[1];
					img.style.maxWidth = newW + "px";
					img.style.maxHeight = newH + "px";
					val = true;
				}
					val = true;

				if (val)
				{
					if (fiti.prefs.obeySize.value)
					{
						this.log("width"+img.styleWidth);
						if (img.styleWidth)
							img.setAttribute("width", img.styleWidth);
						else
							img.removeAttribute("width");

						if (img.styleHeight)
							img.setAttribute("height", img.styleHeight);
						else
							img.removeAttribute("height");
					}
					else
					{
						img.removeAttribute("width");
						img.removeAttribute("height");
					}
					img.setAttribute("fitImages", val);
				}
				else
				{
					resetImage(img);
				}
				if (newW < width && newH < height)
				{
				}
			}
			img.setAttribute("showBorder", fiti.prefs.showBorder.value);
			img.setAttribute("addSpaces", fiti.prefs.addSpaces.value);
			img.setAttribute("fitImagesEnabled", true);
			setCursor(img);
			rotateImage(img, 0);
		}//setImage()

		function setCursor(img, reverse)
		{
			var pane = $("messagepane"),
					doc = pane.contentDocument;
			if ((img.href && ((fiti.prefs.linkClickDelay.value && !reverse)
												|| (!fiti.prefs.linkClickDelay.value && reverse)))
						|| (img.naturalWidth == img.width && img.width < getWidth(doc) && img.naturalHeight == img.height && img.naturalHeight < getHeight(doc)))
				img.setAttribute("fitImagesLink", true);
			else
				img.removeAttribute("fitImagesLink");
		}

		function getWidth(doc)
		{
			let w = doc.body.scrollWidth - doc.body.offsetWidth;
			return w > 0 && w < 30 ? doc.body.clientWidth - w : doc.body.clientWidth;
		}

		function getHeight(doc)
		{
			let h = doc.body.scrollHeight - doc.body.offsetHeight;
			return h > 0 && h < 30 ? doc.body.clientHeight - h : doc.body.clientHeight;
		}

		function messagePaneOnResize(aEvent)
		{
			var pane = $("messagepane"),
					doc = pane.contentDocument;
			if (!doc.body)
				return;

			var	img,
					width,
					height,
					w = doc.body.style.width,
					h = doc.body.style.height;

			if (window.windowState == window.STATE_MAXIMIZED)
			{
				doc.body.style.width = "100%";
				doc.body.style.height = "100%";
			}
			width = getWidth(doc);
			height = getHeight(doc);
			for(var i = 0; i < doc.images.length; i++)
			{
				img = doc.images[i];
				if (img.hasAttribute("fitImages"))
				{
					if (!img.hasAttribute("fitImagesOrig") || aEvent === true)
						resetImage(img);

					setImage(img, width, height);
				}

			} //for
		} //messagePaneOnResize






		function changeValue(objOrig, values)
		{
			for(let i in values)
			{
				if (i in obj)
				{
				}
			}
		}

		function rotateImage(img, angle)
		{
			angle = typeof(angle) == undefined ? 0 : angle;
			if (!("angle" in img))
				img.angle = 0;

			img.angle += angle;
			if (img.angle < 0)
				img.angle = 270;
			else if (img.angle > 270)
				img.angle = 0;

			let dif = Math.round((img.width > img.height ? img.width - img.height : img.height - img.width) / 2),
					difX = 0,
					difY = 0;
			if (img.width < img.height)
				dif = -dif;

			if (img.angle != 180)
			{
				difX = -dif;
				difY = dif;
			}
			if (img.width < img.height)
			{
				img.style.marginRight = difY * 2 + "px";
				img.style.marginBottom = -difY * 2 + "px";
			}
			else
			{
				img.style.marginRight = -difY * 2 + "px";
				img.style.marginBottom = difY * 2 + "px";
			}

			if (img.angle)
			{
				img.style.transform = img.angle ? "translate(" + difX + "px, " + difY + "px) rotate(" + img.angle + "deg)" : "";
			}
			else
			{
				img.style.margin = "";
				img.style.transform = "";
			}

log(img.style.transform);
//			img.style.transformOrigin = "left bottom";
			let w = img.width,
					h = img.height;
log([img.parentNode.width, img.parentNode.height]);
//			img.width = h;
//			img.height = w;
		}//rotateImage()










		function MsgMsgDisplayed(aSubject, aTopic, aData)
		{
			// scale any overflowing images
			let pane = $("messagepane"),
					doc,
					href,
					img,
					i;
			if (!pane)
				return;

			doc = pane.contentDocument;
			if (!doc.getElementById("fitiStyle"))
			{
				let s = doc.createElement("link");
				s.setAttribute("rel", "stylesheet")
				s.setAttribute("type", "text/css")
				s.setAttribute("href", "resource://" + RESOURCE + "/styles/overlay.css")
				s.id = "fitiStyle";
				doc.head.appendChild(s);
				unload(function()
				{
					doc.head.removeChild(s);
				});
			}
			for(i = 0; i < doc.images.length; i++)
			{
				let img = doc.images[i];
				href = hRefForClickEvent({type: "", target:img, originalTarget:img.parentNode});

				if (!fiti.prefs.enabled.value || (img.naturalWidth < fiti.prefs.minWidth.value && img.naturalHeight < fiti.prefs.minHeight.value))
				{
					if (img.styleWidth)
						img.setAttribute("width", img.styleWidth);

					if (img.styleHeight)
						img.setAttribute("height", img.styleHeight);

					img.removeAttribute("fitImages");
					if ("overlay" in img)
					{
						cleanupImg(img);
					}

					continue
				}
				if (img.hasAttribute("fitImages"))
					continue;

				img.href = href;
				img.styleMaxWidth = img.style.maxWidth;
				img.styleMaxHeight = img.style.maxHeight;
				img.styleWidth = img.getAttribute("width");
				img.styleHeight = img.getAttribute("height");
				let backup = img.style;
				img.styleBackup = backup;
				img.angle = 0;
				
				if (fiti.prefs.enabled.value)
					setImage(img, getWidth(doc), getHeight(doc));
				else
				{
					img.setAttribute("fitImages", false);
					if (href)
						img.setAttribute("fitImagesLink", true);
				}


				if (!("overlay" in img))
				{
					let overlay = doc.createElement("div"),
							rotateCw = doc.createElement("img"),
							rotateCcw = doc.createElement("img");
							box = doc.createElement("span");
					img.overlay = box;
					img.parentNode.insertBefore(box, img);
					rotateCw.src = "resource://" + RESOURCE + "/styles/rotate_cw.png";
					rotateCcw.src = "resource://" + RESOURCE + "/styles/rotate_ccw.png";
//					rotateCw.style.marginLeft = "5px";
					overlay.appendChild(rotateCcw);
					overlay.appendChild(rotateCw);
					overlay.className = "overlay";
					box.appendChild(overlay);
					box.appendChild(img);
					listen(pane, rotateCw, "click", function(){return rotateImage(img, 90)}, true);
					listen(pane, rotateCcw, "click", function(){return rotateImage(img, -90)}, true);
					unload(function()
					{
						cleanupImg(img);
					});
				}


			} //for

			function cleanupImg(img)
			{
				if (!"overlay" in img)
					return;

				let box = img.parentNode;
				box.parentNode.insertBefore(img, box);
				box.parentNode.removeChild(box);
				delete img.overlay;
			}
			unload(function()
			{
				for(var i = 0; i < doc.images.length; i++)
				{
					var img = doc.images[i];
					if (!img.hasAttribute("fitImages"))
						continue;

					resetImage(img, true);
					img.removeAttribute("fitImages");
					img.removeAttribute("fitImagesEnabled");
					img.removeAttribute("fitImagesOrig");
					img.removeAttribute("showBorder");
					img.removeAttribute("fitImagesLink");
					img.removeAttribute("addSpaces");
				}
			}); //unload
		}; //MsgMsgDisplayed()
		MsgMsgDisplayed();

		function fitAll()
		{
			messagePaneOnResize(true);
		} //fitAll()

		function resetAll(everything)
		{
			let pane = $("messagepane"),
					doc = pane.contentDocument;
			for(var i = 0; i < doc.images.length; i++)
			{
				var img = doc.images[i];
				if (!img.hasAttribute("fitImages"))
					continue;

				resetImage(img, everything);
				if (everything)
				{
					img.removeAttribute("fitImagesEnabled");
					img.removeAttribute("fitImagesOrig");
					img.removeAttribute("showBorder");
					img.removeAttribute("addSpaces");
					if (img.href)
						img.setAttribute("fitImagesLink", true);
				}
				else
					img.setAttribute("fitImagesOrig", true);
			}
		} //resetAll()

		//add options to message toolbar
		if (!$(BUTTON_ID) && $("header-view-toolbar"))
		{
			function popupshowing(e)
			{
				let items = e.target.childNodes;
				for(let i = 0; i < items.length; i++)
			{
					if (fiti.prefs[items[i].prefId])
					{
						switch(typeof fiti.prefs[items[i].prefId].default)
						{
							case "boolean":

									if (fiti.prefs[items[i].prefId].value)
										items[i].setAttribute("checked", true);
									else
										items[i].removeAttribute("checked");
								break;
							case "number":
									items[i].value = fiti.prefs[items[i].prefId].value;
								break;
						}
					}
					else
					{
						switch(items[i].value)
						{
							case "fitall":
							case "resetall":
									items[i].disabled = !fiti.prefs.enabled.value;
								break;
						}
					}
				}
			} //popupshowing()

			function toolbarbuttonCommand(e)
			{
				if (e.target.prefId == "enabled")
				{
					if (fiti.prefs.enabled.value)
					{
						$("fiti_enabled").removeAttribute("checked")
						toolbarbutton.removeAttribute("checked");
						toolbarbutton.style.listStyleImage = "url(" + icon_off + ")";
					}
					else
					{
						$("fiti_enabled").setAttribute("checked", true);
						toolbarbutton.setAttribute("checked", true);
						toolbarbutton.style.listStyleImage = "url(" + icon_on + ")";
					}
				}
				if (fiti.prefs[e.target.prefId] && fiti.prefs[e.target.prefId].option)
				{
					switch(typeof fiti.prefs[e.target.prefId].default)
					{
						case "boolean":
								fiti.pref.setBoolPref(e.target.prefId, e.target.hasAttribute("checked"));
							break;
						case "number":
								fiti.pref.setIntPref(e.target.prefId, e.target.value);
							break;
					}
				}
				else
				{
					switch(e.target.value)
					{
						case "fitall":
								fitAll();
							break;

						case "resetall":
								resetAll();
							break;
					}
				}
				MsgMsgDisplayed();
			}//toolbarbuttonCommand()

			var toolbar = $("header-view-toolbar"),
					toolbarbutton = document.createElement("toolbarbutton"),
					menu = document.createElement("menu"),
					menupopup = document.createElement("menupopup"),
					menuitem = document.createElement("menuitem"),
					tooltip,
					icon_on = getFile("styles/options16.png"),
					icon_off = getFile("styles/options16_off.png"),
					icon_rotate_cw = getFile("styles/rotate_cw.png"),
					icon_rotate_ccw = getFile("styles/rotate_ccw.png"),
					m,
					p;
			toolbarbutton.appendChild(menupopup);
			toolbarbutton.setAttribute("type", "menu-button");
			toolbarbutton.setAttribute("label", _("optoins.button"));
			toolbarbutton.id = BUTTON_ID;
			toolbarbutton.value = "enabled";
			toolbarbutton.prefId = "enabled";
			toolbarbutton.className = "toolbarbutton-1 msgHeaderView-button";
			if (fiti.prefs.enabled.value)
				toolbarbutton.setAttribute("checked", true);

			toolbarbutton.style.listStyleImage = "url(" + (fiti.prefs.enabled.value ? icon_on : icon_off) + ")";
			restorePosition(document, toolbarbutton, "header-view-toolbox");
			m = menuitem.cloneNode(true);
//			m.setAttribute("label", _("options.header"));
			m.setAttribute("description", _("options.header"));
			m.disabled = true;
			m.className = "optionsTitle";
			listen(window, m, "DOMMenuItemActive", function(e)
			{
				e.preventDefault();
				e.stopPropagation();
				e.target.removeAttribute("_moz-menuactive");
			}, true)
			menupopup.appendChild(m);
			menupopup.appendChild(document.createElement("menuseparator"));

			listen(window, menupopup, "popupshowing", popupshowing, true);
			listen(window, toolbarbutton, "command", toolbarbuttonCommand, false);
			let val;
			for(let i in fiti.prefs)
			{
				let p = fiti.prefs[i];
				if (!p.option)
					continue;

				switch(typeof p.default)
				{
					case "boolean":
							m = menuitem.cloneNode(true);
							m.setAttribute("type", "checkbox");
							m.setAttribute("label", _("options." + i));
							id = "fiti_" + i;
							if ("optionDisabled" in p)
							{
								listen(window, m, "command", function(e)
								{
									let nodes = fiti.prefs[e.target.prefId].optionDisabled;
									for(let n = 0; n < nodes.length; n++)
									{
										let node = $("fiti_" + nodes[n]);
										node.disabled = e.target.getAttribute("checked") != "true";
										if (node.disabled)
											node.setAttribute("disabled", node.disabled);
										else
											node.removeAttribute("disabled");
									}
								}, true);
							}
						break;

					case "number":
							let b = document.createElement("textbox");
							m = document.createElement("hbox");
							m.setAttribute("align", "center");
							m.appendChild(b);
							let l = document.createElement("description");
							l.setAttribute("value", _("options." + i));
							m.appendChild(l);
							b.setAttribute("type", "number");
							b.setAttribute("value", p.value);
							b.prefId = i;
							b.id = "fiti_" + i;
							id = "fiti_" + i + "_box";
							listen(window, b, "change", toolbarbuttonCommand, false);
						break;
				}//switch
				tooltip = _("options." + i + ".tooltip");
				m.setAttribute("tooltiptext", tooltip);
				m.id = id;
				m.prefId = i;
				if (p.optionStay)
					m.setAttribute("closemenu", "none");

				if (typeof(p.option) == "number" && p.option < 4 && (!menupopup.lastChild || menupopup.lastChild.tagName != "menuseparator"))
					menupopup.appendChild(document.createElement("menuseparator"));

				menupopup.appendChild(m);

				if (typeof(p.option) == "number" && p.option > 1)
					menupopup.appendChild(document.createElement("menuseparator"));

				if ("radio" in p)
				{
					m.setAttribute("radio", true);
					listen(window, m, "command", function(e)
					{
						for(let n = 0; n < p.radio.length; n++)
						{
							let node = $("fiti_" + p.radio[n]);
							if (e.target.hasAttribute("checked"))
							{
								fiti.ignorePrefChange = true;
								fiti.pref.setBoolPref(p.radio[n], false);
								fiti.ignorePrefChange = false;
							}
						}
					}, true);
				}
			}//for

			for(let i in fiti.prefs)
			{
				p = fiti.prefs[i];
				if (!p.option)
					continue;

				if ("optionDisabled" in p && !p.value)
				{
					let nodes = p.optionDisabled;
					for(let n = 0; n < nodes.length; n++)
					{
						let node = $("fiti_" + nodes[n]);
						if (!node)
							continue;

						node.disabled = !p.value;
						node.setAttribute("disabled", !p.value);
					}
				}
			}//for

			menupopup.setAttribute("ignorekeys", true);
			if (menupopup.lastChild.tagName != "menuseparator")
				menupopup.appendChild(document.createElement("menuseparator"));

			let changesLogItem = document.getElementById("fiti_showChangesLog");
			m = menuitem.cloneNode(true);
			m.setAttribute("label", _("options.fitAll"));
			m.setAttribute("closemenu", "none");
			m.id = "fiti_fitAll";
			m.allowDisable = true;
			m.value = "fitall";
			menupopup.insertBefore(m, changesLogItem);
			m = menuitem.cloneNode(true);
			m.setAttribute("label", _("options.resetAll"));
			m.setAttribute("closemenu", "none");
			m.id = "fiti_resetAll";
			m.allowDisable = true;
			m.value = "resetall";
			menupopup.insertBefore(m, changesLogItem);
			menupopup.insertBefore(document.createElement("menuseparator"), changesLogItem);
			m = menuitem.cloneNode(true);
			m.setAttribute("label", _("options.close"));
			menupopup.appendChild(m);
			if (menupopup.firstChild.tagName == "menuseparator")
				menupopup.removeChild(menupopup.lastChild);

			if (menupopup.firstChild.tagName == "menuseparator")
				menupopup.removeChild(menupopup.lastChild);

			toolbarbutton.appendChild(menupopup);
			unload(function()
			{
				toolbarbutton.parentNode.removeChild(toolbarbutton);
			})
		} //end options to message toolbar

		function onPrefChange(pref, aTopic, key)
		{
			if (fiti.ignorePrefChange)
				return;

			fiti.onPrefChange(pref, aTopic, key);
			if (fiti.prefs.enabled.value)
			{
				messagePaneOnResize();
			}
			else
			{
				resetAll(true);
			}
			popupshowing({target: menupopup});
		} //onPrefChange()

		listen(window, $("messagepane"), "mousedown", contentAreaClick, true);
		listen(window, $("messagepane"), "keypress", contentAreaClick, true);
		listen(window, $("messagepane"), "click", contentAreaClick, true);
		listen(window, $("messagepane"), "resize", messagePaneOnResize, false);
		Services.obs.addObserver(MsgMsgDisplayed, "MsgMsgDisplayed", false);
		unload(function(){Services.obs.removeObserver(MsgMsgDisplayed, "MsgMsgDisplayed", false)});
		fiti.pref.QueryInterface(Ci.nsIPrefBranch2).addObserver('', onPrefChange, false);
		unload(function(){fiti.pref.QueryInterface(Ci.nsIPrefBranch2).removeObserver('', onPrefChange, false)});
	}, //init()

} //fiti

async function startup(data, reason)
{
	ADDON_ID = data.id;
	fiti.reason = reason;
	let resource = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
	let alias = Services.io.newFileURI(data.installPath);
	
	if (!data.installPath.isDirectory())
		alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);

	resource.setSubstitution(RESOURCE, alias);

	if (reason == ADDON_INSTALL)
	{
		setDefaultPosition(BUTTON_ID, "header-view-toolbar", null);
	}
log(ADDON_ID);
	addon = await AddonManager.getAddonByID(ADDON_ID);
log(addon);
	fiti.addon = addon;
//		include("includes/dump.js");
	log.title = "FitImage";
	include("includes/utils.js");
	include("includes/l10n.js");
log("wtf");
	l10n(addon, "lang.properties");
	unload(l10n.unload);
	loadStyles(addon, ["style"]);
	include("includes/buttons.js");
	fiti.setDefaultPrefs();
	let prefAddObserver = fiti.pref.addObserver || fiti.pref.QueryInterface(Ci.nsIPrefBranch2).addObserver;
	prefAddObserver('', fiti.onPrefChange, false);

	watchWindows(fiti.init, "mail:3pane");
} //startup()

function shutdown(data, reason)
{
	unload();
	
	if (reason == APP_SHUTDOWN)
		return;

	let removeObserver = fiti.pref.removeObserver || fiti.pref.QueryInterface(Ci.nsIPrefBranch2).removeObserver;
	removeObserver('', fiti.onPrefChange, false);
	let resource = Services.io.getProtocolHandler("resource").QueryInterface(Ci.nsIResProtocolHandler);
	resource.setSubstitution(RESOURCE, null);
}

function install(data, reason)
{
}

function uninstall(data, reason)
{
	if (reason == ADDON_UNINSTALL)
		Services.prefs.getDefaultBranch(PREF_BRANCH).deleteBranch('');
}
