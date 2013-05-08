var world = new (function() {
	var launchers = [];
	var interceptors = [];
	var radars = [];
	var missiles = [];

	var groups = [ launchers, interceptors, radars, missiles ];

	var lastUpdate = new Date().getTime();
	function update() {
		var dt = new Date().getTime() - lastUpdate;			
		lastUpdate += dt;
		
		missiles.some(function() {
			missiles.ft += dt; 
		});
	}

	view.onAnimate(update);
	
	// control
	
	this.add = function(type, x, y) {
		(type == 'launcher' ? launchers : radars).push({ type: type, x: x, y: y, width: 16, height: 16, shape: (type == 'launcher' ? 'rect' : 'arc') });		
	};
	
	// query
	
	this.query = function(x, y, r, rect) {
		var result = [];
		
		groups.some(function(group) {
			return group.some(function(object) {
				if(rect && VMath.insideRect([object.x, object.y], rect) || 
					VMath.distance([x, y], [object.x, object.y]) < r) {
					result.push(object);
					return !!!rect;
				}
			});
		});
		
		return result;
	}

	// rendering

	this.render = function() {
		groups.some(function(group) {
			group.some(function(object) {
				var color = object.selected ? 'yellow' : 'red';
				if(object.shape == 'rect')
					view.fillRect(object.x - object.width/2, object.y - object.height/2, object.width, object.height, color);
				else if(object.shape == 'arc')
					view.fillArc(object.x, object.y, object.width / 2, color);
			});
		});
	}
})();