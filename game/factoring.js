var factories = [];

function Factory(id, name, sources, products, asset) {
	factories.push({
		id : id,
		name : name,
		sources : sources,
		products : products,
		asset : new Asset(asset)
	});
}

var butcher = new Factory('butcher', 'Butcher', ['pig'], ['meat'], 'butcher.png');
var smokehous = new Factory('smokehouse', 'Smokehous', ['meat'], ['sausage'], 'smokehouse.png');