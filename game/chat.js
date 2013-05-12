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
				clients.push(client);
			});
			
			connection.on('yourSelf', function(header, mySelf) {
				
				connection.toHost('clients');

				connection.on('clients', function(header, body) {
					clients.push.apply(clients, JSON.parse(body));

					var chatNode = document.createElement('div');
					chatNode.className = 'chat';
					document.body.appendChild(chatNode);
					
					var msgNode = document.createElement('div');
					msgNode.className = 'chat-msg';
					chatNode.appendChild(msgNode);
					
					var inputNode = document.createElement('form');
					inputNode.className = 'chat-input';
					inputNode.innerHTML = '<input type="text"/><button>Send</button>'
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
						msgNode.insertBefore(node, msgNode.firstChild);
					}
					
					connection.on('chatMsg', function(header, body) {
							var msg = JSON.parse(body);
							var sender = clients.filter(function(client)  { return client.clientID == msg.clientID })[0].name;
							addLine('['+sender+'] '+msg.body);
					});
				
					connection.hon('chatMsg', function(header, body, data, clientID) {
						if(body.length > 1)
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
						connection.toClient(clientID, 'chatLog', JSON.stringify(chatLog.slice(0, 100)));
					});
					
					connection.on('newClient', function(header, body) {
						var client = JSON.parse(body); 												
						addLine(client.name + ' joins chat');
					});
				
				});
			}, { single: true });
		});
	})();
});