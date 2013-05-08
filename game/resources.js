var resources = [];

function Resource(id, name, asset) {
	resources.push({
		id : id,
		name : name,
		asset : new Asset(asset)
	})
}

var pig = new Resource('wood', 'Wood', 'wood.png');
var meat = new Resource('meat', 'Meat', 'meat.png');
var susage = new Resource('sausage', 'Sausage', 'sausage.png');