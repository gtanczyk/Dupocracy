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

	// rendering

	this.render = function() {
		groups.some(function(group) {
			group.some(function(object) {
				view.fillRect(object.x, object.y, object.width, object.height, 'red');
			});
		});
	}
})();