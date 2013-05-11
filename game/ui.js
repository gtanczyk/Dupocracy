var ui = new (function() {
	
	// faction widget

	this.FactionWidget = function(factions) {
		var node = document.createElement('div');
		node.className = 'factionWidget';
		
		var factionNode = factions.reduce(function(r, faction) {
			var el = document.createElement('li');
			el.innerHTML = faction + '<span></span>';
			node.appendChild(el);
			r[faction] = el;
			return r;
		}, {});
		
		document.body.appendChild(node);
		
		this.markSlot = function(slot, name) {
			factionNode[slot].querySelector('span').innerHTML = name && (' ('+ name +')') || '';
		}
		
		this.clearSlot = function(slot, name) {
			this.markSlot(slot);
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
	promptDialogNode.className = 'promptDialog';
	var promptDialog = this.promptDialog = function(enabled) {
		mask(enabled);
		this.toggleNode(promptDialogNode, enabled);
	}.bind(this);
	
	// name dialog
	this.nameDialog = function(slots) {
		var result = new Deferred();
		
		this.promptDialog(true);
		
		if(slots.length > 0) {		
			promptDialogNode.innerHTML = '<center><label>Enter your name:</label>'+
	                '<input type="text" name="name" placeholder="Type your name here" />'+
	                '<button>Join</button>'+
	                '<select>'+slots.map(function(slot) {
	                	return '<option>'+slot+'</option>';
	                }).join('')+'</select>'
	                '<p class="error"> </p></center>';
	                                
	        promptDialogNode.querySelector('button').addEventListener('click', function() {
	        	var deferred = new Deferred();
	        	result.resolve(promptDialogNode.querySelector('input').value, slots[promptDialogNode.querySelector('select').selectedIndex], deferred);
	        	deferred.then(function(close, error) {
	        		if(close)
	        			promptDialog(false);
	        	})
	        }, false);        
    	} else
    		promptDialogNode.innerHTML = '<center>Game is full</center>';
        
        

		return result;
	}
	// context menus

	var currentMenu;

	this.contextMenu = function(x, y, options) {
		if(currentMenu)
			ui.remove(currentMenu)
	
		var result = new Deferred();
	
		var node = document.createElement('div');
		node.className = 'cmenu';
		options.some(function(option) {
			var el = document.createElement('button');
			el.innerHTML = option[1];
			node.appendChild(el);
			el.addEventListener('click', function() {
				result.resolve(option[0], option[1]);
				ui.remove(node);
				currentMenu = null;
			}, false);
		});
		
		node.style.left = x+'px';
		node.style.top = y+'px';
		document.body.appendChild(node);
		
		currentMenu = node;
		
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
		statusEl = document.createElement('div');
		statusEl.innerHTML = '<span>'+message+'</span>';
		statusEl.className = 'status';
		
		document.body.appendChild(statusEl);
	};
	
	this.hideStatus = function() {
		if(statusEl)
			statusEl = remove(statusEl)
	};
	
})();
