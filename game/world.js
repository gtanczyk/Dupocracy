var world = new (function() {
	var launchers = [];
	var interceptors = [];
	var radars = [];
	var missiles = [];

	var groups = [ launchers, interceptors, radars, missiles ];
	
	// store/restore
	
	this.store = function() {
		return groups; 
	}
	
	this.restore = function(state) {
		groups = state;
		launchers = groups[0];
		interceptors = groups[1];
		radars = groups[2];
		missiles = groups[3];
	}

	var lastUpdate = new Date().getTime();
	function update() {
		var dt = new Date().getTime() - lastUpdate;			
		lastUpdate += dt;
		
		missiles.some(function(missile) {
			missile.ft += dt / 1000;
			if(missile.ft < 1) {
				if(!missile.V)
					missile.V = VMath.normalize([ missile.opts.tx - missile.x, missile.opts.ty - missile.y ]);
				var V = missile.V;
				missile.x = missile.x + V[0]*dt; 
				missile.y = missile.y + V[1]*dt;
			}			
		});
	}

	view.onAnimate(update);
	
	// control
	
	this.add = function(type, x, y, opts) {
		(type == 'launcher' ? launchers : 
		 type == 'radar' ? radars :
		 type == 'missile' ? missiles :		 
			[]).push({ type: type, x: x, y: y, width: 16, height: 16, shape: (type == 'launcher' ? 'rect' : 'arc'), ft: 0, opts: opts });		
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