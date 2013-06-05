(function() {
  var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                              window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
  window.requestAnimationFrame = requestAnimationFrame;
})();

var view = new (function() {
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
		
		this.fillArc = function(x, y, radius, color, angle, scaleX, scaleY) {
			ctx.save();
			ctx.fillStyle = color;
			ctx.translate(x, y);
			ctx.rotate(angle);
			if(scaleX && scaleY)
			ctx.scale(scaleX, scaleY);
			ctx.beginPath();
			ctx.arc(0, 0, radius, 0, Math.PI * 2, true); 
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		}
		
		this.fillTriangle = function(x, y, radius, color) {
			ctx.save();
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.moveTo(x-radius,y+radius);
			ctx.lineTo(x+radius,y+radius);
			ctx.lineTo(x,y-radius);
			ctx.fill();
			ctx.restore();
		}
		
		var launchImage = new Image();
		launchImage.src = 'assets/launch.png';
		
		this.drawLaunch = function(x, y, radius, t) {
			ctx.save();
			ctx.globalAlpha = t < 1 ? Math.sqrt(t) : Math.sqrt((7 - t)/2);
			ctx.translate(x-launchImage.width/2, y-launchImage.height/2);
			ctx.rotate(0);
			ctx.drawImage(launchImage, 0, 0, launchImage.width, launchImage.height, 0, 0, launchImage.width, launchImage.height);
			
			ctx.globalAlpha = 1;
			ctx.restore();
		}
		
		this.drawMissile = function(curve, t, tail, radius, color, scaleX, scaleY) {
			var point = de.casteljau(curve, 1-t);	
			var sx = curve[0], sy = curve[1];
			curve = de.divideBezierCurve(curve, 1-t)[0];	        
	        
	        ctx.save();
	        ctx.lineWidth = 4;
	        ctx.globalAlpha = 1;
	        ctx.strokeStyle = 'red';
	        var i = tail.length;
	        while(i --> 0) {
    	        ctx.beginPath();
	        	ctx.lineTo(tail[i][0], tail[i][1]);	       
	        	if(i > 0)
	        	    ctx.lineTo(tail[i-1][0], tail[i-1][1]);	       	        	
	        	ctx.globalAlpha = 1 - (i / tail.length);
	        	ctx.stroke();
	        }
            ctx.lineTo(point[0], point[1]);
	        ctx.stroke();	        
	        ctx.restore();
	        
	        var angle = Math.atan2(point[1] - curve[2][1], point[0] - curve[2][0]);
	        
			view.fillArc(point[0], point[1], radius, color, angle, scaleX, scaleY); 
			
			return point;
		}
		
		this.drawInterceptor = function(sx, sy, x, y, tx, ty, radius, color, angle, scaleX, scaleY) {
			this.drawMissile(x, y, radius, color, angle, scaleX, scaleY);
		}
		
		var radgrad;
	    
	    this.drawExplosion = function(x, y, t) {
	    	if(t >= 3)
	    		return;
	    	
	    	ctx.save();
	    	ctx.translate(x, y);
	    	ctx.scale(Math.sqrt(t), Math.sqrt(t));
	    	ctx.globalAlpha = t < 1 ? Math.sqrt(t) : Math.sqrt((3 - t)/2);
	    	ctx.fillStyle = radgrad;
	    	ctx.beginPath();
	    	ctx.arc(0, 0, 25, 0, Math.PI * 2, true);
	    	ctx.closePath();
	    	ctx.fill();
	    	ctx.globalAlpha = 1;
			ctx.restore();
	    }
		
		this.drawShape = function(points, scale) {
			scale = scale || 1;
			ctx.strokeStyle = 'red';
			ctx.beginPath();
			ctx.moveTo(points[0][0]*scale, points[0][1]*scale);
			points.some(function(point) {
				ctx.lineTo(point[0]*scale, point[1]*scale);
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
		
		// asset loading
		// start doing stuff when background is loaded
		SourceReady.ready(function(){
			terrain.dimensions.then(function(width, height) {
				canvasContainer.style.width = (canvasFoW.width = canvas.width = canvasTerrain.width = viewWidth = width)+'px';
				canvasContainer.style.height= (canvasFoW.height = canvas.height = canvasTerrain.height = viewHeight = height)+'px';
				
				canvasContainer.appendChild(canvasTerrain);
				canvasContainer.appendChild(canvas);
				canvasContainer.appendChild(canvasFoW);
				
				ctxTerrain = canvasTerrain.getContext('2d');
				ctx = canvas.getContext('2d');
				ctxFoW = canvasFoW.getContext('2d');
				
				radgrad = ctx.createRadialGradient(0,0,15,0,0,25);
			    radgrad.addColorStop(0, 'rgba(255,255,255,1)');
			    radgrad.addColorStop(1, 'rgba(255,255,255,0)');
				
				terrain.render(0, 0, viewWidth, viewHeight);
				
				requestAnimationFrame(animationFrame);
				
				ready.resolve(true);
			});
		});
})();