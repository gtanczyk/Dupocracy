(function(global) {
	function GamedevCloud(apiURI) {
		this.apiURI = apiURI || 'http://www.gamedev.pl/api/';
	}

	GamedevCloud.prototype.getConnection = function(channel) {
		var result = new Deferred();
		xhrGet(this.apiURI + "proxyservers").then(function(servers) {
			function checkServer(server) {
				var url = 'ws://'+server.host+':'+server.port+'/'+channel;
				var socket = new WebSocket(url);
				
				socket.onopen = function() {
					socket.onclose = null;
					socket.close();					
					var connection = new Connection(socket = new WebSocket(url), server)
					socket.onopen = function(){
						result.resolve(connection);
					};
				};
				
				socket.onclose = socket.onerror = function() {
					if(servers.length > 0)
						checkServer(servers.splice(0,1)[0])
					else
						result.resolve(new Connection({url: 'loopback'}));
				};										
			}
			
			checkServer(servers.splice(0,1)[0])
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

	Deferred.prototype.then = function(fn, check) {
		if (typeof this.result != 'undefined' && !check)
			fn.apply(null, this.result);
		else {
			var listener = {fn: fn, check: check};
			this.listeners.push(listener)
			return listener;
		}
	}
	
	Deferred.prototype.only = function(fn, check) {
		this.listeners.length  = 0;
		return this.then(fn, check);
	}	
	
	Deferred.prototype.once = function(fn) {
		var listener;
		listener = this.then(function() {
			if(listener)
				this.listeners.splice(this.listeners.indexOf(listener), 1);
			fn.apply(null, this.result);
		}.bind(this));
	}	
	
	Deferred.prototype.resolved = function() {
		return typeof this.result != 'undefined';
	}	
	
	Deferred.prototype.clear = function() {
		delete this.result;
	}		

	Deferred.prototype.resolve = function() {
		if(this.result && this.single)
			return;
			
		var result = this.result = arguments;
		this.listeners.some(function(listener) {
			(!listener.check || listener.check.resolved()) && listener.fn.apply(null, result);
		});
	}

	global["Deferred"] = Deferred;

})(this)