var dupocracy = new (function() {
	var connect = new Deferred(true);
	var init = new Deferred();
	var control = new Deferred(true);

	var factionWidget

	init.then(function(connection) {
		
		factionWidget = new ui.FactionWidget(factions);	

		// ask for game state when you are in client mode
		connection.toHost('getGameState');
		connection.on('newGameState', function(header, body) {
			var gameState = JSON.parse(body);
			players = gameState.players;
			world.restore(gameState.world);
			
			Object.keys(players).some(function(slot) {
				factionWidget.markSlot(slot, players[slot].name);
			});
			
			ui.nameDialog(getFreeSlots()).then(function(name, slot, result) {
				connection.toHost('registerSelf', name);
				var yourSelf = connection.on('yourSelf', function(header, body, data, listener) {
					result.resolve(true);
					
					// clear listener
					nameTaken.remove();
					
					if(slot)
						joinGame(slot).then(function(slot) {
							if(slot)
								control.resolve(slot);
						});
				}, {single: true})
				var nameTaken = connection.on('nameTaken', function(header, body, data, listener) {
					result.resolve(false, 'This name is already taken by other player.');
					// clear listener
					yourSelf.remove(false);
				}, {single: true});			
			});
		});
		connection.hon('getGameState', function(header, body, data, clientID) {
			var gameState = {
				players: players,
				world: world.store()
			}
			
			connection.toClient(clientID, 'newGameState', JSON.stringify(gameState))
		});				
	});
	
	function getFreeSlots() {
		return factions.filter(function(faction) {
			return !players[faction];
		});
	}	
	
	function joinGame(slot) {
		var result = new Deferred();
		
		connect.then(function(connection) {
			connection.toHost('claimSlot', slot);
			connection.on('yourSlot', function(header, body, data) {
				result.resolve(body);
			}, { single: true });
			connection.on('slotAlreadyTaken', function() {
				result.resolve(false);
			});
		});
		
		return result;
	}	
	
	var factions = [ 'europe', 'africa', 'namerica', 'lamerica', 'asia', 'russia' ];		

	var players = {};

	// client

	init.then(function(connection) {

		connection.on('gameStart', function() {
		});		
		
		
		connection.on('slotTaken', function(header, body, data) {
			var slot = JSON.parse(body);
			players[slot.id] = slot;
			factionWidget.markSlot(slot.id, slot.name);
		});
		
		connection.on('newObject', function(header, body, data) {
			body = JSON.parse(body);
			world.add(body.type, body.x, body.y, body.opts);
		});
		
		connection.hon('makeObject', function(header, body, data, clientID) {
			body = JSON.parse(body);
			connection.broadcast('newObject', JSON.stringify(body));
		});					
	
		// game control
	
		control.then(function(mySlot) {
			var selection = [];
		
			view.on('contextmenu', function(event) {
				event.preventDefault();
	
				if(selection.length > 0)
					ui.contextMenu(event.clientX, event.clientY, [['attack', 'Attack']]).then(function(option) {
						if(option == 'attack') {
							selection.some(function(object) {
								if(object.type == 'launcher')
									connection.toHost("makeObject", JSON.stringify({ type: 'missile', x: object.x, y: object.y, 
										opts: { tx: event.eX, ty: event.eY } }));
							});							
						}
					});
				else
					ui.contextMenu(event.clientX, event.clientY, [['launcher', 'Launcher'], ['radar', 'Radar']]).then(function(option) {
						connection.toHost("makeObject", JSON.stringify({ type: option, x: event.eX, y: event.eY }));
					});
			});
			
			// unit selection
			
			var mouseMoved, mousePressed, pressX, pressY;
			
			view.on('click', function(event) {
				if(!mouseMoved && !world.query(event.eX, event.eY, 8).some(function(object) {
					if(selection.indexOf(object)==-1)
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
				pressX = event.eX;
				pressY = event.eY;
			});		
			
			view.on('mouseup', function(event) {
				mousePressed = false;
			});		
			
			view.on('mousemove', function(event) {
				mouseMoved = true;
				var rect = mousePressed && [pressX, pressY, event.eX, event.eY];
				
				if(mousePressed) {			
					if(!world.query(event.eX, event.eY, 8, rect).every(function(object) {
						if(selection.indexOf(object)==-1)
							selection.push(object.selected = true && object);				
						return true;
					}))					
						selection = selection.filter(function(object) {
							object.selected = false;
						});							
				} else
					view.pointer(world.query(event.eX, event.eY, 8).length > 0);
					
			});
			
		});
	});

	// host

	connect.then(function(connection) {
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
		
		connection.hon('leave', function(header, body, data, clientID) {
			Object.keys(players).some(function(faction) {
				if(players[faction].clientID == clientID)
					connection.broadcast('clearSlot', faction);
				
			})
		});
		
		connection.on('clearSlot', function(header, body) {
			factionWidget.markSlot(body);
			delete players[body];
		});		
		
		init.resolve(connection);
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

					connection.on(/(.*)/, function() {
						connect.resolve(connection);
					}, { single: true });
				});
			});
})();
