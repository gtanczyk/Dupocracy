var lobby = new (function() {
	var selectRoom = this.selectRoom = new Deferred();

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

		connection.toHost('getRooms');	
		
		setInterval(function() {
			rooms.forEach(function(room) {
				if(Date.now() - room.lastPing > 30*1000)
					connection.broadcast('removeRoom', room.name)
			});
		}, 10 * 1000);	
	
		var getRooms = new Deferred();
		getRooms.once(function(rooms) {
			UI.hideStatus();
			var lobbyUI = UI.roomLobby(rooms).
				createRoom(function(name) {
					var room = { name: name, server: connection.server, lastPing: Date.now() };
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
			selectRoom.then(function() {
				removeRoom.remove();
				newRoom.remove();
			});
		});
	});
})();
