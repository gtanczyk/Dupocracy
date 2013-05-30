var dupocracy;
DomReady.ready(function() {
	dupocracy = new (function() {
		var connect = new Deferred(true);
		var init = new Deferred();
		var control;
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
				console.log('Claim slot', slot);
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
			var changeState = function() {
				if(currentGameState && currentGameState != state)
					GameStates[currentGameState].clear();
				currentGameState = state;
			};
			(GameStates[state] = new Deferred()).then(changeState);
			GameStates[state].only = function(fn, check) {
				this.listeners.length = 0;
				this.then(fn, check);
				this.then(changeState);
			}
		});	
		
		// connection state
		
		GameStates.connect.resolve();
	
		GameStates.connect.only(function() {
			UI.showStatus('Connecting to server...');
		});
		
		// connected
		init.then(function(connection) {
			GameStates.connected.only(function() {
				UI.hideStatus();			
				connection.toHost('getCurrentGameState');
			});
		});
		
		// client
	
		init.then(function(connection) {	
			GameStates.init.only(function() {
				UI.hideStatus(); 				
				named.then(function() {
					world.setVisibleFaction(null);
					factionWidget.show();
					factionWidget.joinSlot.once(function(slot) {
						joinGame(slot).once(function(slot) {
							control = new Deferred();
							world.setVisibleFaction(slot);
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
				world.add(body.type, body.x, body.y, body.opts, body.id);
			});	
	
			connection.hon('makeObject', function(header, body, data, clientID) {
				body = JSON.parse(body);
				if(players[body.opts.faction].clientID == clientID &&
					world.canAdd(body.type, body.x, body.y, body.opts)) {
					body.id = world.nextID();
					connection.broadcast('newObject', JSON.stringify(body));
				}
			});					
			
			// targets

			connection.hon('setTarget', function(header, body, data, clientID) {
				body = JSON.parse(body);
				connection.broadcast('setTarget', JSON.stringify(body));				
			});
			
			connection.on('setTarget', function(header, body, data, clientID) {
				body = JSON.parse(body);
				world.setTarget(body.id, body.x, body.y, body.mode);
			});
			
			// mode switch
			
			connection.hon('switchMode', function(header, body, data, clientID) {
				connection.broadcast('switchMode', body);				
			});
			
			connection.on('switchMode', function(header, body, data, clientID) {
				body = JSON.parse(body);
				world.switchMode(body.objectID, body.mode);
			});

					
			// object removal
			
			connection.on('removeObject', function(header, body, data) {
				world.remove(body);
			});
			
			world.onRemove(function(objectID) {
				connection.broadcast('removeObject', objectID);
			});					
		
			// prepare state
			GameStates.prepare.only(function() {
				UI.hideStatus();
	
				UI.showStatus('Prepare stage, place launchers and radars. 3 minutes remaining!');
				world.after(5000, function() {
					UI.hideStatus();
				});
				
				world.after(60000 * 3, function() {
					connection.broadcast('currentGameState', 'warfare');
				});
				
				Selection.clear();
				control.then(function(mySlot) {						
					Selection.point.only(function(viewX, viewY, worldX, worldY, selection) {
						if(selection.length > 0)
							UI.contextMenu(viewX, viewY, [['attack', 'Attack mode'], ['defend', 'Defend mode'], ['scout', 'Scout mode']]).only(function(option) {
								if(option == 'attack') {
									selection.some(function(object) {
										if(object.type == 'launcher') 											
											connection.toHost("switchMode", JSON.stringify({ objectID: object.id, mode: 1}));											
									});							
								} else if(option == 'scout') {
									selection.some(function(object) {
										if(object.type == 'launcher')
											connection.toHost("switchMode", JSON.stringify({ objectID: object.id, mode: 2}));											
									});							
								} else if(option == 'defend') {
									selection.some(function(object) {
										if(object.type == 'launcher')
											connection.toHost("switchMode", JSON.stringify({ objectID: object.id, mode: 0 })); 
									});																
								}
							});	
						if(selection.length == 0)
							UI.contextMenu(viewX, viewY, [['launcher', 'Launcher'], ['radar', 'Radar']].map(function(el) { return [el[0], el[1] + ' ('+world.countGroup(el[0], mySlot)+'/5)'] })).only(function(option) {
								connection.toHost("makeObject", JSON.stringify({ type: option, x: worldX, y: worldY, opts: { faction: mySlot, mode: Math.random() > 0.5 ? 1 : 0 } }));
							});
					}, GameStates.prepare);
					
					Selection.filter.resolve(mySlot);
					
					world.onAdd(function(type, x, y, opts) {
						if(mySlot && opts.faction == mySlot)
							connection.toHost('makeObject', JSON.stringify({ type: type, x: x, y: y, opts: opts }));
					});
				});
			});
			
			// warfare state
			GameStates.warfare.only(function() {
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
							UI.contextMenu(viewX, viewY, [['attack', 'Attack'], ['defend', 'Defend'], ['scout', 'Scout']]).then(function(option) {
								if(option == 'attack') {
									selection.some(function(object) {
										if(object.type == 'launcher') { 											
											if(object.opts.mode != 1)
												connection.toHost("switchMode", JSON.stringify({ objectID: object.id, mode: 1}));											
											connection.toHost("setTarget", JSON.stringify({ id: object.id, x: worldX, y: worldY, mode: 1 }));										
										}
									});							
								} else if(option == 'scout') {
									selection.some(function(object) {
										if(object.type == 'launcher') { 											
											if(object.opts.mode != 2)
												connection.toHost("switchMode", JSON.stringify({ objectID: object.id, mode: 2}));											
											connection.toHost("setTarget", JSON.stringify({ id: object.id, x: worldX, y: worldY, mode: 2 }));										
										}
									});							
								} else if(option == 'defend') {
									selection.some(function(object) {
										if(object.type == 'launcher' && object.opts.mode != 0)
											connection.toHost("switchMode", JSON.stringify({ objectID: object.id, mode: 0 })); 
									});																
								}
							});				
					}, GameStates.warfare);			
					
					var surrender = new Deferred();					
					surrender.once(function() {
						connection.toHost('surrender');;
					});
								
					world.onRemove(function() {
						if(world.countGroup('radar', mySlot) + world.countGroup('launcher', mySlot) == 0)
							surrender.resolve();
//						else if(world.countGroup(mySlot, 'launcher') == 0)
//							ui.surrender().then(function() {
//								surrender.resolve();
//							});
					});
				});
			});		
		
			// end state
			GameStates.end.only(function() {
				world.stop();
				
				console.log('%cRESTART', 'color: red');
				
				UI.showStatus('Game over, everybody died.');
				setTimeout(function() { 
					UI.hideStatus(); 
					connection.toHost('maybeRestart');									
					connection.hon('maybeRestart', function() {
						console.log('%cRESTART', 'color: blue');
						GameStates.restart.resolve();
						connection.broadcast('currentGameState', 'restart');
					}, { single: true });
				
				}, 5000);
						
			});		
			
			// restart state
			GameStates.restart.only(function() {
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
			
			connection.on('remClient', function(header, clientID) {
				clients = clients.filter(function(client) {
					return client.clientID != clientID;
				});
			})
			
			connection.hon('claimSlot', function(header, body, data, clientID) {
				if(players[body])
					return connection.toClient(clientID, 'slotAlreadyTaken');
				else if(factions.indexOf(body) >= 0) {
					Object.keys(players).some(function(slot) {
						if(players[slot].clientID == clientID)
							connection.broadcast('clearSlot', slot);
					});
					
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
				connection.broadcast('remClient', clientID);
				Object.keys(players).some(function(faction) {
					if(players[faction].clientID == clientID)					
						connection.broadcast('clearSlot', faction);
				});
			});
			
			connection.hon('surrender', function(header, body, data, clientID) {
				connection.broadcast('surrender', clientID);
				Object.keys(players).some(function(faction) {
					if(players[faction].clientID == clientID)					
						connection.broadcast('clearSlot', faction);
				})
			});
			
			connection.on('clearSlot', function(header, body) {
				factionWidget.clearSlot(body);				
				delete players[body];
				
				if(Object.keys(players).length <= 1)
					connection.toHost('maybeEnd');
			});
			
			var doEnd = new Deferred();
			doEnd.once(function() {
				Object.keys(players).some(function(slot) { 
					connection.broadcast('winner', JSON.stringify({ faction: slot, name: players[slot].name }));
				});
				connection.broadcast('currentGameState', 'end');
			})
			
			connection.hon('maybeEnd', function() {
				GameStates.warfare.then(function() {
					if(Object.keys(players).length <= 1)
						doEnd.resolve();
				});
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
					}) && Object.keys(players).length > 1)
						GameStates.init.once(function() {
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