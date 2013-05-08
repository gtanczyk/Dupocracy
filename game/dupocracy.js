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
	
	gameState.feed(GS_INIT, E_INIT, GS_DEFCON2, function() {
		console.log('dupa')
	});
	
	gameState.init(GS_INIT);
	
	var factions = [ 'europe', 'africa', 'namerica', 'lamerica', 'asia', 'russia' ];

	var players = {};

	// client

	init.then(function(connection) {

		// networking

		connection.on('gameStart', function() {
		});		

		connection.on('yourSlot', function(header, body, data) {
			mySlot = body;
			control.resolve(body);
		});
		
		connection.on('slotTaken', function(header, body, data) {
			var slot = JSON.parse(body);
			players[slot.id] = slot;
		});
		
		connection.on('newObject', function(header, body, data) {
			
		});
		
	});
	
	// game control

	control.then(function(mySlot) {
		var selection = [];
	
		view.on('contextmenu', function(event) {
			event.preventDefault();

			if(selection.length > 0)
				ui.contextMenu(event.x, event.y, [['attack', 'Attack']]).then(function() {
				});
			else
				ui.contextMenu(event.x, event.y, [['launcher', 'Launcher'], ['radar', 'Radar']]).then(function(option) {
					world.add(option, event.x, event.y);
				});
		});
		
		var mouseMoved, mousePressed, pressX, pressY;
		
		view.on('click', function(event) {
			if(!mouseMoved && !world.query(event.x, event.y, 8).some(function(object) {
				selection.push(object.selected = true && object);
				return true;
			}))
				selection = selection.filter(function(object) {
					object.selected = false;
				});	
		});
		
		view.on('mousedown', function(event) {
			mouseMoved = false;
			mousePressed = true;
			pressX = event.x;
			pressY = event.y;
		});		
		
		view.on('mouseup', function(event) {
			mousePressed = false;
		});		
		
		view.on('mousemove', function(event) {
			mouseMoved = true;
			var rect = mousePressed && [pressX, pressY, event.x, event.y];
			
			if(mousePressed) {			
				if(!world.query(event.x, event.y, 8, rect).every(function(object) {				
					selection.push(object.selected = true && object);				
					return true;
				}))					
					selection = selection.filter(function(object) {
						object.selected = false;
					});							
			} else
				view.pointer(world.query(event.x, event.y, 8).length > 0);
				
		});
		
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
