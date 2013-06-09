var world = new (function() {
	var IDserial = 0;	
	var IDmap = {};
	
	this.nextID = function() {
		return IDserial++;
	};
	
	var launchers = [];
	var launcherTargets = {};
	var interceptors = [];
	var radars = [];
	var missiles = [];
	var scouts = [];
	var explosions = [];
	
	var worldTime = 0;
	var groups = [ launchers, missiles, interceptors, radars, scouts, explosions ];
	
	// population hotspots aka cities, players should attack/protect them in order to win 
	var population = [	{ name: 'Moscow', x: 780, y: 130, r: 20, faction: 'Russia' },
						{ name: 'Berlin', x: 680, y: 170, r: 20, faction: 'Europe' },
						{ name: 'Chicago', x: 260, y: 170, r: 20, faction: 'North America' },
						{ name: 'Cape Town', x: 710, y: 470, r: 20, faction: 'Africa' },
						{ name: 'Bejing', x: 1040, y: 250, r: 20, faction: 'Asia' },
						{ name: 'Tokyo', x: 1140, y: 220, r: 20, faction: 'Asia' },
						{ name: 'Rio de janeiro', x: 490, y: 400, r: 20, faction: 'Latin America' }].filter(function(city) {
							city.visibilityRadius = 20;
							city.opts = { faction: city.faction };
							return true;
						});		

	var visibility = population.reduce(function(r, city) {
		if(!r[city.faction])
			r[city.faction] = { V: {}, H: {} }; 
		return r; 
	}, {});

	
	// store/restore
	
	this.store = function() {
		return { IDserial: IDserial, groups: groups, population: population, worldTime: worldTime }; 
	}
	
	this.restore = function(state) {
		IDserial = state.IDserial;
		worldTime = state.worldTime;
		UI.updateWorldTime(state.worldTime);

		groups = state.groups;
		launchers = groups[0];
		interceptors = groups[1];
		radars = groups[2];
		missiles = groups[3];
		scouts = groups[4];
		explosions = groups[5];
		
		IDmap = {};
		
		groups.some(function(group) {
			group.some(function(object) {
				IDmap[object.id] = object;
			});
		});
		
		population = state.population;
		
		afterListeners = [];
		onAddListeners = [];
		onRemoveListeners = [];
		
		visibilityMap = {};
	}
	
	// update

	var lastUpdate;
	var lag = 0;
	function update() {
		var tdt = new Date().getTime() - lastUpdate + lag;
		lag = 0;
		lastUpdate = new Date().getTime();
		
		while (afterListeners[0] && afterListeners[0].t <= worldTime)
			afterListeners.splice(0, 1)[0].fn(worldTime);
		
		var dt = Math.min(tdt, 0.1);
		
		var updateStart = performance.now();		
		
		do {
			
			updateLaunchers(dt);
			
			updateMissiles(dt);
			
			triggerInterceptors(worldTime, dt);
			
			updateInterceptors(dt);		
			
			updateScouts(dt);
			
			updateExplosions(dt);
			
			tdt -= dt;
			dt = Math.min(tdt, 0.1);
			
			worldTime += dt;
		} while(dt > 0 && (performance.now() - updateStart < 10));
		
		lag += tdt;
		UI.updateWorldTime(worldTime);
	}
	
	function updateExplosions(dt) {
		var i = explosions.length;
		while (i --> 0) {
			var explosion = explosions[i];
			
			if(worldTime - explosion.opts.explosionTS > 3000)
				remove(explosion.id);
		}
	}
	
	function updateLaunchers(dt) {
		var i = launchers.length;
		while (i --> 0) {
			var launcher = launchers[i];
			
			if(launcher.opts.switchModeTS && (worldTime - launcher.opts.switchModeTS) > 10000) {
				launcher.opts.mode = launcher.opts.switchMode;
				delete launcher.opts.switchModeTS;
				delete launcher.opts.switchMode;
			}
			
			if(launcher.opts.target) {
				if(launcher.opts.launchTS && (worldTime - launcher.opts.launchTS) < 5000 || launcher.opts.mode == 0)
					continue;
				
				launcher.opts.launchTS = worldTime;
				if(launcher.opts.mode == 1 &&  launcher.opts.targetMode == 1)
					add('missile', launcher.x, launcher.y, { sx: launcher.x, sy: launcher.y, tx: launcher.opts.target[0], ty: launcher.opts.target[1], faction: launcher.opts.faction });				
				else if(launcher.opts.mode == 2 &&  launcher.opts.targetMode == 2)
					add('scout', launcher.x, launcher.y, { tx: launcher.opts.target[0], ty: launcher.opts.target[1], faction: launcher.opts.faction });	
				
				delete launcher.opts.target;
			}
		};
	}
	
	function updateMissiles(dt) {
		var j = missiles.length;
		while (j --> 0) {
			var missile = missiles[j];
			missile.ft += dt / 1000;
			if(missile.ft < 100 && !missile.dead) {
				if(!missile.V)
					missile.V = VMath.normalize([ missile.opts.tx - missile.x, missile.opts.ty - missile.y ]);
				var V = missile.V;
				missile.opts.t = VMath.distance([missile.x, missile.y], [missile.opts.tx, missile.opts.ty])/ missile.opts.dist;
				var f = Math.min(Math.sqrt(worldTime - missile.opts.st)/100, 3) + Math.sqrt(1.01 - missile.opts.t);
				missile.x = missile.x + V[0]*dt/30 * f; 
				missile.y = missile.y + V[1]*dt/30 * f;
				missile.opts.proj = de.casteljau(missile.opts.curve, 1-missile.opts.t);
				
				if(Math.abs(worldTime - missile.opts.lt) > 300) {
					missile.opts.lt = worldTime;
					missile.opts.tail.splice(0, 0, missile.opts.proj);
					missile.opts.tail.length = Math.min(50, missile.opts.tail.length);
				}
				
				if(VMath.length([ missile.opts.tx - missile.x, missile.opts.ty - missile.y ]) < 8 && !missile.dead) {
					missile.V = [0, 0]
					missile.dead = true;
					population.some(function(hotspot) {
						if(VMath.distance([missile.x, missile.y], [hotspot.x, hotspot.y]) < hotspot.r + 8)
							hotspot.r *= 0.8;
					});
					launchers.some(function(launcher) {
						if(VMath.distance([missile.x, missile.y], [launcher.x, launcher.y]) < 16)
							remove(launcher.id);
					});
					radars.some(function(radar) {
						if(VMath.distance([missile.x, missile.y], [radar.x, radar.y]) < 16)
							remove(radar.id);
					});
					add('explosion', missile.x, missile.y, { explosionTS: worldTime, faction: missile.opts.faction });
					remove(missile.id);
				}					
									
			} else {
				missile.dead = true;
				remove(missile.id);
			}

		};
	};
	
	var sight;
	
	function fillSight(object) {
		if(!object.dead && object.visibilityRadius > 0) {
			if(!sight[object.opts.faction])
				sight[object.opts.faction] = { V: {}, H: {} };
			
			var left = Math.floor((object.x-object.visibilityRadius) / 16);
			var top = Math.floor((object.y-object.visibilityRadius) / 16);
			var right = Math.floor((object.x+object.visibilityRadius) / 16);
			var bottom = Math.floor((object.y+object.visibilityRadius) / 16);
			for(var i = left; i <= right; i++)
				sight[object.opts.faction].H[i] = true;
			for(var i = top ; i <= bottom; i++)
				sight[object.opts.faction].V[i] = true;
		}
	}
	
	function triggerInterceptors(worldTime, dt) {
		if(!sight || worldTime - sight.ts > 1000) {
			sight = { ts: worldTime };
			groups.some(function(group) {
				group.some(fillSight);
			});
			
			population.some(fillSight);
		}
		
		var i = launchers.length;
		while (i --> 0) {
			var launcher = launchers[i];
			if(launcher.opts.nextTickTS  > worldTime || launcher.opts.mode!=0 || 
				launcher.opts.nextLaunchTS > worldTime)
				continue;
			
			launcher.opts.nextTickTS = worldTime + 2000;
			
			var j = missiles.length;
			while (j --> 0) {
				var missile = missiles[j];	
				if(launcher.opts.faction != missile.opts.faction && visibilityCheck(missile, sight[launcher.opts.faction], launcher.opts.faction))
					updateLauncher(launcher, worldTime, dt, missile);
			}
		};
	}
	
	function updateLauncher(launcher, worldTime, dt, missile) {
		var target = IDmap[launcherTargets[launcher.id]];
		if(!target && VMath.distance([launcher.x, launcher.y], missile.opts.proj) < 500 || target && launcher.opts.nextLaunchTS < worldTime) {
			launcher.opts.nextLaunchTS = worldTime + 2000;
			launcherTargets[launcher.id] = missile.id;
			add('interceptor', launcher.x, launcher.y, { sx: launcher.x, sy: launcher.y, tx: missile.x, ty: missile.y, targetID: missile.id, faction: launcher.opts.faction });					
		}
	}
	
	function updateInterceptors(dt) {
		var j = interceptors.length;
		while (j --> 0) {
			var interceptor = interceptors[j];
			interceptor.ft += dt / 1000;
			var target = IDmap[interceptor.opts.targetID];
			var dP = target && target.opts.proj ? [ target.opts.proj[0] - interceptor.x, target.opts.proj[1] - interceptor.y ] :
							  interceptor.V;			
			if((target && interceptor.ft < 20 || !target && interceptor.ft < 10) && !interceptor.dead && dP) {
				var distance = VMath.length(dP);
				var V = interceptor.V = VMath.scale(dP, 1 / distance);
				interceptor.x = interceptor.x + V[0]*dt/35; 
				interceptor.y = interceptor.y + V[1]*dt/35;
				if(target && distance < 5) {
					target.dead = true;
					interceptor.dead = true;
					remove(interceptor.id);
					remove(target.id);
				}
			} else {
				interceptor.dead = true;
				remove(interceptor.id);
			}
		};
	}
	
	function updateScouts(dt) {
		var j = scouts.length;
		while(j --> 0)  {
			var scout = scouts[j];
			scout.ft += dt / 1000;
			if(scout.ft < 100 && !scout.dead) {				
				if(!scout.V)
					scout.V = VMath.normalize([ scout.opts.tx - scout.x, scout.opts.ty - scout.y ]);
				else {
					var V = VMath.normalize([ scout.opts.tx - scout.x + Math.cos(scout.ft) * 20, 
											  scout.opts.ty - scout.y + Math.sin(scout.ft) * 20]);
					scout.V = VMath.add(scout.V, VMath.scale(VMath.sub(V, scout.V), dt / 100));
				}
				var V = scout.V;
				scout.x = scout.x + V[0]*dt/40; 
				scout.y = scout.y + V[1]*dt/40;
			} else {
				scout.dead = true;
				remove(scout.id);
			}
		}
	}

	var updateInterval;
	this.run = function() {
		if(updateInterval)
			return;
		
		lastUpdate = new Date().getTime();
		updateInterval = setInterval(update, 1);
	};
	
	this.stop = function() {
		if(!updateInterval)
			return;
		
		clearInterval(updateInterval);
		updateInterval = null;
		lastUpdate = null;
		
		UI.updateWorldTime(worldTime);
	}
	
	var afterListeners = [];
	
	this.after = function(t, fn) {		
		if(!lastUpdate)
			this.run();
		
		afterListeners.push({ t: worldTime+t, fn: fn });
	}
	
	// constraint check
	
	this.countGroup = function(type, faction) {
		var group = type=='launcher' && launchers || type=='radar' && radars;
		if(group)
			return group.reduce(function(count, object) { 
				if(object.opts.faction == faction)
					return count + 1; 
				else 
					return count;  }, 0);
		else 
			return 0;
	};
	
	this.canAdd = function(type, x, y, opts) {
		// can add new military building whenever it is not more far away than 100 from my faction hotspots and no closer than 100 to enemy hotspots
		if(type=='launcher' || type=='radar') {
			return (this.countGroup(type, opts.faction) < 5) &&			
			population.some(function(hotspot) {
				return hotspot.faction == opts.faction && 
						VMath.distance([x, y], [hotspot.x, hotspot.y]) < 100;
			}) && population.every(function(hotspot) {
				return hotspot.faction == opts.faction || 
				VMath.distance([x, y], [hotspot.x, hotspot.y]) > 100;
				})		
		} else
			return true;
	}
	
	// control
	
	this.setTarget = function(id, x, y, mode) {
		IDmap[id].opts.target = [x, y];
		IDmap[id].opts.targetMode = mode; 
	}
	
	this.switchMode = function(id, mode) {
		IDmap[id].opts.switchModeTS = worldTime;
		IDmap[id].opts.switchMode = mode;
	}
	
	// new object
	
	var onAddListeners = [];
	
	this.onAdd = function(fn) {
		onAddListeners.push(fn);
	}
	
	var add = this.add = function(type, x, y, opts, id) {
		if(!id)
			onAddListeners.some(function(fn) { 
				fn(type, x, y, opts);
			})
		else {
			var object = { 
				id: id, type: type, 
				x: x, y: y, 
				width: 16, height: 16, 
				visibilityRadius: {
					interceptor: 0, launcher: 30, 
					scout : 50, radar: 150, missile: 0
				}[type],
				ft: 0, opts: opts 
			};
			
			if(object.type=='missile') {
				var sx = object.opts.sx, sy = object.opts.sy, tx = object.opts.tx, ty = object.opts.ty;
				object.opts.dist = VMath.distance([sx, sy], [tx, ty]);
				var N = VMath.normal([sx, sy], [tx, ty]); 
				N = N[0][1] > N[1][1] ? N[0] : N[1];
				N = VMath.scale(N, Math.pow(object.opts.dist, 0.8));
				var S = [sx, sy], E = [tx, ty];
				object.opts.curve = [
		            S,
		            VMath.add(S, VMath.sub(VMath.scale(VMath.sub(E, S), 0.5), N)),
		            E
		        ];
				object.opts.t = 0;
				object.opts.tail = [[sx, sy]]
				object.opts.lt = worldTime;
				object.opts.st = worldTime;
			}
			
			IDmap[object.id] = object;
			(type == 'launcher' ? launchers : 
			 type == 'radar' ? radars :
			 type == 'missile' ? missiles :		 
			 type == 'interceptor' ? interceptors :
			 type == 'scout' ? scouts :
			 type == 'explosion' ? explosions :
				[]).push(object);
		}
	};

	// removal
	
	var onRemoveListeners = [];
	
	this.onRemove = function(fn) {
		onRemoveListeners.push(fn)
	}
	
	var remove = this.remove = function(objectID) {
		if(IDmap[objectID])
			delete IDmap[objectID];
		groups.some(function(group) {
			if(group.some(function(object, idx) { 
				if(object.id == objectID) {
					group.splice(idx, 1);
					return true;					
				}
			}))				
				onRemoveListeners.some(function(listener) {
					listener(objectID);
				});
		});
	}
	
	// query
	
	this.query = function(x, y, r, rect) {
		var result = [];
		
		groups.some(function(group) {
			return group.some(function(object) {
				if(!object.dead && rect && VMath.insideRect([object.x, object.y], rect) || 
					VMath.distance([x, y], [object.x, object.y]) < r) {
					result.push(object);
					return !!!rect;
				}
			});
		});
		
		return result;
	}

	// rendering
	
	var visibleFaction;
	this.setVisibleFaction = function(faction) {
		visibleFaction = faction;
	}
	
	var visibilityMap = {};
	
	var visibilityCheck = this.visibilityCheck = function(object, sight, faction) {
		var ox = Math.floor((object.opts.proj && object.opts.proj[0] || object.x) / 16);
		var oy = Math.floor((object.opts.proj && object.opts.proj[1] || object.y) / 16);
		return !faction || (object.opts.faction == faction) || sight.V[oy] && sight.H[ox];
	}
	
	this.render = function() {
		if(visibleFaction && (new Date().getTime() - (visibility[visibleFaction].lastUpdate||0) > 1000)) {
			visibility[visibleFaction].lastUpdate = new Date().getTime() ;

			visibility[visibleFaction].H = [];
			visibility[visibleFaction].V = [];
			
			function fill(object) {
				var left = Math.floor((object.x-object.visibilityRadius) / 16);
				var top = Math.floor((object.y-object.visibilityRadius) / 16);
				var right = Math.floor((object.x+object.visibilityRadius) / 16);
				var bottom = Math.floor((object.y+object.visibilityRadius) / 16);
				for(var i = left; i <= right; i++)
					visibility[object.opts.faction].H[i] = true;
				for(var i = top ; i <= bottom; i++)
					visibility[object.opts.faction].V[i] = true;
			}
			
			groups.some(function(group) {
				group.some(function(object) {
					if(!object.dead && visibleFaction == object.opts.faction && object.visibilityRadius > 0)
						fill(object);
				});
			});
			
			population.some(function(city) {
				if(city.faction == visibleFaction)
					fill(city);
			});
		}
		
		population.some(function(hotspot) {			
			if(visibleFaction == hotspot.faction)
				view.lightUp(hotspot.x, hotspot.y, hotspot.visibilityRadius);							
			
			var w =  Math.sqrt(hotspot.r) + 5;
			view.fillRect(hotspot.x-w/2, hotspot.y-w/2, w, w, 'green');
		});
		
		groups.some(function(group) {
			group.some(function(object) {
				if(object.type == 'launcher' && object.opts.launchTS && (worldTime - object.opts.launchTS) < 7000)
					view.drawLaunch(object.x, object.y, object.width, (worldTime - object.opts.launchTS) / 1000);
				
				if(object.dead || !visibilityMap[object.id] && !world.visibilityCheck(object, visibility[visibleFaction], visibleFaction))
					return;
				
				if(!visibilityMap[object.id])
					visibilityMap[object.id] = true;
				
				if(visibleFaction == object.opts.faction && object.visibilityRadius > 0)
					view.lightUp(object.x, object.y, object.visibilityRadius);				
				
				var color = object.selected ? 'yellow' : (object.opts.mode==0?'blue':object.opts.mode==2?'white':'red');
				if(object.type == 'launcher') {
					view.fillTriangle(object.x, object.y, object.width / 2, color);
					if(object.opts.switchMode >= 0) {
						var progress = (worldTime - object.opts.switchModeTS) / 10000;
						view.fillTriangle(object.x, object.y, object.width / 2 * progress, 
							(object.opts.switchMode==0?'blue':object.opts.switchMode==2?'white':'red'));
					}
				}
				else if(object.type == 'missile') {
					view.drawMissile(object.opts.curve, object.opts.t, object.opts.tail, object.width / 2, color, 1, 0.5);
				}
				else if(object.type == 'interceptor') {
					view.fillArc(object.x, object.y, object.width / 8, color, object.V && Math.atan2(object.V[1], object.V[0]), 1, 1);
				} else if(object.type == 'scout')
					view.fillArc(object.x, object.y, object.width / 6, 'white', object.V && Math.atan2(object.V[1], object.V[0]), 0.5, 1);
				else if(object.type == 'radar')
					view.fillRect(object.x - object.width/2, object.y-object.height/2, object.width, object.height, color);
				else if(object.type == 'explosion') {
					view.drawExplosion(object.x, object.y, (worldTime - object.opts.explosionTS) / 1000);
				}
			});
		});
		
	};
	
	this.initial = JSON.parse(JSON.stringify(this.store()));
	
})();