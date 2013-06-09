function AIRobot(faction, world, connection, prepare, warfare) {
	var myRadars = {};
	var myLaunchers = {};
	
	connection.on('newObject', function(header, body) {
		var object= JSON.parse(body);
		if(object.opts.faction == faction)
			({ 'radar': myRadars, 'launcher': myLaunchers }[object.type]||{})[object.id] = object;
	});

	prepare.then(function() {
		console.log('prepare', faction);
		var c = 0;
		var r = 10;
		world.population.some(function(city) {
			if(city.faction!=faction)
				return false;
				
			for(var building in { radar: true, launcher: true })
				for(var i = 0; i < 5; i++) {
					connection.toHost("makeObject", JSON.stringify({ type: building, 
						x: city.x + Math.cos(c * Math.PI / 4) * r, 
						y: city.y + Math.sin(c * Math.PI / 4) * r, 
						opts: { faction: faction, mode: i % 3 } }));
					c++;
					r += 5;
				}
				
			return true;
		});					
	});
		
	warfare.then(function() {
		Object.keys(myLaunchers).some(function(objectID) {
			if(myLaunchers[objectID].opts.mode==2)
				world.population.some(function(city, idx) {
					world.after(idx * 5000, function() { 
						connection.toHost("setTarget", JSON.stringify({ id: objectID, x: city.x, y: city.y, mode: 2 }));
					})
				});
		});
	});
	
}
