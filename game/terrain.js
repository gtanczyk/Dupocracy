var terrain = new (function() {
	var shapes = [];
	
	var background = new Image();
	background.src = 'assets/world.png';

	this.render = function() {
		view.drawImage(background);
		shapes.some(function(shape) {
			view.drawShape(shape);
		});
	}
})();