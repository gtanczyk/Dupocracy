(function() {
  var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                              window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
  window.requestAnimationFrame = requestAnimationFrame;
})();

var view;

DomReady.ready(function() {
	view = new (function() {
		var viewWidth, viewHeight;
		
		var canvasContainer = document.createElement('div');
		canvasContainer.className = 'canvas-container';
		document.body.appendChild(canvasContainer);
		
		var canvas = document.createElement('canvas');	
		var canvasFoW = document.createElement('canvas');
		canvasFoW.className = 'fog-of-war';
		var canvasTerrain = document.createElement('canvas');
		canvasTerrain.className = 'terrain';
	
		// events
	
		this.on = function(event, handler) {
			return canvas.addEventListener(event, function(event) {
				event.eX = event.layerX, event.eY = event.layerY;					
				handler(event);
			}, false);					
		};
		
		this.on('contextmenu', function(event) {
			event.preventDefault();
		});					
		
		var ready = this.ready = new Deferred();
		
		// pointer control
	
		this.pointer = function(enabled) {
			canvas.style.cursor = enabled ? 'pointer' : null;
		}	
		
		// asset loading
		// start doing stuff when background is loaded
		terrain.dimensions.then(function(width, height) {
			canvasContainer.style.width = (canvasFoW.width = canvas.width = canvasTerrain.width = viewWidth = width)+'px';
			canvasContainer.style.height= (canvasFoW.height = canvas.height = canvasTerrain.height = viewHeight = height)+'px';
			
			canvasContainer.appendChild(canvasTerrain);
			canvasContainer.appendChild(canvas);
			canvasContainer.appendChild(canvasFoW);
			
			ctxTerrain = canvasTerrain.getContext('2d');
			ctx = canvas.getContext('2d');
			ctxFoW = canvasFoW.getContext('2d');
			
			terrain.render(0, 0, viewWidth, viewHeight);
			
			requestAnimationFrame(animationFrame);
			
			ready.resolve(true);
		});
				
		
		// canvas util
	
		var clear = this.clear = function() {
//			ctx.fillStyle = 'black';
			ctx.clearRect(0, 0, viewWidth, viewHeight);
			
			ctxFoW.fillStyle = 'black';
			ctxFoW.fillRect(0, 0, viewWidth, viewHeight);
		}
		
		this.fillRect = function(x, y, width, height, color, angle) {
			ctx.fillStyle = color;
			if(angle) {
				ctx.save()
				ctx.translate(x, y);
				ctx.rotate(angle);
				ctx.fillRect(0, 0, width, height);			
				ctx.restore();
			} else
				ctx.fillRect(x, y, width, height);			
		}
		
		this.fillArc = function(x, y, radius, color) {
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(x, y, radius, 0, Math.PI*2, true); 
			ctx.closePath();
			ctx.fill();
		}	
		
		this.drawShape = function(points) {
			ctx.strokeStyle = 'red';
			ctx.beginPath();
			ctx.moveTo(points[0][0], points[0][1]);
			points.some(function(point) {
				ctx.lineTo(point[0], point[1]);
			});		
			ctx.stroke();
		}	
		
		this.drawImage = function(image) {
			var targetHeight = viewWidth * (image.height / image.width);
			ctxTerrain.drawImage(image, 0, 0, image.width, image.height, 0, (viewHeight - targetHeight) / 2, viewWidth, targetHeight);
		}	
		
		this.lightUp = function(x, y, radius) {
			var oldGCO = ctxFoW.globalCompositeOperation;
			ctxFoW.globalCompositeOperation = 'destination-out';
			ctxFoW.beginPath();
			ctxFoW.arc(x, y, radius, 0, Math.PI*2, true); 
			ctxFoW.closePath();
			ctxFoW.fill();			
			ctxFoW.globalCompositeOperation = oldGCO;
		}
		
		// animation
		
		var onAnimateFns = [];
		this.onAnimate = function(fn) {
			onAnimateFns.push(fn);
		}
		
		function animationFrame() {
			onAnimateFns.some(function(fn) {
				fn();
			});
			
			clear();
						
			world.render(0, 0, viewWidth, viewHeight);
	
			requestAnimationFrame(animationFrame);
		}
		
	})();
});