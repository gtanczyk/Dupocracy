var terrain = new (function() {
	var shapes = [ [ [ 0, 0 ], [ 100, 0 ], [ 100, 100 ], [ 0, 100 ] ] ];

	this.render = function() {
		shapes.some(function(shape) {
			view.drawShape(shape);
		});
	}
})();