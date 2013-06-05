var UI = new (function() {	
		// faction widget
	
		this.FactionWidget = function(factions) {
			var joinSlot = this.joinSlot = new Deferred();	
		
			var node = document.createElement('div');
			node.className = 'factionWidget dialog';
			node.style.display = 'none';
			
			var factionNode;
			
			this.show = function() {
				node.style.display = 'block';
				joinSlot = this.joinSlot = new Deferred();
			}
			
			this.hide = function() {
				node.style.display = 'none';
			}			
			
			this.reset = function() {
				joinSlot = this.joinSlot = new Deferred();
			
				node.innerHTML = '<h3>Select continent</h3>';
				factionNode = factions.reduce(function(r, faction) {
					var el = document.createElement('li');
					el.innerHTML = escapeHTML(faction) + '<span><button>Join</button></span>';
					
					el.querySelector('button').addEventListener('click', function() {
						joinSlot.resolve(faction);
					});
					
					node.appendChild(el);				
					r[faction] = el;
					return r;
				}.bind(this), {});
			};			
			
			document.body.appendChild(node);
			
			var markSlot = this.markSlot = function(slot, name) {
				name = escapeHTML(name);
				factionNode[slot].querySelector('span').innerHTML = name && (' '+ name +'') || '<button>Join</button>';
				if(!name)
					factionNode[slot].querySelector('button').addEventListener('click', function() {
						joinSlot.resolve(slot);
					});
			}
			
			var clearSlot = this.clearSlot = function(slot, name) {
				markSlot(slot);
			}					
			
			this.clearAll = function(slot) {
				factions.some(function(slot) {
					if(factionNode[slot].querySelector('button'))
						clearSlot(slot);
				});
			}			
			
			// ready dialog
	
			this.ready = function() {
				var result = new Deferred();
				
				var readyNode = document.createElement('center');
				readyNode.className = 'ready';
				readyNode.innerHTML = '<button>Ready</button>';				
				readyNode.querySelector('button').addEventListener('click', function() {
					result.resolve();
					node.removeChild(readyNode);
				});
				
				node.appendChild(readyNode);
				
				return result;
			}
		};				
		
		// mask
		var maskNode = document.createElement('div');
		maskNode.className = 'mask';
		var mask = this.mask = function(enabled) {
			this.toggleNode(maskNode, enabled);
		}.bind(this);
		
		// prompt dialog
		
		var promptDialogNode = document.createElement('div');
		promptDialogNode.className = 'promptDialog dialog';
		var promptDialog = this.promptDialog = function(enabled) {
			mask(enabled);
			this.toggleNode(promptDialogNode, enabled);
		}.bind(this);
		
		// name dialog
		this.nameDialog = function() {
			var result = new Deferred();
			
			this.promptDialog(true);

			promptDialogNode.innerHTML = '<h3>Enter your name</h3><center>'+
	                '<input type="text" name="name" placeholder="Type your name here" />'+
	                '<button>Join</button>'+
	                '<p class="error"> </p></center>';
	                                
	        promptDialogNode.querySelector('button').addEventListener('click', function() {
	        	var name = promptDialogNode.querySelector('input').value;
	        	if(!name || name.length == 0)
	        		return;
	        		
	        	var deferred = new Deferred();
	        	result.resolve(name, deferred);
	        	deferred.then(function(close, error) {
	        		if(close)
	        			promptDialog(false);
	        	})
	        }, false);        	    	        
	
			return result;
		}		
		
		// room lobby dialog
		this.roomLobby = function(rooms) {
			var result = {};
			
			var createRoom, joinRoom;
			
			result.createRoom = function(fn) {
				createRoom = fn;
				return result;
			};
			
			result.joinRoom = function(fn) {
				joinRoom = fn;
				return result;
			};
			
			var removeRoom = {};			
			result.removeRoom = function(name) {
				if(removeRoom[name]) {
					removeRoom[name].resolve();
					delete removeRoom[name];
				}
			};			
			
			var addRoom = result.addRoom = function(room) {
				var node = document.createElement('div');
				node.className = 'room-lobby';
				node.innerHTML = '<label>'+escapeHTML(room.name) + ' <i>#players: ' + Object.keys(room.pingMap).length + '</i>' + '</label>' + '<button>Join</button>';
				node.querySelector('button').addEventListener('click', function() { joinRoom(room); });
				promptDialogNode.insertBefore(node, promptDialogNode.firstChild);
				
				(removeRoom[room.name] = new Deferred()).once(function() {
					promptDialogNode.removeChild(node);
				});
			}
			
			this.promptDialog(true);
			promptDialogNode.innerHTML = '<h3>Select room</h3>';
			
			rooms.forEach(addRoom);
			
			var newRoom = document.createElement('form');
			newRoom.className = 'room-lobby new-room';
			newRoom.innerHTML = '<input type="text" placeholder="Create new room"/><button>Create</button>';
			promptDialogNode.appendChild(newRoom);
			
			newRoom.addEventListener('submit', function(event) {
				event.preventDefault();
				createRoom(this.querySelector('input').value);
			});
	
			return result;
		}			
	
		// context menus
	
		var currentMenu;
	
		this.contextMenu = function(x, y, options) {
			if(currentMenu)
				UI.remove(currentMenu)
		
			var result = new Deferred();
		
			var node = document.createElement('div');
			node.className = 'cmenu';
			options.some(function(option) {
				var el = document.createElement('button');
				el.innerHTML = escapeHTML(option[1]);
				node.appendChild(el);
				el.addEventListener('click', function() {
					result.resolve(option[0], option[1]);
					UI.remove(node);
					currentMenu = null;
				}, false);
			});
			
			node.style.left = x+'px';
			node.style.top = y+'px';
			document.body.appendChild(node);
			
			currentMenu = node;
			
			view.on('click', function() {
				UI.remove(node);
				currentMenu = null;
			});
			
			return result;
		}
		
		// dom utils
	
		var remove = this.remove = function(node) {
			if(node.parentNode)
				node.parentNode.removeChild(node);
		}
		
		this.toggleNode = function(node, enabled) {
			if(enabled && !node.parentNode)
				document.body.appendChild(node);
			else if(!enabled && node.parentNode)
				remove(node);
		}
		
		// status
	
		var statusEl;
		this.showStatus = function(message) {
			this.hideStatus();
			
			statusEl = document.createElement('div');
			statusEl.innerHTML = '<span>'+escapeHTML(message)+'</span>';
			statusEl.className = 'status';
			
			document.body.appendChild(statusEl);
		};
		
		this.hideStatus = function() {
			if(statusEl)
				statusEl = remove(statusEl)
		};
		
		// world time
	
		var wtEl = document.createElement('div');
		wtEl.className = 'worldtime';
		this.toggleNode(wtEl, true);
		this.updateWorldTime = function(t) {
			if(!(t>0))
				return this.toggleNode(wtEl, false);
			else
				this.toggleNode(wtEl, true);
				
			t = (t/1000) << 0;
			wtEl.innerHTML = ((t/60) << 0) + ":" + (((t%60) < 10 ? '0' : '')+(t%60));
		}
		
		// string utils
	
		function escapeHTML(str) {
			if(str)
				return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') ;
		}
		
		
})();
