var Host = new (function() {
	var getConnection = this.getConnection = new Deferred();

	var gc = new GamedevCloud("http://www.gamedev.pl/api/");
	// specify socket connection explict in query string
	var queryString = (window.location.href.match(/\?(loopback|(.+))$/)||[])[1];
	if(queryString)
		getConnection.resolve(new Connection(queryString=='loopback' ? {url: queryString} : new WebSocket('ws://'+queryString)));
	else
	// it will resolve getSocket with real websockets connection or fake local one
		gc.getConnection().then(getConnection.resolve.bind(getConnection));
		
})();
		