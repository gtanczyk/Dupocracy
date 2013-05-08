var ui = new (function() {

	// context menus

	var currentMenu;

	this.contextMenu = function(x, y, options) {
		if(currentMenu)
			currentMenu.remove()
	
		var result = new Deferred();
	
		var node = document.createElement('div');
		node.className = 'cmenu';
		options.some(function(option) {
			var el = document.createElement('button');
			el.innerHTML = option[1];
			node.appendChild(el);
			el.addEventListener('click', function() {
				result.resolve(option[0], option[1]);
				node.remove();
			}, false);
		});
		node.style.left = x+'px';
		node.style.top = y+'px';
		document.body.appendChild(node);
		
		currentMenu = node;
		
		return result;
	}	
})();
