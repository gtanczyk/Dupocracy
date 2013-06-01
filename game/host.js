var Host = new (function() {
	var getConnection = this.getConnection = new Deferred();

	view.ready.then(function() {	
		// specify socket connection explict in query string
		var queryString = (window.location.href.match(/\?(loopback|(.+))$/)||[])[1];
		if(queryString)
			getConnection.resolve(new Connection(queryString=='loopback' ? {url: queryString} : new WebSocket('ws://'+queryString)));
		else
			// it will resolve getSocket with real websockets connection or fake local one
			lobby.selectRoom.then(function(room) {
				UI.showStatus('Connecting to server...');
				getConnection.resolve(new Connection(new WebSocket('ws://'+room.server.host+':'+room.server.port+'/'+room.name), room.server));
			});				
	});
})();