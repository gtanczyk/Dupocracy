var dupocracy;
DomReady.ready(function() {
	dupocracy = new (function() {
		var connect = new Deferred(true);
		var init = new Deferred();
		var control = new Deferred();
		var named = new Deferred();
	
		var factionWidget;
	
		init.then(function(connection) {		
			factionWidget = new UI.FactionWidget(factions);	
	
			// ask for game state when you are in client mode
			connection.toHost('getGameState');
			connection.on('newGameState', function(header, body) {
				var gameState = JSON.parse(body);
				players = gameState.players;
				world.restore(gameState.world);
				
				factionWidget.reset();
								
				Object.keys(players).some(function(slot) {
					factionWidget.markSlot(slot, players[slot].name);
				});		
				
				GameStates.connected.resolve();
			});
			
			connection.hon('getGameState', function(header, body, data, clientID) {
				var gameState = {
					players: players,				
					world: world.store()
				}
				
				connection.toClient(clientID, 'newGameState', JSON.stringify(gameState));
			});		
			
			connection.toHost('mySelf');
			connection.on('whoAreYou', function(header, body, data, listener) {
				UI.nameDialog().then(function(name, result) {
					connection.toHost('registerSelf', name);
					var yourSelf = connection.on('yourSelf', function(header, body, data, listener) {
						result.resolve(true);
						
						// clear listener
						nameTaken.remove();
						
						named.resolve();
					}, {single: true})
					var nameTaken = connection.on('nameTaken', function(header, body, data, listener) {
						result.resolve(false, 'This name is already taken by other player.');
						// clear listener
						yourSelf.remove(false);
					}, {single: true});			
				});
			}, {single: true});
		});
		
		function getFreeSlots() {
			return factions.filter(function(faction) {
				return !players[faction];
			});
		}	
		
		function joinGame(slot) {
			var result = new Deferred();
			
			connect.once(function(connection) {
				connection.toHost('claimSlot', slot);
				connection.on('yourSlot', function(header, body, data) {
					result.resolve(body);
				}, { single: true });
				connection.on('slotAlreadyTaken', function() {
					result.resolve(false);
				}, { single: true });
			});
			
			return result;
		}	
		
		var factions = [ 'Europe', 'Africa', 'North America', 'Latin America', 'Asia', 'Russia' ];		
	
		var players = {};
		
	
		var GameStates = {};
		var currentGameState;
	
		['connect', 'connected', 'init', 'prepare', 'warfare', 'end', 'restart'].some(function(state) {
			(GameStates[state] = new Deferred()).then(function() {
				if(currentGameState && currentGameState != state)
					GameStates[currentGameState].clear();
				currentGameState = state;
			});
		});	
		
		// connection state
		
		GameStates.connect.resolve();
	
		GameStates.connect.then(function() {
			UI.showStatus('Connecting to server...');
		});
		
		// connected
		init.then(function(connection) {
			GameStates.connected.then(function() {
				UI.hideStatus();			
				connection.toHost('getCurrentGameState');
			});
		});
		
		// init state, name dialog etc.
		init.then(function(connection) {
			GameStates.init.then(function() {
				UI.hideStatus(); 				
			});
		});
	
		// client
	
		init.then(function(connection) {	
			GameStates.init.then(function() {
				named.then(function() {
					factionWidget.show();
					factionWidget.joinSlot.once(function(slot) {
						joinGame(slot).once(function(slot) {
							factionWidget.clearAll();
							if(slot)
								factionWidget.ready().then(function() {
									factionWidget.hide();
									connection.toHost('playerReady', true);
									UI.showStatus('Waiting for other players');
									control.resolve(slot);
								});
							else
								control.resolve(slot);
						});
					});
				});
			});
			
			connection.hon('getCurrentGameState', function(header, body, data, clientID) {
				connection.toClient(clientID, 'currentGameState', currentGameState=='connected' ? 'init':currentGameState);
			});
	
			connection.on('currentGameState', function(header, body, data) {
				GameStates[body].resolve();
			});				
			
			connection.on('slotTaken', function(header, body, data) {
				var slot = JSON.parse(body);
				players[slot.id] = slot;
				factionWidget.markSlot(slot.id, slot.name);
			});
			
			// new objects
			
			connection.on('newObject', function(header, body, data) {
				body = JSON.parse(body);
				world.add(body.type, body.x, body.y, body.opts);
			});	
	
			connection.hon('makeObject', function(header, body, data, clientID) {
				body = JSON.parse(body);
				if(world.canAdd(body.type, body.x, body.y, body.opts))
					connection.broadcast('newObject', JSON.stringify(body));
			});		
			
			// targets

			connection.hon('setTarget', function(header, body, data, clientID) {
				body = JSON.parse(body);
				connection.broadcast('setTarget', JSON.stringify(body));				
			});
			
			connection.on('setTarget', function(header, body, data, clientID) {
				body = JSON.parse(body);
				world.setTarget(body.id, body.x, body.y);
			});
			
			// mode switch
			
			connection.hon('switchMode', function(header, body, data, clientID) {
				connection.broadcast('switchMode', body);				
			});
			
			connection.on('switchMode', function(header, body, data, clientID) {
				world.switchMode(body);
			});

					
			// object removal
			
			connection.on('removeObject', function(header, body, data) {
				world.remove(body);
			});
			
			world.onRemove(function(objectID) {
				connection.broadcast('removeObject', objectID);
			});					
		
			// prepare state
			GameStates.prepare.then(function() {
				UI.hideStatus();
	
				UI.showStatus('Prepare stage, place launchers and radars.');
				world.after(2000, function() {
					UI.hideStatus();
				});
				
				world.after(60000, function() {
					connection.broadcast('currentGameState', 'warfare');
				});
				control.then(function(mySlot) {	
					Selection.point.then(function(viewX, viewY, worldX, worldY, selection) {
						if(selection.length == 0)
							UI.contextMenu(viewX, viewY, [['launcher', 'Launcher'], ['radar', 'Radar']].map(function(el) { return [el[0], el[1] + ' ('+world.countGroup(el[0], mySlot)+'/5)'] })).then(function(option) {
								connection.toHost("makeObject", JSON.stringify({ type: option, x: worldX, y: worldY, opts: { faction: mySlot, mode: Math.random() > 0.5 ? 1 : 0 } }));
							});
					}, GameStates.prepare);
					
					Selection.filter.resolve(mySlot);
					
				});
			});
			
			// warfare state
			GameStates.warfare.then(function() {
				UI.showStatus('Warfare stage.');
				world.after(2000, function() {
					UI.hideStatus();
				});
				
				world.after(60000 * 10, function() {
					connection.broadcast('currentGameState', 'end');
				});
				
				control.then(function(mySlot) {	
					Selection.point.then(function(viewX, viewY, worldX, worldY, selection) {
						if(selection.length > 0)
							UI.contextMenu(viewX, viewY, [['attack', 'Attack'], ['defend', 'Defend']]).then(function(option) {
								if(option == 'attack') {
									selection.some(function(object) {
										if(object.type == 'launcher') { 											
											if(object.opts.mode==0)
												connection.toHost("switchMode", object.id);											
											connection.toHost("setTarget", JSON.stringify({ id: object.id, x: worldX, y: worldY }));										
										}
									});							
								} else if(option == 'defend') {
									selection.some(function(object) {
										if(object.type == 'launcher' && object.opts.mode==1)
											connection.toHost("switchMode", object.id); 
									});																
								}
							});				
					}, GameStates.warfare);			
				});
			});		
		
			// end state
			GameStates.end.then(function() {
				world.stop();
				
				UI.showStatus('Game over, everybody died.');
				setTimeout(function() { 
					UI.hideStatus(); 
					connection.toHost('maybeRestart');					
				
					connection.hon('maybeRestart', function() {
						GameStates.restart.resolve();
						connection.broadcast('currentGameState', 'restart');
					}, { single: true });
				
				}, 5000);
						
			});		
			
			// restart state
			GameStates.restart.then(function() {
				UI.showStatus('Restarting game');
				setTimeout(function() {
					var gameState = {
						players: {},				
						world: world.initial
					}
					
					connection.broadcast('currentGameState', 'init');
					connection.broadcast('newGameState', JSON.stringify(gameState));
				}, 5000);
	//			setTimeout(UI.hideStatus.bind(UI), 5000);	
			});
		
		});		
		
		// host
	
		connect.then(function(connection) {
			var clients = [];
			
			connection.hon('mySelf', function(header, body, data, clientID) {
				var name = (clients.filter(function(client) { return client.clientID == clientID })[0]||{}).name;
				if(name)
					connection.toClient(clientID, 'yourSelf', name);
				else
					connection.toClient(clientID, 'whoAreYou');
			});
	
			connection.hon('registerSelf', function(header, body, data, clientID) {
				if (clients.some(function(client) { return client.name == body }))
					return connection.toClient(clientID, 'nameTaken', body);
					
				var client = { name: body, clientID: clientID };
				
				connection.toClient(clientID, 'yourSelf', body);
				connection.broadcast('newClient', JSON.stringify(client));
			});
			
			connection.on('newClient', function(header, body) {
				var client = JSON.parse(body); 
				clients.push(client);
			})
			
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
					
				}			
			});		
			
			connection.hon('leave', function(header, body, data, clientID) {
				Object.keys(players).some(function(faction) {
					if(players[faction].clientID == clientID)
						connection.broadcast('clearSlot', faction);					
				})
			});
			
			connection.on('clearSlot', function(header, body) {
				factionWidget.clearSlot(body);
				delete players[body];
			});
			
			// ready in init state
			
			connection.hon('playerReady', function(header, body, data, clientID) {
				var ready = body === 'true';
				
				if(Object.keys(players).filter(function(slot) {
						if(players[slot].clientID == clientID)
							players[slot].ready = ready;
						return true;
					}).every(function(slot) {
						return players[slot].ready;
					}))
						GameStates.init.then(function() {
							connection.broadcast('currentGameState', 'prepare');
						});
			});
	
			
			init.resolve(connection);
		});
		
		Host.getConnection.then(function(connection) {			
			
			// debug
			connection.on(/(.*)/, function(header) {
				if(arguments[1]!='ping:' && arguments[0]!='pong')
					console.log("debug:", arguments)
			});
			
			connection.on(/(.*)/, function() {
				connect.resolve(connection);
			}, { single: true });
		});
	})();
});