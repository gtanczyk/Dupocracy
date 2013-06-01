var Lobby = new (function() {
	this.selectRoom = function() {
		var selectRoom = new Deferred();
	
		var rooms = [];
	
		var gc = new GamedevCloud("http://www.gamedev.pl/api/");
		gc.getConnection('dupocracy').then(function(connection) {
			connection.hon('getRooms', function(header, body, data, clientID) {
				connection.toClient(clientID, 'rooms', JSON.stringify(rooms));			
			});
			connection.on('rooms', function(header, body) {
				rooms = JSON.parse(body);
				getRooms.resolve(rooms);
			});		
			
			connection.hon('newRoom', function(header, body, data, clientID) {
				var newRoom = JSON.parse(body);
				if(rooms.some(function(room) {
					return room.name == newRoom.name;
				}))
					connection.toClient(clientID, 'roomExists');
				else {				
					connection.broadcast('newRoom', JSON.stringify(newRoom));		
					connection.toClient(clientID, 'roomCreated');
				}
			});
			
			connection.on('newRoom', function(header, body) {
				room = JSON.parse(body);
				rooms.push(room);
			});						
			
			connection.on('removeRoom', function(header, body) {
				rooms = rooms.filter(function(room) {
					return room.name !== body;
				});
			});
			
			connection.hon('roomPong', function(header, body, data, clientID) {
				rooms.some(function(room){
					if(room.name == body) {
						room.lastPing = Date.now();
						if(!room.pingMap[clientID]) {
							room.pingMap[clientID] = Date.now();
							connection.broadcast('roomPingMap', room.name+':'+JSON.stringify(room.pingMap));
						} else
							room.pingMap[clientID] = Date.now();
							
						return true;
					}				
				})
			});
			
			connection.on('roomPingMap', function(header, body) {
				var roomName = body.substring(0, body.indexOf(':'));
				var pingMap = JSON.parse(body.substring(body.indexOf(':')+1));
				rooms.every(function(room) {
					if(room.name == roomName)
						room.pingMap = pingMap;
					else
						return true;				
				});
			});
			
			setInterval(function() {
				rooms.forEach(function(room) {
					if(Date.now() - room.lastPing > 30*1000)
						connection.broadcast('removeRoom', room.name)
					else
						var deleted = false;
						for(var clientID in room.pingMap)
							if(Date.now() - room.pingMap[clientID] > 5000) {
								delete room.pingMap[clientID];
								deleted = true;
							}
								
						if(deleted)
							connection.broadcast('roomPingMap', room.name+':'+JSON.stringify(room.pingMap));
					
				});
				connection.broadcast('roomPing');
			}, 3 * 1000);	
		
			var getRooms = new Deferred();
			getRooms.once(function(rooms) {
				UI.hideStatus();
				var lobbyUI = UI.roomLobby(rooms).
					createRoom(function(name) {
						var room = { 
				             name: name, 
				             server: connection.server, 
				             lastPing: Date.now(),
				             pingMap: {}
				        };
						connection.toHost('newRoom', JSON.stringify(room));
						connection.on('roomCreated', function() {
							selectRoom.resolve(room);
						});
					}).joinRoom(function(room) {
						selectRoom.resolve(room);
					});			
				var removeRoom = connection.on('removeRoom', function(header, body) {
					lobbyUI.removeRoom(body);
				});			
				var newRoom = connection.on('newRoom', function(header, body) {
					lobbyUI.addRoom(JSON.parse(body));
				});			
				selectRoom.then(function(room) {
					removeRoom.remove();
					newRoom.remove();
					
					connection.on('roomPing', function() {
						connection.toHost('roomPong', room.name);
					});				
				});
			});
			
			connection.toHost('getRooms');
		});
		return selectRoom;
	}
})();
