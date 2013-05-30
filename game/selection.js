var Selection;

DomReady.ready(function() {
	Selection = new (function() {
		var filter = this.filter = new Deferred();;
		var point = this.point = new Deferred();		
		
		var selection = [];
		
		this.clear = function() {
			selection = [];
		}
		
				
		view.on('contextmenu', function(event) {
			point.resolve(event.clientX, event.layerY, event.eX, event.eY, selection);
		});
		
		// unit selection
		
		var mouseMoved, mousePressed, pressX, pressY;
		
		filter.then(function(faction, check) {
		
			view.on('click', function(event) {
				if(!mouseMoved && !world.query(event.eX, event.eY, 8).some(function(object) {
					if(selection.indexOf(object)==-1 && object.opts.faction == faction)
						selection.push((object.selected = true) && object);
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
						if(selection.indexOf(object)==-1 && object.opts.faction == faction)
							selection.push((object.selected = true) && object);				
						return true;
					}))					
						selection = selection.filter(function(object) {
							object.selected = false;
						});							
				} else
					view.pointer(world.query(event.eX, event.eY, 8).length > 0);
					
			});
		
		});
	})();
});