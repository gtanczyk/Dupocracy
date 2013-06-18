function AIRobot(faction, world, connection, prepare, warfare, end) {
	var myRadars = {};
	var myLaunchers = {};
	
	var listeners = [];

	listeners.push(connection.on('newObject', function(header, body) {
		var object= JSON.parse(body);
		if(object.opts.faction == faction)
			({ 'radar': myRadars, 'launcher': myLaunchers }[object.type]||{})[object.id] = object;
	}));

	prepare.once(function() {
		console.log('prepare', faction);
		var c = 0;
		var r = 10;
		world.population.some(function(city) {
			if(city.faction!=faction)
				return false;
				
			for(var building in { radar: true, launcher: true })
				for(var i = 0; i < 5; i++) {
					connection.toHost("makeObject", JSON.stringify({ 
						type: building, 
						x: city.x + Math.cos(c * Math.PI / 4) * r, 
						y: city.y + Math.sin(c * Math.PI / 4) * r, 
						opts: { faction: faction, mode: i % 3 } }));
					c++;
					r += 5;
				}
				
			return true;
		});					
	});
		
	warfare.once(function() {
		Object.keys(myLaunchers).some(function(objectID) {
			if(myLaunchers[objectID].opts.mode==2) {
				world.population.some(function(city, idx) {
					world.after(idx * 5000, function() { 
						connection.toHost("setTarget", JSON.stringify({ id: objectID, x: city.x, y: city.y, mode: 2 }));
					});
				});
				world.after(world.population.length * 5000 + 5000, function() {
					connection.toHost("switchMode", JSON.stringify({ objectID: objectID, mode: 1}));
					if(myLaunchers[objectID])
						myLaunchers[objectID].opts.mode = 1;
				});
			}
		});
		
		var queue = [];
		var objects = {};
		
		world.onSight(faction, function(object) {			
			queue.push(object.id);
			objects[object.id]= { x: object.x, y: object.y, launchCount: 0 };
		}, { radar: true, launcher: true });
		
		listeners.push(connection.on('removeObject', function(header, objectID) {
			delete objects[objectID];
		}));
		
		world.onRemove(function(objectID) {
			delete objects[objectID];
			delete myLaunchers[objectID];
		});
		
		var updateTarget = function() {
			if(queue.length == 0)
				return world.after(1000, updateTarget);
				
			if(!objects[queue[0]]) {
				queue.splice(0, 1);
				return world.after(10, updateTarget)
			}
			
			var object = objects[queue[0]];
			Object.keys(myLaunchers).some(function(objectID) {
				object.launchCount++;
				if(myLaunchers[objectID].opts.mode==1)
					connection.toHost("setTarget", JSON.stringify({ id: objectID, x: object.x, y: object.y, mode: 1 }));
			});
			
			if(object.launchCount > 3) {
				object.launchCount = 0;
				queue.push(queue.splice(0, 1)[0]);			
			}
				
			
			world.after(5000, updateTarget);
		}
		
		world.after(5000, updateTarget)		
	});
	
	end.once(function() {
		listeners.some(function(listener) {
			listener.remove();
		});
	});
	
}
