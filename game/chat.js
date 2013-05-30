var Chat;

DomReady.ready(function() {
	Chat = new (function() {
		Host.getConnection.then(function(connection) {
			var clients = [];
			
			connection.hon('clients', function(header, body, data, clientID) {
				connection.toClient(clientID, 'clients', JSON.stringify(clients));
			})
			
			connection.on('newClient', function(header, body) {
				var client = JSON.parse(body); 
				var clientID = client.clientID;
				if(clients.every(function(client) { return client.clientID != clientID }))
					clients.push(client);
			});
			
			connection.on('yourSelf', function(header, mySelf) {
				
				connection.toHost('clients');

				connection.on('clients', function(header, body) {
					
					JSON.parse(body).some(function(newClient) {
						if(clients.every(function(client) { return client.clientID != newClient.clientID }))
							clients.push(newClient);
					});				
					
					var chatNode = document.createElement('div');
					chatNode.className = 'chat';
					document.body.appendChild(chatNode);
					
					var msgNode = document.createElement('div');
					msgNode.className = 'chat-msg';
					chatNode.appendChild(msgNode);
					
					var inputNode = document.createElement('form');
					inputNode.className = 'chat-input';
					inputNode.innerHTML = '<input type="text"/>'
					chatNode.appendChild(inputNode);
					
					inputNode.addEventListener('submit', function(event) {
						event.preventDefault();
						
						var msg = inputNode.querySelector('input');
						
						connection.toHost('chatMsg', msg.value);
						
						msg.value = '';								
					});				
					
					var chatLog = [];
					
					function addLine(line) {
						chatLog.push(line)
						var node = document.createElement('input');
						node.value = line;
						node.disabled = true;
						msgNode.insertBefore(node, msgNode.firstChild);
					}
					
					connection.on('chatMsg', function(header, body) {
							var msg = JSON.parse(body);
							var sender = clients.filter(function(client)  { return client.clientID == msg.clientID })[0].name;
							addLine(sender+': '+msg.body);
					});
					
					connection.on('winner', function(header, body) {
						body = JSON.parse(body);
						addLine(body.faction+'('+body.name+') has won!');
					});
				
					connection.hon('chatMsg', function(header, body, data, clientID) {
						if(body.length > 0)
							connection.broadcast('chatMsg', JSON.stringify({ clientID: clientID, body: body }))
					});
					
					connection.toHost('chatLog');
					
					connection.on('chatLog', function(header, body) {
						chatLog = JSON.parse(body);
						chatLog.some(function(line) {
							addLine(line);
						});
					});
					
					connection.hon('chatLog', function(header, body, data, clientID) {					
						if(chatLog.length == 0)
							addLine(mySelf + ' creates room');
						else
							connection.toClient(clientID, 'chatLog', JSON.stringify(chatLog.slice(0, 100)));
					});
					
					connection.on('newClient', function(header, body) {
						var client = JSON.parse(body); 
						addLine(client.name + ' joins game');
					});
					
					connection.hon('leave', function(header, body) {
						var clientID = body; 			
						clients = clients.filter(function(client) {
							if(client.clientID == clientID)
								addLine(client.name + ' leaves game');
							else 
								return true;
						});						
					});
				
				});
			}, { single: true });
		});
	})();
});