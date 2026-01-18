window.dynamicWPControl = {

	// Wallpaper metadatas
	imgCount: 16,
	sunriseImgNo: 3,
	sunsetImgNo: 12,

	// Properties
	prop: {
		staticMode: null,
		staticImgNo: null,
		netLocation: null,
		fixedLat: null,
		fixedLng: null,
		sunriseTime: null,
		sunsetTime: null,
		aniDuration: null,
		updateInt: null
	},

	// Control status
	initialized: false,
	sunriseTime: null,
	sunsetTime: null,
	timeCycle: null,
	updateTimer: null,
	preload: [],
	imgNo: 8,
	lastSunCalcKey: null,

	isNumber: function(value) {
		return typeof value === "number" && !isNaN(value);
	},

	getDayKey: function(date) {
		return date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
	},

	getDayOfYear: function(date) {
		var start = new Date(date.getFullYear(), 0, 0);
		var diff = date - start;
		return Math.floor(diff / 86400000);
	},

	normalizeDegrees: function(deg) {
		var res = deg % 360;
		return res < 0 ? res + 360 : res;
	},

	sinDeg: function(deg) {
		return Math.sin(deg * Math.PI / 180);
	},

	cosDeg: function(deg) {
		return Math.cos(deg * Math.PI / 180);
	},

	tanDeg: function(deg) {
		return Math.tan(deg * Math.PI / 180);
	},

	atanDeg: function(value) {
		return Math.atan(value) * 180 / Math.PI;
	},

	acosDeg: function(value) {
		return Math.acos(value) * 180 / Math.PI;
	},

	calcSunTime: function(date, lat, lng, isSunrise) {
		var day = this.getDayOfYear(date);
		var lngHour = lng / 15;
		var t = day + ((isSunrise ? 6 : 18) - lngHour) / 24;
		var M = (0.9856 * t) - 3.289;
		var L = M + (1.916 * this.sinDeg(M)) + (0.020 * this.sinDeg(2 * M)) + 282.634;
		L = this.normalizeDegrees(L);
		var RA = this.atanDeg(0.91764 * this.tanDeg(L));
		RA = this.normalizeDegrees(RA);
		var Lquadrant = Math.floor(L / 90) * 90;
		var RAquadrant = Math.floor(RA / 90) * 90;
		RA = (RA + (Lquadrant - RAquadrant)) / 15;
		var sinDec = 0.39782 * this.sinDeg(L);
		var cosDec = Math.cos(Math.asin(sinDec));
		var cosH = (this.cosDeg(90.833) - (sinDec * this.sinDeg(lat))) / (cosDec * this.cosDeg(lat));
		if (cosH > 1 || cosH < -1) return null;
		var H = isSunrise ? (360 - this.acosDeg(cosH)) : this.acosDeg(cosH);
		H = H / 15;
		var T = H + RA - (0.06571 * t) - 6.622;
		var UT = T - lngHour;
		var localT = UT + (-date.getTimezoneOffset() / 60);
		localT = (localT + 24) % 24;
		return Math.round(localT * 60);
	},

	calcSunTimes: function(date, lat, lng) {
		var sunrise = this.calcSunTime(date, lat, lng, true);
		var sunset = this.calcSunTime(date, lat, lng, false);
		if (!this.isNumber(sunrise) || !this.isNumber(sunset)) return null;
		return {
			sunrise: sunrise,
			sunset: sunset
		};
	},

	refreshSunTimes: function(date) {
		if (this.prop.netLocation && this.isNumber(this.prop.fixedLat) && this.isNumber(this.prop.fixedLng)) {
			var times = this.calcSunTimes(date, this.prop.fixedLat, this.prop.fixedLng);
			if (times) {
				this.sunriseTime = times.sunrise;
				this.sunsetTime = times.sunset;
				this.lastSunCalcKey = this.getDayKey(date);
				return;
			}
		}
		this.sunriseTime = this.isNumber(this.prop.sunriseTime) ? this.prop.sunriseTime : null;
		this.sunsetTime = this.isNumber(this.prop.sunsetTime) ? this.prop.sunsetTime : null;
		this.lastSunCalcKey = null;
	},

	refreshTimeCycleIfNeeded: function(date) {
		if (!this.prop.netLocation) return;
		var dayKey = this.getDayKey(date);
		if (this.lastSunCalcKey === dayKey) return;
		this.refreshSunTimes(date);
		this.calcTimeCycle();
	},

	// Apply new image with number n
	applyImg: function(n) {
		document.body.style.backgroundImage = "url('img/" + n + ".png')";
		this.imgNo = n;
	},

	getImgNo: function(time) {
		if (!this.timeCycle || this.timeCycle.length < this.imgCount + 1) return this.imgNo;
		for (var i = 1; i <= this.imgCount; i ++) {
			var start = this.timeCycle[i];
			var end = this.timeCycle[i + 1];
			if (!this.isNumber(start) || !this.isNumber(end)) continue;
			var interval = (end - start + 24 * 60) % (24 * 60);
			if (interval === 0) continue;
			var delta = (time - start + 24 * 60) % (24 * 60);
			if (delta < interval) return i;
		}
		return this.imgNo;
	},

	// Check current image and update as desired
	update: function() {
		if (this.prop.staticMode) {
			if (this.imgNo != this.prop.staticImgNo) this.applyImg(this.prop.staticImgNo);
		} else {
			var d = new Date();
			this.refreshTimeCycleIfNeeded(d);
			var n = this.getImgNo(60 * d.getHours() + d.getMinutes());
			if (this.imgNo != n) this.applyImg(n);
		}
	},

	// Set update timer
	startUpdate: function() {
		this.update();
		if (this.updateTimer) clearInterval(this.updateTimer);
		this.updateTimer = setInterval(function() {
			window.dynamicWPControl.update();
		}, this.prop.updateInt * 1000);
	},

	// Set update timer
	stopUpdate: function() {
		clearInterval(this.updateTimer);
		this.updateTimer = null;
		this.update();
	},

	// Calculate and fill the timeCycle array with start time for each image
	calcTimeCycle: function() {
		if (!this.isNumber(this.sunriseTime) || !this.isNumber(this.sunsetTime)) {
			this.calcUniformTimeCycle();
			return;
		}
		var res = new Array(this.imgCount + 1);
		var sunriseFirst = this.sunriseImgNo < this.sunsetImgNo;
		var startImgNo = sunriseFirst ? this.sunriseImgNo : this.sunsetImgNo;
		var endImgNo = sunriseFirst ? this.sunsetImgNo : this.sunriseImgNo;
		var startTime = sunriseFirst ? this.sunriseTime : this.sunsetTime;
		var endTime = sunriseFirst ? this.sunsetTime : this.sunriseTime;
		var insideInterval = (endTime - startTime) / (endImgNo - startImgNo);
		var outsideInterval = (24*60 - endTime + startTime) / (this.imgCount - endImgNo + startImgNo);

		res[startImgNo] = startTime;
		res[endImgNo] = endTime;
		for (var i = startImgNo - 1; i >= 1; i --) res[i] = res[i+1] - outsideInterval;
		for (var i = startImgNo + 1; i < endImgNo; i ++) res[i] = res[i-1] + insideInterval;
		for (var i = endImgNo + 1; i <= this.imgCount + 1; i ++) res[i] = res[i-1] + outsideInterval;
		for (var i = 1; i <= this.imgCount + 1; i ++) {
			if (res[i] >= 24*60) res[i] -= 24*60;
			else if (res[i] < 0) res[i] += 24*60;
		}
		this.timeCycle = res;
	},

	calcUniformTimeCycle: function() {
		var res = new Array(this.imgCount + 1);
		var interval = (24 * 60) / this.imgCount;
		res[1] = 0;
		for (var i = 2; i <= this.imgCount + 1; i ++) res[i] = res[i - 1] + interval;
		for (var i = 1; i <= this.imgCount + 1; i ++) {
			if (res[i] >= 24 * 60) res[i] -= 24 * 60;
		}
		this.timeCycle = res;
	},

	updateTimeCircle: function() {
		this.refreshSunTimes(new Date());
		this.calcTimeCycle();
		this.update();
	},

	requestLocation: function() {
		this.updateTimeCircle();
	},

	// Apply properties to adjust control status
	applyProps: function(option) {
		if (!option || option == "customint4") document.body.style.transition = "background-image " + this.prop.aniDuration + "s ease-out";
		if (!option || option == "custombool2" || option == "customint2" || option == "customint3" || option == "customint6" || option == "customint7") this.updateTimeCircle();
		if (!option || option == "custombool") this[this.prop.staticMode ? "stopUpdate" : "startUpdate"]();
		if (!option || option == "customint") if (this.prop.staticMode) this.update();
		if (option == "customint5") {
			this.stopUpdate();
			this.startUpdate();
		}
	},

	// When properties are loaded, initialize the object
	initialize: function() {
		var propLoaded = (this.prop.staticMode !== null) && (this.prop.staticImgNo !== null)
			&& (this.prop.netLocation !== null) && (this.prop.aniDuration !== null)
			&& (this.prop.updateInt !== null);
		if (!propLoaded || this.initialized) return;
		this.applyProps();
		for (var i = 1; i <= this.imgCount; i ++) {
			var img = new Image();
			img.src = "img/" + i + ".png";
			this.preload.push(img);
		}
		this.initialized = true;
	}
};
