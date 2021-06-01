const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dbConfig = require("./app/config/db.config");

const app = express();
var Device = require('./app/extra/device');
var corsOptions = {
  origin: "*"
};

app.use(cors(corsOptions));

// parse requests of content-type - application/json
app.use(bodyParser.json());

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

const db = require("./app/models");
const Role = db.role;

db.mongoose
  .connect(`mongodb://${dbConfig.HOST}:${dbConfig.PORT}/${dbConfig.DB}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log("Successfully connect to MongoDB.");
    initial();
  })
  .catch(err => {
    console.error("Connection error", err);
    process.exit();
  });

// simple route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to gudemy application." });
});

// routes
require("./app/routes/auth.routes")(app);
require("./app/routes/user.routes")(app);

// set port, listen for requests
const PORT = process.env.PORT || 8084;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

function initial() {
  Role.estimatedDocumentCount((err, count) => {
    if (!err && count === 0) {
      new Role({
        name: "user"
      }).save(err => {
        if (err) {
          console.log("error", err);
        }

        console.log("added 'user' to roles collection");
      });

      new Role({
        name: "moderator"
      }).save(err => {
        if (err) {
          console.log("error", err);
        }

        console.log("added 'moderator' to roles collection");
      });

      new Role({
        name: "admin"
      }).save(err => {
        if (err) {
          console.log("error", err);
        }

        console.log("added 'admin' to roles collection");
      });
    }
  });
}
var apiRoutes = express.Router();

apiRoutes.get('/device', function(req, res){
	Device.find({owner : req.user._id}, function(error, devices){
		res.json(responseFormater(true, {devices:devices}));
	});
});

apiRoutes.post('/device', function(req, res){

	var name = req.body.name;
	var desc = req.body.desc;

	if(name == undefined || desc == undefined){
		res.json(responseFormater(false, {}, "name and desc are required"));
	}
	else{
		Device.count({owner : req.user._id, name: name}, function(error, count){

			if(count != 0){
				res.json(responseFormater(false, {}, "That device already exist. Try another name"));
			}
			else{
				Device.create({ name : name, description : desc, owner: req.user._id}, function(error, device){
					if(error){
						console.log(error);
						console.trace();
						res.json(responseFormater(false, {}, "Error while making the query. Please report"));
					}
					else{
						device.owner = undefined;
						res.json(responseFormater(true, {device: device}));
					}
				});
			}
		});
	}
});

apiRoutes.post('/device/delete', function(req, res){

	var id = req.body.id;

	if(id == undefined ){
		res.json(responseFormater(false, {}, "id is required"));
	}
	else if (!id.match(/^[0-9a-fA-F]{24}$/)) {
		res.json(responseFormater(false, {}, "id is invalid"));
	}
	else{
		Device.findOne({owner : req.user._id, _id: mongoose.Types.ObjectId(id)}, function(error, obj){

			if(obj == null){
				res.json(responseFormater(false, {}, "id is invalid"));
			}
			else{
				Device.remove({ _id: mongoose.Types.ObjectId(id)}, function(error){
					if(error){
						res.json(responseFormater(false, {}, "Please report this incident"));
						console.trace();
					}
					else{
						res.json(responseFormater( true, {msg: "The device is gone"}));
					}
				});	
			}
		});
	}
});

apiRoutes.post('/device/patch', function(req, res){

	var save = function(device, changed){

		device.save(function(err){
			if(err){
				res.json("Algo salio mal");
			}
			else{
				device.owner = undefined;
				res.json(responseFormater(true, {device: device} ));
			}
		})
	}

	var id = req.body.id;
	var changed = false;

	var name = req.body.name;
	var desc = req.body.desc;

	if(id == undefined ){
		res.json(responseFormater(false, {}, "id is required"));
	}
	else if (!id.match(/^[0-9a-fA-F]{24}$/)) {
		res.json(responseFormater(false, {}, "id is invalid"));
	}
	else{
		Device.findOne({owner : req.user._id, _id: mongoose.Types.ObjectId(id)}, function(error, obj){
			
			if(obj == null){
				res.json(responseFormater(false, {}, "no encontrado"));
				return;
			}

			if(desc != undefined && desc != obj.description){
				obj.description = desc;
				changed = true;
			}

			if(name != undefined && name != obj.name){
				Device.count({owner: req.user._id, name: name}, function(error,count){
					if(count != 0){
						res.json(responseFormater(false, {}, "A device with that name already exists"));
					}
					else{
						obj.name = name;
						save(obj, true);
					}
				});
			}
			else{
				save(obj, changed);
			}

		});
	}
});

apiRoutes.post('/device/:id/sensor', function(req, res){
	var id = req.params.id;
	if (id == undefined || !id.match(/^[0-9a-fA-F]{24}$/)) {
		res.json(responseFormater(false, {}, "id is invalid"));
	}
	else{
		Device.findOne({owner : req.user._id, _id: mongoose.Types.ObjectId(id)}, function(error, device){
			if(error){
				res.json(responseFormater(false, {}, "unkknown error"));
				console.trace();
			}
			else if(device == null){
				res.json(responseFormater(false, {}, "unkknown device"));
			}
			else{
				var name = req.body.name;
				var value = req.body.value;

				if(name == undefined || value == undefined || name == ""){
					res.json(responseFormater(false, {}, "name and value must be present"));
				}
				else if(isNaN(value)){
					res.json(responseFormater(false, {}, "Value must be numeric"));
				}
				else{
					Sensor.create({name: name, numericValue: +value, owner: device._id}, function(error, sensor){
						res.json(responseFormater(!error, {}));
					});
				}
			}
		});
	}
});

apiRoutes.post('/device/:id/sensor/img', function(req, res){
	
	var id = req.params.id;
	var label = req.body.label;
	var ref = req.body.ref

	if (id == undefined || !id.match(/^[0-9a-fA-F]{24}$/)) {
		res.json(responseFormater(false, {}, "id is invalid"));
	}
	else if (label == undefined || label == "") {
		res.json(responseFormater(false, {}, "label is invalid"));
	}
	else if (ref == undefined || ref == "") {
		res.json(responseFormater(false, {}, "ref is invalid"));
	}
	else{
		Sensor.findOne({owner : req.user._id, owner: mongoose.Types.ObjectId(id), name : label}, function(error, device){
			if(error || device == undefined || device == null){
				res.json(responseFormater(false, error, "unkknown error"));
			}
			else{
				device.images.push( mongoose.Types.ObjectId(ref) );
				device.save()
				res.json({success: true});	
			}
		});
	}
});