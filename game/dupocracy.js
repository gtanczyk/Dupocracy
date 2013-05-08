var dupocracy = new (function() {
	var init = new Deferred();
	var control = new Deferred();

	var self;

	this.initSelf = function(dialog) {
		init.then(function(connection) {
			connection.toHost('registerSelf', dialog.querySelector('input').value);
			var yourSelf = connection.on('yourSelf', function(header, body, data, listener) {
				self = body;
				dialog.remove();
				document.querySelector('body>.mask').remove();
				
				// clear listener
				nameTaken.remove();
				
				joinGame();
			}, {single: true})
			var nameTaken = connection.on('nameTaken', function(header, body, data, listener) {
				dialog.querySelector('.error').innerHTML = 'This name is already taken by other player.'
				// clear listener
				yourSelf.remove();
			}, {single: true});			
		});
	}
	
	function joinGame() {
		init.then(function(connection) {
			var freeSlots = factions.filter(function(faction) {
				return !players[faction];
			});
			freeSlots.sort(function() {
				return Math.random() - Math.random()
			});
		
			connection.toHost('claimSlot', freeSlots[0]);
		});
	}
	
	// status

	var GS_INIT = 1 << 1, GS_DEFCON2 = 1 << 2, GS_DEFCON1 = 1 << 3, GS_DEFCON0 = 1 << 4;
	var E_INIT = 1 << 1, E_OVER = 1 << 2;

	var gameState = new StateMachine();
	gameState.bitMode(true, true);
	
	gameState.feed(GS_INIT, E_INIT, GS_PLAY, function() {
		
	});
	
	gameState.feed(GS_INIT, E_INIT, GS_PLAY, function() {
		
	});

	var factions = [ 'europe', 'africa', 'namerica', 'lamerica', 'asia', 'russia' ];

	var players = {};

	// client

	init.then(function(connection) {

		// networking

		connection.on('yourSlot', function(header, body, data) {
			mySlot = body;
			control.resolve(body);
		});
		
		connection.on('slotTaken', function(header, body, data) {
			var slot = JSON.parse(body);
			players[slot.id] = slot;
		});
	});
	
	// game control

	control.then(function(mySlot) {
	});

	// host

	init.then(function(connection) {
		var clients = [];

		connection.hon('registerSelf', function(header, body, data, clientID) {
			if (clients.some(function(client) { return client.name == body }))
				return connection.toClient(clientID, 'nameTaken', body);
				
			clients.push({ name: body, clientID: clientID });
			
			connection.toClient(clientID, 'yourSelf', body);
			connection.broadcast('newClient', body);
		});
		
		connection.hon('claimSlot', function(header, body, data, clientID) {
			if(players[body])
				return connection.toClient(clientID, 'slotAlreadyTaken');
			else if(factions.indexOf(body) >= 0) {
				players[body] = {
				    id: body,
					clientID: clientID,
					name: clients.filter(function(client) { return client.clientID == clientID })[0].name
                };				
			
				connection.toClient(clientID, 'yourSlot', body);
				connection.broadcast('slotTaken', JSON.stringify(players[body]));
				
				if(Object.keys(players).length >= 1)
					connection.broadcast('gameStart');
			}			
		});		
	});

	// get connection

	var gc = new GamedevCloud("http://www.gamedev.pl/api/");
	gc.getProxyServers().then(
			function(servers) {
				servers.some(function(server) {
					var connection = new Connection('ws://' + server.host + ':'
							+ server.port);

					// debug
					connection.on(/(.*)/, function() {
						console.log("debug:", arguments)
					});

					init.resolve(connection);
				});
			});
})();
