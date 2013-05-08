(function(global) {
	function GamedevCloud(apiURI) {
		this.apiURI = apiURI || 'http://www.gamedev.pl/api/';
	}

	GamedevCloud.prototype.getProxyServers = function() {
		var result = new Deferred();
		xhrGet(this.apiURI + "proxyservers").then(function(response) {
			result.resolve(response);
		});
		return result;
	}

	global["GamedevCloud"] = GamedevCloud;

	// xhr

	function xhr(method, url, content) {
		var result = new Deferred()
		var req = new XMLHttpRequest();
		req.open(method, url);
		req.onreadystatechange = function() {
			if (req.readyState == 4)
				result.resolve(JSON.parse(req.responseText).map(function(el) {
					el = el.split(':');
					return {
						host : el[0],
						port : el[1]
					}
				}));
		};
		req.send(null);
		return result;
	}

	function xhrGet(url, content) {
		return xhr("GET", url, content);
	}

	function xhrPost(url, content) {
		return xhr("POST", url, content);
	}

	// deferred

	function Deferred(single) {
		this.listeners = [];
		this.single = single;
	}

	Deferred.prototype.then = function(fn) {
		if (typeof this.result != 'undefined')
			fn.apply(null, this.result);
		else
			this.listeners.push(fn);
	}

	Deferred.prototype.resolve = function() {
		if(this.result && this.single)
			return;
			
		var result = this.result = arguments;
		this.listeners.some(function(listener) {
			listener.apply(null, result);
		});
	}

	global["Deferred"] = Deferred;

})(this)